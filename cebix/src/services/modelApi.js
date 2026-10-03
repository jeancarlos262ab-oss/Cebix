/**
 * Cliente de la API de inferencia (carpeta /backend). Es la ÚNICA fuente de datos del
 * modelo en el dashboard: predicciones, métricas, importancia SHAP y archivo de ejemplo.
 * No hay datos del modelo escritos en el código del frontend.
 */
export const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const EXAMPLE_CSV_URL = `${API_URL}/example-csv`;

async function readError(res) {
  const detail = await res.json().catch(() => ({}));
  return typeof detail.detail === "string" ? detail.detail : `El backend respondió ${res.status}`;
}

/** POST /predict-csv — ejecuta el modelo real sobre un File. Devuelve { n_parcelas, predicciones }. */
export async function predictCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/predict-csv`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** GET /model-info — métricas de validación, SHAP global, comparación de algoritmos, textos. */
export async function fetchModelInfo() {
  const res = await fetch(`${API_URL}/model-info`);
  if (!res.ok) throw new Error(await readError(res));
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
  return err.message === "Failed to fetch"
    ? "No se pudo conectar al backend. Si está en Render/Railway con plan gratuito puede tardar ~30 s en despertar; intenta de nuevo."
    : err.message;
}
