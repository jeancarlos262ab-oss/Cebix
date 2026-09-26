import nodemailer from "nodemailer";

// Variables de entorno requeridas en el proyecto de Vercel:
//   GMAIL_USER          -> la cuenta de Gmail/Workspace que envía los correos
//   GMAIL_APP_PASSWORD  -> contraseña de aplicación de 16 caracteres
//                          (Cuenta de Google -> Seguridad -> Verificación en
//                          dos pasos -> Contraseñas de aplicaciones). NO es
//                          la contraseña normal de la cuenta: con 2FA activo,
//                          Gmail la rechaza para SMTP y hay que generar una
//                          contraseña de aplicación específica.
//   GMAIL_FROM_NAME     -> opcional, nombre que se muestra como remitente
let cached = null;

function transporter() {
  if (cached) return cached;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Faltan variables de entorno: GMAIL_USER y/o GMAIL_APP_PASSWORD.");
  }

  cached = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cached;
}

export async function sendMail({ to, subject, html, text }) {
  const fromName = process.env.GMAIL_FROM_NAME || "CEBIX";
  const user = process.env.GMAIL_USER;

  await transporter().sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject,
    text,
    html,
  });
}

function codeBlockHtml(code) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 420px; margin: 0 auto;">
      <p style="font-size: 14px; color: #374151;">Tu código de verificación es:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827; margin: 16px 0;">${code}</p>
      <p style="font-size: 13px; color: #6b7280;">Vence en 10 minutos. Si tú no solicitaste este código, puedes ignorar este correo.</p>
    </div>
  `;
}

export function sendSignupOtpEmail(to, code) {
  return sendMail({
    to,
    subject: `${code} es tu código de verificación de CEBIX`,
    text: `Tu código de verificación de CEBIX es ${code}. Vence en 10 minutos.`,
    html: codeBlockHtml(code),
  });
}

export function sendResetOtpEmail(to, code) {
  return sendMail({
    to,
    subject: `${code} es tu código para restablecer tu contraseña de CEBIX`,
    text: `Tu código para restablecer tu contraseña de CEBIX es ${code}. Vence en 10 minutos.`,
    html: codeBlockHtml(code),
  });
}
