/**
 * Reconoce por su encabezado si un CSV es el oficial del reto:
 * "planet" (CSV PRO, trae MSAVI), "basico" (Sentinel-2 + Landsat) u "otro".
 * Solo lee los primeros 4 KB, así que sirve para archivos de decenas de MB.
 */
export async function detectKind(file) {
  const head = await file.slice(0, 4096).text();
  if (!(head.includes("fecha_captura") && head.includes("porcentaje_nubosidad") && head.includes("sensor"))) return "otro";
  return head.includes("msavi_promedio") ? "planet" : "basico";
}
