/**
 * Mensajes para la persona usuaria. Las notificaciones (toast) y los avisos en pantalla nunca deben mostrar
 * detalles técnicos (servidor, base de datos, scripts SQL, códigos HTTP, CORS, URLs...): esos detalles se
 * quedan en la consola del navegador y aquí se convierten en una frase que cualquiera entienda.
 */
export const MSG_CONNECTION = "No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.";
export const MSG_SERVICE = "El servicio no está disponible por el momento. Inténtalo de nuevo en unos minutos.";
export const MSG_GENERIC = "Algo salió mal. Inténtalo de nuevo.";

/** ¿El texto habla de piezas internas (servidor, base de datos, códigos...) en vez de lo que la persona hizo? */
const TECHNICAL =
  /backend|supabase|\bsql\b|postgres|pgrst|\bjwt\b|row-level|\brls\b|bucket|schema|relation\b|column\b|constraint|\bcors\b|fetch|network|\bhttps?\b|localhost|\burl\b|endpoint|\bapi\b|\b[1-5]\d\d\b|traceback|exception|stack|undefined|\bnull\b|\bnan\b|\bjson\b|syntax|unexpected token|timeout|timed out|econn|\.sql|no se pudo conectar|request_failed|network_error|\bloc\b|field required|body\./i;

export const isTechnical = (text) => TECHNICAL.test(String(text ?? ""));

const isConnectionError = (err) =>
  err instanceof TypeError || /failed to fetch|networkerror|load failed|network_error/i.test(String(err?.message ?? ""));

/**
 * Texto seguro para mostrar. Si el error es técnico devuelve `fallback` (o un mensaje genérico) y deja el
 * detalle en la consola para quien desarrolla.
 * @param err       Error, texto u objeto con `message`
 * @param fallback  Qué decir si el error no se puede mostrar tal cual
 */
export function userMessage(err, fallback) {
  const text = typeof err === "string" ? err : String(err?.message ?? "");
  if (err && typeof err !== "string") console.error("[error]", err);
  if (isConnectionError(err)) return MSG_CONNECTION;
  if (Number(err?.status) >= 500) return MSG_SERVICE;
  if (!text.trim() || isTechnical(text)) return fallback ?? MSG_GENERIC;
  return text;
}
