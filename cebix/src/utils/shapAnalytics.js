import { globalImportance as baseGlobalImportance } from "../data/shap";

/**
 * Calcula la importancia global (media de |SHAP|) a partir de los SHAP locales
 * REALES de cada parcela visible en la app (las 197 del reto + las que el
 * usuario agregue a mano o por CSV, ver `approximateShap` en ParcelsContext).
 *
 * No es un valor fijo copiado de un notebook: si se agregan, editan o borran
 * parcelas, este cálculo cambia porque se vuelve a hacer sobre la lista
 * `parcels` actual. Si una variable no aparece entre los principales drivers
 * de ninguna parcela visible (las parcelas solo guardan sus 4 variables con
 * mayor |SHAP|), se conserva como respaldo el valor base reportado por el
 * modelo entrenado (src/data/shap.js) para no perder cobertura de las 12
 * variables del modelo.
 */
export function computeGlobalImportance(parcels) {
  const signedSum = new Map();
  const absSum = new Map();
  const seen = new Set();

  for (const parcel of parcels) {
    for (const driver of parcel.shap ?? []) {
      signedSum.set(driver.feature, (signedSum.get(driver.feature) ?? 0) + driver.impact);
      absSum.set(driver.feature, (absSum.get(driver.feature) ?? 0) + Math.abs(driver.impact));
      seen.add(driver.feature);
    }
  }

  const n = parcels.length || 1;

  return baseGlobalImportance
    .map((base) => {
      if (!seen.has(base.feature)) return base;
      const value = Number((absSum.get(base.feature) / n).toFixed(3));
      const direction = (signedSum.get(base.feature) ?? 0) >= 0 ? "positivo" : "negativo";
      return { feature: base.feature, value, direction };
    })
    .sort((a, b) => b.value - a.value);
}

/** Cuenta real de parcelas de entrenamiento visibles (las 138 del reto; las
 * parcelas agregadas a mano nunca son `isTrainingSet`, ver ParcelsContext). */
export function countTrainingParcels(parcels) {
  return parcels.filter((p) => p.isTrainingSet).length;
}
