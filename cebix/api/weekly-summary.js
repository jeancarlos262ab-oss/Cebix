import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { sendMail } from "./_lib/mailer.js";
import { weeklyEmail } from "./_lib/templates.js";
import { unsubscribeUrl } from "./_lib/unsub.js";

export const config = { maxDuration: 60 };

/**
 * GET /api/weekly-summary — lo ejecuta el cron de Vercel cada lunes (ver vercel.json).
 * Vercel manda  Authorization: Bearer <CRON_SECRET>; cualquier otra petición se rechaza.
 * Envía el resumen a quien tenga activados "Alertas por correo" y "Resumen semanal" y tenga parcelas.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "unauthorized" });

  const db = supabaseAdmin();
  const { data: profiles, error } = await db.from("profiles").select("id, email").eq("notif_email", true).eq("notif_weekly", true);
  if (error) {
    console.error("weekly-summary", error);
    return res.status(500).json({ error: "server_error" });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const { id, email: profileEmail } of profiles ?? []) {
    try {
      const { data: snap } = await db.from("portfolio_snapshots").select("parcels, last_weekly").eq("user_id", id).maybeSingle();
      const parcels = snap?.parcels ?? [];
      if (!parcels.length) {
        skipped++;
        continue;
      }
      const email = profileEmail || (await db.auth.admin.getUserById(id)).data?.user?.email;
      if (!email) {
        skipped++;
        continue;
      }
      const count = (c) => parcels.filter((p) => p.riskColor === c).length;
      const yields = parcels.map((p) => p.yieldEstimate).filter(Number.isFinite);
      const summary = {
        total: parcels.length,
        green: count("green"),
        yellow: count("yellow"),
        red: count("red"),
        avgYield: yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : NaN,
        prev: snap?.last_weekly ?? null,
        worst: [...parcels].filter((p) => Number.isFinite(p.score)).sort((a, b) => a.score - b.score).slice(0, 3),
      };
      const mail = weeklyEmail(id, summary);
      await sendMail({ to: email, ...mail, headers: { "List-Unsubscribe": `<${unsubscribeUrl(id, "weekly")}>` } });
      await db
        .from("portfolio_snapshots")
        .update({ last_weekly: { total: summary.total, green: summary.green, yellow: summary.yellow, red: summary.red, at: new Date().toISOString() } })
        .eq("user_id", id);
      sent++;
    } catch (err) {
      failed++;
      console.error("weekly-summary usuario", id, err);
    }
  }
  return res.status(200).json({ ok: true, sent, skipped, failed });
}
