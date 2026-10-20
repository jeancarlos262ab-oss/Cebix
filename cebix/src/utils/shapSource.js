// ¿El desglose SHAP de esta parcela es real (del servidor) o una aproximación del frontend?
// Real: corridas del modelo (CSV), Mapa satelital (trae calculado_en) y .shp con shap_real.
// Aproximado: parcelas capturadas a mano o importadas con .shp antes de guardar el SHAP real.
export function isApproxShap(parcel) {
  if (!parcel || !Array.isArray(parcel.shap) || parcel.shap.length === 0) return false;
  if (parcel.shap.some((s) => s?.real === true)) return false; // calculado por el modelo
  if (parcel.shap.some((s) => s?.approx === true)) return true;
  if (!parcel.isCustom) return false;
  const sat = parcel.satelite;
  return !(sat?.calculado_en || sat?.shap_real);
}

export const APPROX_SHAP_TEXT =
  "SHAP aproximado: esta parcela no trae el desglose real del modelo. Es una estimación a partir de NDVI, EVI y lluvia comparados con el promedio, no un SHAP calculado. Puedes pedirle al modelo el SHAP real con el botón de abajo.";
