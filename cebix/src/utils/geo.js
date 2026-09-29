/**
 * Utilidades geográficas para el panel de información del mapa.
 */

const EARTH_RADIUS_M = 6371008.8;

/** Metros por píxel en la latitud/zoom dados. tileSize: 512 (MapLibre) o 256 (Leaflet). */
export function metersPerPixel(lat, zoom, tileSize = 512) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (tileSize * 2 ** zoom);
}

/** Distancia en metros entre dos puntos (haversine). */
export function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

/** Longitud normalizada a [-180, 180] (el mapa puede dar valores fuera al dar la vuelta). */
export function wrapLng(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function formatDecimal(lat, lng, digits = 5) {
  return `${lat.toFixed(digits)}°, ${wrapLng(lng).toFixed(digits)}°`;
}

function toDMS(value, positive, negative) {
  const hemi = value >= 0 ? positive : negative;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${deg}°${String(min).padStart(2, "0")}′${sec.toFixed(1).padStart(4, "0")}″${hemi}`;
}

export function formatDMS(lat, lng) {
  return `${toDMS(lat, "N", "S")} ${toDMS(wrapLng(lng), "E", "W")}`;
}

/** Coordenadas UTM (WGS84). Devuelve { zone, band, easting, northing }. */
export function toUTM(lat, lng) {
  lng = wrapLng(lng);
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const zone = Math.floor((lng + 180) / 6) + 1;
  const lon0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lam - lon0);
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));

  const easting =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500000;
  let northing =
    k0 *
    (M +
      N *
        Math.tan(phi) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  if (lat < 0) northing += 10000000;

  const band = "CDEFGHJKLMNPQRSTUVWX"[Math.max(0, Math.min(19, Math.floor((lat + 80) / 8)))];
  return { zone, band, easting, northing };
}

export function formatUTM(lat, lng) {
  const { zone, band, easting, northing } = toUTM(lat, lng);
  return `${zone}${band} ${Math.round(easting)} E ${Math.round(northing)} N`;
}

/** Barra de escala "redonda": devuelve { px, label } con un ancho máximo de maxPx. */
export function niceScale(mpp, maxPx = 96) {
  if (!mpp || !Number.isFinite(mpp)) return { px: 0, label: "" };
  const maxMeters = mpp * maxPx;
  const pow = 10 ** Math.floor(Math.log10(maxMeters));
  const step = [5, 2, 1].find((m) => m * pow <= maxMeters) ?? 1;
  const meters = step * pow;
  return {
    px: meters / mpp,
    label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
  };
}
