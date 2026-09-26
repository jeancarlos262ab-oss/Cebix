/**
 * Genera URLs de imágenes satelitales ESTÁTICAS (un solo PNG, no un mapa
 * interactivo) usando el endpoint público "export" de Esri World_Imagery —
 * el mismo servicio de tiles que ya usa el mapa satelital, así que la vista
 * se ve igual, pero como una foto fija: mucho más ligera de cargar que
 * MapLibre GL / Leaflet y sin controles ni interacción.
 *
 * No requiere API key. Referencia del endpoint:
 * https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export
 */

// Resolución (metros/pixel) en el ecuador a zoom 0, convención estándar de
// mapas tipo "slippy map" (tiles de 256px). Se usa solo para traducir un
// nivel de zoom conocido a un tamaño de recuadro (bbox) en grados.
const BASE_RESOLUTION = 156543.03392804097;
const METERS_PER_DEG_LAT = 111320;

/**
 * @param {{lat: number, lng: number, zoom?: number, width?: number, height?: number, dpr?: number}} options
 * @returns {string} URL de una imagen PNG estática centrada en [lat, lng]
 */
export function buildStaticSatelliteUrl({
  lat,
  lng,
  zoom = 15,
  width = 400,
  height = 200,
  dpr = 1.5,
}) {
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));

  const latRad = (lat * Math.PI) / 180;
  const metersPerPixel = (BASE_RESOLUTION * Math.cos(latRad)) / Math.pow(2, zoom);

  const halfWidthMeters = (w / 2) * metersPerPixel;
  const halfHeightMeters = (h / 2) * metersPerPixel;

  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(latRad);

  const dLat = halfHeightMeters / METERS_PER_DEG_LAT;
  const dLng = halfWidthMeters / metersPerDegLng;

  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(",");

  const params = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${w},${h}`,
    // png24 (sin canal alfa) es más ligero que png32; suficiente para una
    // foto satelital sin transparencia.
    format: "png24",
    f: "image",
  });

  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}
