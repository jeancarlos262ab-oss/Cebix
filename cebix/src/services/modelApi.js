import { getPredictionMode } from "./predictionMode";
import { MSG_CONNECTION, MSG_GENERIC, MSG_SERVICE, SHOW_REAL_ERRORS, isTechnical, realError } from "../utils/userMessages";

export const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const EXAMPLE_CSV_URL = `${API_URL}/example-csv`;

export const EXAMPLE_TODOS_URL = `${import.meta.env.BASE_URL}ejemplos/Archivos_de_ejemplo.zip`;

export class ApiError extends Error {
  constructor(message, { status, url, raw } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.raw = raw;
  }
}

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

export async function errorFromResponse(res) {
  const raw = (await res.text().catch(() => "")).trim();
  let detail = "";
  try {
    const json = JSON.parse(raw);
    detail = detailToText(json?.detail ?? json?.message ?? json?.error ?? json);
  } catch {
    
    detail = raw && !raw.startsWith("<") ? raw.slice(0, 500) : "";
  }
  
  let message;
  if (res.status >= 500) message = MSG_SERVICE;
  else if (res.status === 413) message = "El archivo es demasiado grande.";
  else if (detail && !isTechnical(detail)) message = detail;
  else message = MSG_GENERIC;
  console.error(`[api] ${res.status} ${res.url}`, raw.slice(0, 500));
  if (SHOW_REAL_ERRORS) message = `HTTP ${res.status} ${res.url} → ${detail || raw.slice(0, 400) || "(sin cuerpo)"}`;
  return new ApiError(message, { status: res.status, url: res.url, raw: raw.slice(0, 4000) });
}

export async function predictCsv(file, modo = getPredictionMode()) {
  const formData = new FormData();
  formData.append("file", file); 
  const res = await fetch(`${API_URL}/predict-csv?modo=${encodeURIComponent(modo)}`, { method: "POST", body: formData });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export async function fetchModelInfo() {
  const res = await fetch(`${API_URL}/model-info`);
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export async function fetchExampleFile() {
  const res = await fetch(EXAMPLE_CSV_URL);
  if (!res.ok) throw new Error("No se pudo cargar el archivo de ejemplo. Inténtalo de nuevo.");
  const blob = await res.blob();
  return new File([blob], "datos_ejemplo.csv", { type: "text/csv" });
}

export function friendlyError(err) {
  if (SHOW_REAL_ERRORS) {
    console.error("[api] error real", err);
    const hint = err instanceof TypeError ? ` (sin respuesta del servidor ${API_URL}: apagado, caído, URL equivocada o bloqueo CORS; mira la pestaña Red/Console del navegador)` : "";
    return realError(err) + hint;
  }
  
  if (err instanceof TypeError) {
    console.error("[api] sin respuesta del servidor", API_URL, err);
    return `${MSG_CONNECTION} (Servidor: ${API_URL}. Si es tu equipo, confirma que el backend esté encendido; si es Render, que haya terminado de desplegar.)`;
  }
  return err.message || MSG_GENERIC;
}