/**
 * EJEMPLO ILUSTRATIVO del Paso 8 de la guía (validación del cálculo en vivo contra
 * features_completo.csv). Las cifras son inventadas para mostrar el diseño de la tabla.
 * Cuando corras la validación real, reemplaza `VALIDATION_DEMO` con su salida:
 *   [{ id, official: { <feature_key>: n }, gee: { <feature_key>: n } }, ...]
 */
const BASE = {
  precip_acum_emergencia_macollamiento_mm: 142,
  bas_n_obs_ciclo: 54,
  bas_lai_espigado_llenado: 2.1,
  bas_ndti_emergencia_macollamiento: 0.082,
  bas_sti_encanado: 1.17,
  bas_ndvi_emergencia_macollamiento: 0.56,
  bas_ndwi_espigado_llenado: 0.19,
  bas_ndti_encanado: 0.071,
  bas_evi_emergencia_macollamiento: 0.36,
  bas_evi_encanado: 0.42,
};
const KEYS = Object.keys(BASE);

// Variación de cada parcela respecto a la base y diferencia (%) del cálculo en vivo, por variable.
const PARCELS = [
  { id: "Ejemplo 1", scale: 0.94, diff: [2.1, 18.5, -3.4, 6.2, 0.8, -1.9, 4.5, 8.8, -2.2, 1.4] },
  { id: "Ejemplo 2", scale: 1.08, diff: [-1.6, -9.3, 5.1, -17.4, 1.2, 3.3, -6.8, 4.1, 2.9, -3.7] },
  { id: "Ejemplo 3", scale: 1.0, diff: [3.4, 4.0, 1.9, 2.2, -0.4, 0.7, 9.6, -5.5, 1.1, 2.6] },
  { id: "Ejemplo 4", scale: 0.88, diff: [-4.9, 26.1, -7.8, 11.3, 2.5, -4.6, 12.2, 7.4, -8.1, -5.9] },
  { id: "Ejemplo 5", scale: 1.15, diff: [0.9, -3.2, 2.4, -1.1, 0.3, 1.6, -2.0, 3.9, 0.6, 1.8] },
];

export const VALIDATION_DEMO = PARCELS.map(({ id, scale, diff }) => {
  const official = {};
  const gee = {};
  KEYS.forEach((k, i) => {
    const o = BASE[k] * (k === "bas_n_obs_ciclo" ? 1 : scale);
    official[k] = Number(o.toFixed(4));
    gee[k] = Number((o * (1 + diff[i] / 100)).toFixed(4));
  });
  return { id, official, gee };
});
