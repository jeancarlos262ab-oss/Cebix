import nodemailer from "nodemailer";
import { buildOtpEmail } from "./otpEmail.js";
import { OTP_TTL_MINUTES } from "./otp.js";

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

export async function sendMail({ to, subject, html, text, attachments }) {
  const fromName = process.env.GMAIL_FROM_NAME || "CEBIX";
  const user = process.env.GMAIL_USER;

  await transporter().sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

// Correo con el diseño de email-preview/preview-otp-email.html (plantilla en otpEmail.js).
function sendOtpEmail(to, code, type, name) {
  const { subject, html, text, attachments } = buildOtpEmail({
    code,
    type,
    name,
    minutes: OTP_TTL_MINUTES,
  });
  return sendMail({ to, subject, html, text, attachments });
}

export function sendSignupOtpEmail(to, code, name) {
  return sendOtpEmail(to, code, "signup", name);
}

export function sendResetOtpEmail(to, code, name) {
  return sendOtpEmail(to, code, "reset", name);
}
