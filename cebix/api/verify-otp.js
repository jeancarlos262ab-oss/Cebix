import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { verifyAndConsumeOtp, checkOtp } from "./_lib/otp.js";

const REASON_MESSAGES = {
  not_found: "no_code",
  expired: "expired",
  mismatch: "invalid",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const { type, email, code, newPassword } = req.body ?? {};

    if (!email || !code) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }

    if (type === "signup") {
      const result = await verifyAndConsumeOtp({ email, type: "signup", code });
      if (!result.ok) {
        res.status(400).json({ error: REASON_MESSAGES[result.reason] || "invalid" });
        return;
      }

      const admin = supabaseAdmin();
      const { error } = await admin.auth.admin.updateUserById(result.row.user_id, {
        email_confirm: true,
      });
      if (error) {
        res.status(500).json({ error: "confirm_failed", message: error.message });
        return;
      }

      res.status(200).json({ ok: true });
      return;
    }

    // Solo comprueba que el código sea correcto (no lo consume ni cambia nada):
    // lo usa la pantalla del código antes de mostrar los campos de contraseña.
    if (type === "reset_check") {
      const result = await checkOtp({ email, type: "reset", code });
      if (!result.ok) {
        res.status(400).json({ error: REASON_MESSAGES[result.reason] || "invalid" });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (type === "reset") {
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ error: "invalid_password" });
        return;
      }

      const result = await verifyAndConsumeOtp({ email, type: "reset", code });
      if (!result.ok) {
        res.status(400).json({ error: REASON_MESSAGES[result.reason] || "invalid" });
        return;
      }

      const admin = supabaseAdmin();
      const { error } = await admin.auth.admin.updateUserById(result.row.user_id, {
        password: newPassword,
      });
      if (error) {
        res.status(500).json({ error: "update_password_failed", message: error.message });
        return;
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "invalid_type" });
  } catch (err) {
    console.error("verify-otp error", err);
    res.status(500).json({ error: "server_error" });
  }
}
