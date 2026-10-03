/**
 * Estadísticas del dashboard calculadas sobre las parcelas de la corrida actual del modelo
 * (lo que devolvió la API). Nada de esto es un valor fijo: si cambian las parcelas, cambia el resultado.
 */

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

/** Rendimiento estimado promedio y máximo por estado. */
export function yieldByRegion(parcels) {
  const groups = new Map();
  for (const p of parcels) {
    if (!Number.isFinite(p.yieldEstimate)) continue;
    const list = groups.get(p.region) ?? [];
    list.push(p.yieldEstimate);
    groups.set(p.region, list);
  }
  return [...groups.entries()]
    .map(([label, values]) => ({
      label,
      mean: Number(mean(values).toFixed(2)),
      max: Number(Math.max(...values).toFixed(2)),
      count: values.length,
    }))
    .sort((a, b) => b.mean - a.mean);
}

/** Histograma del rendimiento estimado: cuántas parcelas caen en cada rango de `step` ton/ha. */
export function yieldHistogram(parcels, step = 0.5) {
  const values = parcels.map((p) => p.yieldEstimate).filter(Number.isFinite);
  if (!values.length) return [];
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.max(Math.ceil(Math.max(...values) / step) * step, lo + step);
  const bins = [];
  for (let start = lo; start < hi - 1e-9; start += step) {
    const end = start + step;
    bins.push({
      label: `${start.toFixed(1)}–${end.toFixed(1)}`,
      value: values.filter((v) => v >= start && (v < end || (end >= hi - 1e-9 && v <= end))).length,
    });
  }
  return bins;
}

/** Mínimo, máximo y rango del rendimiento estimado. */
export function yieldRange(parcels) {
  const values = parcels.map((p) => p.yieldEstimate).filter(Number.isFinite);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, spread: max - min };
}
