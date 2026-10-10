import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { validUnsubscribe, appUrl } from "./_lib/unsub.js";

const page = (title, msg) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px">
<div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;color:#6b7280">CEBIX</p>
<h1 style="margin:0 0 10px;font-size:20px">${title}</h1><p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.5">${msg}</p>
<a href="${appUrl()}/ajustes" style="font-size:14px;color:#111827">Ir a Ajustes</a></div></body></html>`;

/** GET /api/unsubscribe?u=<id>&t=risk|weekly|all&k=<firma>  — baja con un clic desde el correo. */
export default async function handler(req, res) {
  const { u, t, k } = req.query;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!validUnsubscribe(u, t, k)) return res.status(400).send(page("Enlace no válido", "Este enlace de baja no es válido o está incompleto. Puedes cambiar tus avisos en Ajustes."));
  try {
    const patch = t === "all" ? { notif_email: false } : t === "risk" ? { notif_risk: false } : { notif_weekly: false };
    const { error } = await supabaseAdmin().from("profiles").update(patch).eq("id", u);
    if (error) throw error;
    const what = t === "all" ? "ningún correo" : t === "risk" ? "alertas de riesgo" : "el resumen semanal";
    return res.status(200).send(page("Listo", `Ya no recibirás ${what} de CEBIX. Puedes volver a activarlos cuando quieras en Ajustes → Notificaciones.`));
  } catch (err) {
    console.error("unsubscribe", err);
    return res.status(500).send(page("No se pudo completar", "Ocurrió un error. Inténtalo de nuevo o cambia tus avisos en Ajustes."));
  }
}
