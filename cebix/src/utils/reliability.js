/**
 * Aviso de "fuera de rango": la parcela queda fuera de lo que el modelo vio al entrenar.
 * - Si la parcela trae `avisos` (los calcula el backend con lluvia, ubicación y estado), se usan tal cual.
 * - Si no (parcelas guardadas antes, CSV subidos desde el panel), se revisan estado y ubicación con el `dominio` que
 *   publica GET /model-info. La lluvia no se revisa ahí: en parcelas guardadas su significado puede variar.
 */
export function parcelWarnings(parcel, dominio) {
  if (!parcel) return [];
  if (Array.isArray(parcel.avisos)) return parcel.avisos;
  if (Array.isArray(parcel.satelite?.avisos_dominio)) return parcel.satelite.avisos_dominio;
  if (!dominio) return [];

  const out = [];
  const estado = parcel.region;
  if (estado && !dominio.estados?.includes(estado)) {
    out.push(`El estado «${estado}» no estuvo en el entrenamiento (solo ${dominio.estados?.join(", ")}).`);
  }
  const { lat, lng } = parcel;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const g = dominio.margenGrados ?? 0.15;
    const [la0, la1] = dominio.lat;
    const [ln0, ln1] = dominio.lng;
    if (lat < la0 - g || lat > la1 + g || lng < ln0 - g || lng > ln1 + g) {
      out.push("La parcela está lejos de la zona donde se entrenó el modelo (oriente de Hidalgo / norte de Puebla / Tlaxcala).");
    }
  }
  return out;
}
