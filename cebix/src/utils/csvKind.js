export async function detectKind(file) {
  const head = await file.slice(0, 4096).text();
  if (!(head.includes("fecha_captura") && head.includes("porcentaje_nubosidad") && head.includes("sensor"))) return "otro";
  return head.includes("msavi_promedio") ? "planet" : "basico";
}