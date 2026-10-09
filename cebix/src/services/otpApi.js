/**
 * Llama a las funciones serverless /api/send-otp y /api/verify-otp, que
 * mandan y validan el código de verificación por Gmail SMTP en vez de
 * usar el correo integrado de Supabase.
 *
 * Devuelven { data, error } igual que el SDK de Supabase, para que el
 * resto del código (AuthContext, páginas) no tenga que cambiar de forma
 * de manejar errores.
 */
async function callOtpApi(path, body) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return { data: null, error: new Error(payload?.error || "request_failed") };
    }
    return { data: payload, error: null };
  } catch {
    return { data: null, error: new Error("network_error") };
  }
}

/** Pide (o reenvía) el código de registro; crea la cuenta sin confirmar si no existía. */
export function sendSignupOtp({ email, password, name }) {
  return callOtpApi("/api/send-otp", { type: "signup", email, password, name });
}

/** Confirma el código de 6 dígitos del registro. */
export function verifySignupOtpApi({ email, code }) {
  return callOtpApi("/api/verify-otp", { type: "signup", email, code });
}

/** Pide el código para restablecer contraseña (siempre responde ok, exista o no el correo). */
export function sendResetOtp({ email }) {
  return callOtpApi("/api/send-otp", { type: "reset", email });
}

/** Solo comprueba que el código de recuperación sea correcto (no lo consume). */
export function checkResetOtpApi({ email, code }) {
  return callOtpApi("/api/verify-otp", { type: "reset_check", email, code });
}

/** Confirma el código de recuperación y establece la contraseña nueva. */
export function verifyResetOtpApi({ email, code, newPassword }) {
  return callOtpApi("/api/verify-otp", { type: "reset", email, code, newPassword });
}
