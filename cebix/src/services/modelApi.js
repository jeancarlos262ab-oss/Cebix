/**
 * Cliente de la API de inferencia (carpeta /backend). Es la ÚNICA fuente de datos del
 * modelo en el dashboard: predicciones, métricas, importancia SHAP y archivo de ejemplo.
 * No hay datos del modelo escritos en el código del frontend.
 */
export const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const EXAMPLE_CSV_URL = `${API_URL}/example-csv`;

/** Error de la API con los datos reales de la respuesta (código HTTP, URL y cuerpo crudo). */
export class ApiError extends Error {
  constructor(message, { status, url, raw } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.raw = raw;
  }
}

// FastAPI manda `detail` como texto, como lista de errores de validación (422) o como objeto.
function detailToText(detail) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((d) => {
        if (typeof d === "string") return d;
        const loc = Array.isArray(d?.loc) ? d.loc.filter((x) => x !== "body").join(".") : "";
        const msg = d?.msg ?? JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join("\n");
  if (typeof detail === "object") return detail.message ?? detail.error ?? JSON.stringify(detail);
  return String(detail);
}

/** Convierte una respuesta no exitosa en un ApiError con el mensaje real del servidor. */
export async function errorFromResponse(res) {
  const raw = (await res.text().catch(() => "")).trim();
  let detail = "";
  try {
    const json = JSON.parse(raw);
    detail = detailToText(json?.detail ?? json?.message ?? json?.error ?? json);
  } catch {
    // Cuerpo que no es JSON (p. ej. la página de error de un proxy): no se usa como mensaje.
    detail = raw && !raw.startsWith("<") ? raw.slice(0, 500) : "";
  }
  const message = detail || `El backend respondió ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
  return new ApiError(message, { status: res.status, url: res.url, raw: raw.slice(0, 4000) });
}

/** POST /predict-csv — ejecuta el modelo real sobre un File. Devuelve { n_parcelas, predicciones }. */
export async function predictCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/predict-csv`, { method: "POST", body: formData });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

/** GET /model-info — métricas de validación, SHAP global, comparación de algoritmos, textos. */
export async function fetchModelInfo() {
  const res = await fetch(`${API_URL}/model-info`);
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

/** GET /example-csv — el archivo de ejemplo del backend, como File listo para enviar. */
export async function fetchExampleFile() {
  const res = await fetch(EXAMPLE_CSV_URL);
  if (!res.ok) throw new Error("No se pudo cargar el archivo de ejemplo desde el backend.");
  const blob = await res.blob();
  return new File([blob], "ejemplo_features_predict.csv", { type: "text/csv" });
}

export function friendlyError(err) {
  // Los navegadores usan un TypeError genérico cuando la petición ni siquiera llega a respuesta.
  if (err instanceof TypeError) {
    return `No se pudo conectar con el backend (${API_URL}). El navegador no recibió respuesta: el servidor está apagado o inalcanzable, la URL es incorrecta o bloquea el origen (CORS). Error del navegador: ${err.message}`;
  }
  return err.message;
}
