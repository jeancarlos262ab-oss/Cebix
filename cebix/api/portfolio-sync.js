import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { sendMail } from "./_lib/mailer.js";
import { riskAlertEmail } from "./_lib/templates.js";
import { unsubscribeUrl } from "./_lib/unsub.js";

const COLORS = new Set(["green", "yellow", "red"]);
const MAX_PARCELS = 5000;

/**
 * POST /api/portfolio-sync   (Authorization: Bearer <token de sesión de Supabase>)
 * Body: { parcels: [{ id, name, region, riskColor, score, yieldEstimate, area }] }
 *
 * 1. Valida la sesión (el correo SIEMPRE va a la cuenta autenticada, nunca a una dirección del body).
 * 2. Compara con la foto anterior: parcelas que ya existían y ahora están en amarillo o rojo.
 * 3. Si hay cambios y el usuario tiene activados "Alertas por correo" + "Alertas de riesgo", manda UN correo agrupado.
 * 4. Guarda la foto nueva (también la usa el resumen semanal). La primera vez solo guarda: no avisa.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "unauthorized" });

    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth?.user) return res.status(401).json({ error: "unauthorized" });
    const user = auth.user;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!Array.isArray(body?.parcels) || body.parcels.length > MAX_PARCELS) return res.status(400).json({ error: "bad_request" });
    const parcels = body.parcels
      .filter((p) => p && p.id != null && COLORS.has(p.riskColor))
      .map((p) => ({
        id: String(p.id).slice(0, 80),
        name: String(p.name ?? p.id).slice(0, 120),
        region: String(p.region ?? "").slice(0, 60),
        riskColor: p.riskColor,
        score: Number.isFinite(Number(p.score)) ? Number(p.score) : null,
        yieldEstimate: Number.isFinite(Number(p.yieldEstimate)) ? Number(p.yieldEstimate) : null,
        area: Number.isFinite(Number(p.area)) ? Number(p.area) : null,
      }));

    const { data: prevRow } = await db.from("portfolio_snapshots").select("parcels").eq("user_id", user.id).maybeSingle();
    const prev = new Map((prevRow?.parcels ?? []).map((p) => [p.id, p]));

    // Solo parcelas que ya estaban y cambiaron a amarillo o rojo.
    const changes = prevRow
      ? parcels
          .filter((p) => prev.has(p.id) && prev.get(p.id).riskColor !== p.riskColor && (p.riskColor === "red" || p.riskColor === "yellow"))
          .map((p) => ({ name: p.name, region: p.region, from: prev.get(p.id).riskColor, to: p.riskColor, score: p.score }))
      : [];

    // Se guarda primero: si el correo falla no se reintenta en cada sincronización (evita bucles y duplicados).
    const { error: saveError } = await db
      .from("portfolio_snapshots")
      .upsert({ user_id: user.id, parcels, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) throw saveError;

    let sent = false;
    if (changes.length && user.email) {
      const { data: prof } = await db.from("profiles").select("notif_email, notif_risk").eq("id", user.id).maybeSingle();
      if ((prof?.notif_email ?? true) && (prof?.notif_risk ?? true)) {
        // Rojas primero.
        changes.sort((a, b) => (a.to === b.to ? 0 : a.to === "red" ? -1 : 1));
        const mail = riskAlertEmail(user.id, changes);
        await sendMail({
          to: user.email,
          ...mail,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl(user.id, "risk")}>` },
        });
        sent = true;
      }
    }
    return res.status(200).json({ ok: true, changes: changes.length, sent });
  } catch (err) {
    console.error("portfolio-sync", err);
    return res.status(500).json({ error: "server_error" });
  }
}
