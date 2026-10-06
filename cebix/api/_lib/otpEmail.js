/**
 * Plantilla del correo con el código de verificación de CEBIX.
 *
 * Uso en /api/send-otp:
 *   import { buildOtpEmail } from "./otpEmail.js";
 *   const { subject, html, text, attachments } = buildOtpEmail({ code, type, name, minutes: 10 });
 *   await transporter.sendMail({ from, to: email, subject, html, text, attachments });
 *
 * type: "signup" | "reset"
 *
 * Diseño: sin contornos ni bordes, fondo claro, wordmark CEBIX con la misma
 * tipografía del sidebar (Garet / Poppins 800, mayúsculas) y el código en un
 * bloque de tono plano. Todo con tablas e estilos en línea para que funcione
 * en Gmail, Outlook y Apple Mail.
 */

// Isotipo CEBIX (PNG 163x96, mismo trazado que Logo.jsx) embebido en base64.
// Se manda como adjunto inline (cid) porque Gmail/Outlook no soportan <canvas>,
// SVG inline ni data: URIs.
const LOGO_CID = "cebix-logo@cebix";
const LOGO_PNG_BASE64 =
  "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";

const BRAND = "#C08A2E";
const INK = "#111827";
const MUTED = "#6B7280";
const SOFT = "#F3F4F6";
const PAGE = "#F9FAFB";

const WORDMARK_FONT =
  "'Garet','Poppins','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY_FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const CODE_FONT =
  "'Sora','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

const COPY = {
  signup: {
    subject: "Tu código de verificación de CEBIX",
    heading: "Verifica tu correo",
    intro: "Usa este código para terminar de crear tu cuenta.",
    ignore:
      "Si no solicitaste esta cuenta, puedes ignorar este mensaje; no se activará nada.",
  },
  reset: {
    subject: "Código para restablecer tu contraseña de CEBIX",
    heading: "Restablece tu contraseña",
    intro: "Usa este código para elegir una contraseña nueva.",
    ignore:
      "Si no pediste este cambio, ignora este mensaje; tu contraseña seguirá igual.",
  },
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildOtpEmail({ code, type = "signup", name, minutes = 10 }) {
  const copy = COPY[type] ?? COPY.signup;
  const safeCode = escapeHtml(code);
  const greeting = name ? `Hola ${escapeHtml(name)},` : "Hola,";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(copy.subject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@800&family=Sora:wght@600;700&display=swap");
  @media (max-width: 520px) {
    .card { padding: 32px 24px !important; }
    .code { font-size: 32px !important; letter-spacing: 8px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Tu código es ${safeCode}. Vence en ${minutes} minutos.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding:0 0 20px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 8px 0 0;vertical-align:middle;">
                    <img src="cid:${LOGO_CID}" width="39" height="23" alt="" style="display:block;width:39px;height:23px;border:0;outline:none;">
                  </td>
                  <td style="vertical-align:middle;font-family:${WORDMARK_FONT};font-weight:800;font-size:22px;line-height:23px;letter-spacing:-0.02em;text-transform:uppercase;color:${INK};">
                    CEBIX
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="card" style="background:#FFFFFF;border-radius:12px;padding:40px 36px;font-family:${BODY_FONT};color:${INK};">
              <p style="margin:0 0 6px;font-size:13px;line-height:20px;color:${BRAND};font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">
                Código de verificación
              </p>
              <h1 style="margin:0 0 20px;font-family:${CODE_FONT};font-size:22px;line-height:30px;font-weight:700;color:${INK};">
                ${copy.heading}
              </h1>
              <p style="margin:0 0 4px;font-size:15px;line-height:24px;color:${INK};">${greeting}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:24px;color:${MUTED};">${copy.intro}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:${SOFT};border-radius:10px;padding:26px 12px;">
                    <span class="code" style="font-family:${CODE_FONT};font-size:38px;line-height:44px;font-weight:700;letter-spacing:12px;padding-left:12px;color:${INK};">${safeCode}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:14px;line-height:22px;color:${MUTED};">
                El código vence en ${minutes} minutos. No lo compartas con nadie; el equipo de CEBIX nunca te lo pedirá.
              </p>
              <p style="margin:12px 0 0;font-size:14px;line-height:22px;color:${MUTED};">
                ${copy.ignore}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:${BODY_FONT};font-size:12px;line-height:18px;color:#9CA3AF;">
              Este es un mensaje automático, no respondas a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "CEBIX",
    "",
    copy.heading,
    "",
    greeting,
    copy.intro,
    "",
    `Código: ${code}`,
    "",
    `Vence en ${minutes} minutos. No lo compartas con nadie.`,
    copy.ignore,
  ].join("\n");

  const attachments = [
    {
      filename: "cebix-logo.png",
      content: Buffer.from(LOGO_PNG_BASE64, "base64"),
      contentType: "image/png",
      cid: LOGO_CID,
      contentDisposition: "inline",
    },
  ];

  return { subject: copy.subject, html, text, attachments };
}
