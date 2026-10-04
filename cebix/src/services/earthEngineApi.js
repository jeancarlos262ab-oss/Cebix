/**
 * Cliente de POST /predict-from-geometry (backend/main.py).
 *
 *   entrada : { ID_POLIGONO, Estado, geometry (GeoJSON Polygon, lat/lng), anio }
 *   salida  : { ID_POLIGONO, features_calculadas, yieldEstimate, ic90_inferior, ic90_superior,
 *               confidence, shap: [{ feature, impact, direction }], advertencias, proveedor }
 *
 * Aquí no hay simulación de ningún tipo: si el backend no responde o no puede calcular, se
 * muestra el error tal cual. Las cifras que ves salen siempre de imágenes satelitales reales
 * y del modelo entrenado.
 */
import { API_URL, friendlyError } from "./modelApi";

/**
 * Milisegundos que dura cada paso en la lista de avance. Es solo una ESTIMACIÓN visual (la
 * petición es una sola y tarda ~30–90 s): el último paso espera hasta que el backend responde.
 */
export const STEP_MS = 5000;

export async function predictFromGeometry(payload, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}/predict-from-geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(friendlyError(err));
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === "string" ? detail.detail : `El backend respondió ${res.status}`);
  }
  return res.json();
}
