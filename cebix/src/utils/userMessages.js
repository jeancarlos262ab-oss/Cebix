export const SHOW_REAL_ERRORS = true;

export function realError(err) {
  if (typeof err === "string") return err;
  const parts = [`${err?.name ?? "Error"}: ${err?.message ?? String(err)}`];
  if (err?.status) parts.push(`HTTP ${err.status}`);
  if (err?.url) parts.push(`URL: ${err.url}`);
  if (err?.raw) parts.push(`Respuesta: ${String(err.raw).slice(0, 600)}`);
  return parts.join(" | ");
}

export const MSG_CONNECTION = "No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo.";
export const MSG_SERVICE = "El servicio no está disponible por el momento. Inténtalo de nuevo en unos minutos.";
export const MSG_GENERIC = "Algo salió mal. Inténtalo de nuevo.";

const TECHNICAL =
  /backend|supabase|\bsql\b|postgres|pgrst|\bjwt\b|row-level|\brls\b|bucket|schema|relation\b|column\b|constraint|\bcors\b|fetch|network|\bhttps?\b|localhost|\burl\b|endpoint|\bapi\b|\b[1-5]\d\d\b|traceback|exception|stack|undefined|\bnull\b|\bnan\b|\bjson\b|syntax|unexpected token|timeout|timed out|econn|\.sql|no se pudo conectar|request_failed|network_error|\bloc\b|field required|body\./i;

export const isTechnical = (text) => TECHNICAL.test(String(text ?? ""));

const isConnectionError = (err) =>
  err instanceof TypeError || /failed to fetch|networkerror|load failed|network_error/i.test(String(err?.message ?? ""));

export function userMessage(err, fallback) {
  const text = typeof err === "string" ? err : String(err?.message ?? "");
  if (err && typeof err !== "string") console.error("[error]", err);
  if (SHOW_REAL_ERRORS) return realError(err);
  if (isConnectionError(err)) return MSG_CONNECTION;
  if (Number(err?.status) >= 500) return MSG_SERVICE;
  if (!text.trim() || isTechnical(text)) return fallback ?? MSG_GENERIC;
  return text;
}