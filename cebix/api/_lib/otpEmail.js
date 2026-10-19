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
 * Diseño: sin contornos ni bordes, fondo claro, logo CEBIX completo (imagen,
 * igual al del login) y el código en un
 * bloque de tono plano. Todo con tablas e estilos en línea para que funcione
 * en Gmail, Outlook y Apple Mail.
 */

// Logo CEBIX completo (PNG 492x129, el mismo del login: Logo.jsx) embebido en base64.
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
              <img src="cid:${LOGO_CID}" width="164" height="43" alt="CEBIX" style="display:block;width:164px;height:43px;border:0;outline:none;">
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
