import { supabaseAdmin } from "./supabaseAdmin.js";

export const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;

function generateCode() {
  // 6 dígitos, siempre con ceros a la izquierda (ej. "004821").
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

/**
 * Crea un código nuevo para (email, type) e invalida los anteriores que
 * seguían sin usarse. Devuelve el código en texto plano para mandarlo por
 * correo (no se reutiliza después: solo se compara contra lo guardado).
 */
export async function createOtp({ email, type, userId }) {
  const admin = supabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();

  // Evita reenvíos en ráfaga: si hay un código vigente pedido hace poco,
  // no se genera otro todavía.
  const { data: recent, error: recentError } = await admin
    .from("otp_codes")
    .select("created_at")
    .eq("email", normalizedEmail)
    .eq("type", type)
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentError) throw recentError;

  if (recent) {
    const secondsSince = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      return { throttled: true, waitSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince) };
    }
  }

  // Invalida cualquier código anterior sin usar para ese correo/tipo.
  const { error: invalidateError } = await admin
    .from("otp_codes")
    .update({ consumed: true })
    .eq("email", normalizedEmail)
    .eq("type", type)
    .eq("consumed", false);
  if (invalidateError) throw invalidateError;

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await admin.from("otp_codes").insert({
    email: normalizedEmail,
    code,
    type,
    user_id: userId ?? null,
    expires_at: expiresAt,
    consumed: false,
  });
  if (insertError) throw insertError;

  return { throttled: false, code };
}

/**
 * Busca el código vigente de (email, type) y lo compara, SIN consumirlo.
 * Sirve para validar el código en un paso aparte antes de pedir la contraseña nueva.
 */
export async function checkOtp({ email, type, code }) {
  const admin = supabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = String(code).trim();

  const { data: row, error } = await admin
    .from("otp_codes")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("type", type)
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!row) return { ok: false, reason: "not_found" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.code !== normalizedCode) return { ok: false, reason: "mismatch" };

  return { ok: true, row };
}

/**
 * Verifica un código para (email, type). Si es válido lo marca como usado
 * (consumed = true) para que no se pueda reutilizar y devuelve la fila.
 */
export async function verifyAndConsumeOtp({ email, type, code }) {
  const result = await checkOtp({ email, type, code });
  if (!result.ok) return result;

  const admin = supabaseAdmin();
  const { error: consumeError } = await admin
    .from("otp_codes")
    .update({ consumed: true })
    .eq("id", result.row.id);
  if (consumeError) throw consumeError;

  return result;
}
