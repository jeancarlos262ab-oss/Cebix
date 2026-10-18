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