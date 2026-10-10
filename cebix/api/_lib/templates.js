import { appUrl, unsubscribeUrl } from "./unsub.js";

const COLORS = { red: "#B8493B", yellow: "#C08A2E", green: "#4C9A63" };
const LABEL = { red: "Alto riesgo", yellow: "Revisión", green: "Elegible" };

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const dot = (color) =>
  `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLORS[color] || "#98A2B3"};margin-right:6px"></span>`;

function layout({ title, body, uid, type }) {
  const base = appUrl();
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;color:#6b7280">CEBIX</p>
<h1 style="margin:0 0 18px;font-size:22px;font-weight:600">${esc(title)}</h1>
${body}
<p style="margin:26px 0 0"><a href="${base}/parcelas" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;padding:10px 18px;border-radius:999px">Abrir CEBIX</a></p>
</td></tr></table>
<p style="max-width:560px;margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7280">
Recibes este correo porque activaste estos avisos en CEBIX.
<a href="${unsubscribeUrl(uid, type)}" style="color:#6b7280">Dejar de recibir estos avisos</a> ·
<a href="${unsubscribeUrl(uid, "all")}" style="color:#6b7280">No recibir ningún correo</a> ·
<a href="${base}/ajustes" style="color:#6b7280">Ajustes</a></p>
</td></tr></table></body></html>`;
}

/** changes: [{name, region, from, to, score}] */
export function riskAlertEmail(uid, changes) {
  const MAX = 20;
  const shown = changes.slice(0, MAX);
  const reds = changes.filter((c) => c.to === "red").length;
  const rows = shown
    .map(
      (c) => `<tr>
<td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:14px"><strong>${esc(c.name)}</strong><br><span style="color:#6b7280;font-size:12px">${esc(c.region || "")}</span></td>
<td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:13px;text-align:right;white-space:nowrap">${dot(c.from)}${LABEL[c.from] || "—"} → ${dot(c.to)}<strong>${LABEL[c.to]}</strong>${Number.isFinite(c.score) ? `<br><span style="color:#6b7280;font-size:12px">Score ${Math.round(c.score)} / 100</span>` : ""}</td></tr>`,
    )
    .join("");
  const more = changes.length > MAX ? `<p style="font-size:13px;color:#6b7280">y ${changes.length - MAX} parcela(s) más.</p>` : "";
  const title =
    changes.length === 1
      ? `La parcela ${changes[0].name} cambió a ${LABEL[changes[0].to].toLowerCase()}`
      : `${changes.length} parcelas cambiaron de semáforo`;
  const body = `<p style="margin:0 0 14px;font-size:14px;line-height:1.5">${
    reds ? `${reds} pasaron a <strong style="color:${COLORS.red}">alto riesgo</strong>. ` : ""
  }Revisa estos cambios en tu portafolio:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${more}`;
  const text = `${title}\n\n${shown.map((c) => `- ${c.name}: ${LABEL[c.from] || "—"} → ${LABEL[c.to]}`).join("\n")}\n\n${appUrl()}/parcelas`;
  return { subject: `CEBIX · ${title}`, html: layout({ title, body, uid, type: "risk" }), text };
}

/** s: {total, green, yellow, red, avgYield, prev:{total,green,yellow,red}|null, worst:[{name,region,score}]} */
export function weeklyEmail(uid, s) {
  const delta = (k) => {
    if (!s.prev) return "";
    const d = s[k] - s.prev[k];
    return d === 0 ? " <span style='color:#6b7280;font-size:12px'>(sin cambio)</span>" : ` <span style='color:#6b7280;font-size:12px'>(${d > 0 ? "+" : ""}${d} vs. la semana pasada)</span>`;
  };
  const line = (k) => `<tr><td style="padding:6px 0;font-size:14px">${dot(k)}${LABEL[k]}</td><td style="padding:6px 0;font-size:14px;text-align:right"><strong>${s[k]}</strong>${delta(k)}</td></tr>`;
  const worst = s.worst.length
    ? `<h2 style="margin:22px 0 8px;font-size:15px;font-weight:600">Parcelas con menor score</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.worst
        .map(
          (w) => `<tr><td style="padding:7px 0;border-top:1px solid #e5e7eb;font-size:14px">${esc(w.name)} <span style="color:#6b7280;font-size:12px">${esc(w.region || "")}</span></td><td style="padding:7px 0;border-top:1px solid #e5e7eb;font-size:14px;text-align:right">${Math.round(w.score)} / 100</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const body = `<p style="margin:0 0 14px;font-size:14px;line-height:1.5">Así está tu portafolio de <strong>${s.total}</strong> parcela(s)${
    Number.isFinite(s.avgYield) ? `, con un rendimiento estimado promedio de <strong>${s.avgYield.toFixed(1)} ton/ha</strong>` : ""
  }.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${line("green")}${line("yellow")}${line("red")}</table>${worst}`;
  const text = `Resumen semanal CEBIX\n\n${s.total} parcelas · Elegible ${s.green} · Revisión ${s.yellow} · Alto riesgo ${s.red}\n\n${appUrl()}/parcelas`;
  return { subject: "CEBIX · Resumen semanal de tu portafolio", html: layout({ title: "Resumen semanal", body, uid, type: "weekly" }), text };
}
