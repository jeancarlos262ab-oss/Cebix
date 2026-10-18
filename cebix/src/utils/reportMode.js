// Modo con el que se calculó una parcela ("lluvia" o "10var") y los textos que el PDF
// debe mostrar para cada uno. `modo` es null cuando el registro no lo guardó
// (captura manual, CSV propio o corridas anteriores a este cambio).

export const MODE_LABEL = { lluvia: "Solo lluvia", "10var": "10 variables", ciclo: "Ciclo completo" };

export const MODE_DESC = {
  lluvia: "Lluvia de abril-mayo (CHIRPS)",
  "10var": "Lluvia + índices Sentinel-2/Landsat",
  ciclo: "Lluvia de las 3 etapas, abril-octubre (CHIRPS)",
};

export function reportMode(parcel) {
  const m = parcel?.modo ?? parcel?.satelite?.modo ?? null;
  return m === "lluvia" || m === "10var" || m === "ciclo" ? m : null;
}

// Nota metodológica según el modo, con las métricas de validación de ese modelo.
export function modeModelNote(modo, modelSummary, modelModes) {
  const m = modo ? modelModes?.[modo] : null;
  if (modo === "lluvia") {
    const rmse = m?.rmse ?? modelSummary?.rmse;
    return (
      "Calculado en modo Solo lluvia: Random Forest con una sola variable, la lluvia de abril-mayo (CHIRPS, ~5 km), que es la etapa de emergencia-macollamiento del ciclo abril-octubre; la lluvia de las etapas posteriores no mejoró la validación." +
      (rmse != null ? ` RMSE de validación ${rmse} ton/ha.` : "") +
      " No usa NDVI, EVI ni GDD, ni considera variedad, riego, fertilización o suelo."
    );
  }
  if (modo === "10var") {
    return (
      "Calculado en modo 10 variables: lluvia de abril-mayo más índices Sentinel-2/Landsat del ciclo abril-octubre." +
      (m?.rmse != null ? ` RMSE de validación ${m.rmse} ton/ha (con solo lluvia: ${modelModes?.lluvia?.rmse ?? modelSummary?.rmse} ton/ha).` : "") +
      " La lluvia sigue siendo la variable dominante."
    );
  }
  if (modo === "ciclo") {
    return (
      "Calculado en modo Ciclo completo: Random Forest con la lluvia CHIRPS de las tres etapas del ciclo abril-octubre, sin índices satelitales." +
      (m?.rmse != null ? ` RMSE de validación ${m.rmse} ton/ha (solo lluvia abril-mayo: ${modelModes?.lluvia?.rmse ?? modelSummary?.rmse}).` : "") +
      " Abril-mayo concentra casi todo el peso."
    );
  }
  return modelSummary
    ? `El rendimiento se estimó con ${modelSummary.modelName} (${modelSummary.validation}; RMSE ${modelSummary.rmse} ton/ha). El modo de cálculo no quedó registrado en esta parcela.`
    : "El rendimiento se estimó con el modelo predictivo de CEBIX. El modo de cálculo no quedó registrado en esta parcela.";
}

export const MODE_CAVEAT = {
  lluvia: " Con solo lluvia la estimación distingue zonas (celdas de ~5 km), no parcelas vecinas.",
  ciclo: " Con solo lluvia (de las tres etapas) la estimación distingue zonas (celdas de ~5 km), no parcelas vecinas.",
  "10var": "",
};

// Lluvia por etapa (mm) de una parcela calculada en modo "ciclo": { enc, esp } o null.
export function stageRain(parcel) {
  const e = parcel?.precipEtapas ?? parcel?.satelite?.etapas;
  const f = parcel?.satelite?.features;
  const enc = e?.enc ?? f?.precip_acum_encanado_mm ?? null;
  const esp = e?.esp ?? f?.precip_acum_espigado_llenado_mm ?? null;
  return enc === null && esp === null ? null : { enc, esp };
}
