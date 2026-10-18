import { getPredictionMode } from "./predictionMode";
import { API_URL, ApiError, errorFromResponse, friendlyError } from "./modelApi";

export const STEP_MS = 5000;

export async function predictFromGeometry(payload, { signal } = {}) {
  const url = `${API_URL}/predict-from-geometry`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo: getPredictionMode(), ...payload }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(friendlyError(err), { url, raw: String(err) });
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}