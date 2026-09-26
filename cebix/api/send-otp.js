import { supabaseAdmin, findUserByEmail } from "./_lib/supabaseAdmin.js";
import { createOtp } from "./_lib/otp.js";
import { sendSignupOtpEmail, sendResetOtpEmail } from "./_lib/mailer.js";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const { type, email, password, name, role, region } = req.body ?? {};

    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }

    if (type === "signup") {
      const existing = await findUserByEmail(email);
      let userId;

      if (existing) {
        if (existing.email_confirmed_at) {
          // Cuenta ya activa: no se manda código, el frontend debe pedir
          // que inicie sesión en vez de registrarse de nuevo.
          res.status(409).json({ error: "already_registered" });
          return;
        }
        userId = existing.id;

        // Si vuelve a mandar el formulario (por ejemplo, corrigió el
        // nombre o el rol antes de verificar), actualizamos esos datos.
        const metadataPatch = {};
        if (name) metadataPatch.name = name;
        if (role) metadataPatch.role = role;
        if (region) metadataPatch.region = region;
        if (Object.keys(metadataPatch).length > 0) {
          const admin = supabaseAdmin();
          await admin.auth.admin.updateUserById(userId, { user_metadata: metadataPatch });
        }
      } else {
        if (!password || password.length < 6) {
          res.status(400).json({ error: "invalid_password" });
          return;
        }
        const admin = supabaseAdmin();
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: { name, role, region },
        });
        if (error) {
          res.status(400).json({ error: "create_user_failed", message: error.message });
          return;
        }
        userId = data.user.id;
      }

      const result = await createOtp({ email, type: "signup", userId });
      if (!result.throttled) {
        await sendSignupOtpEmail(email, result.code);
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (type === "reset") {
      // Nunca revelamos si el correo existe o no: siempre respondemos ok.
      const existing = await findUserByEmail(email);
      if (existing) {
        const result = await createOtp({ email, type: "reset", userId: existing.id });
        if (!result.throttled) {
          await sendResetOtpEmail(email, result.code);
        }
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "invalid_type" });
  } catch (err) {
    console.error("send-otp error", err);
    res.status(500).json({ error: "server_error" });
  }
}
