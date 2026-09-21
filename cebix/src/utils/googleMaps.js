/**
 * Helpers para "trasladar" una vista del mapa interno a Google Maps.
 *
 * Se usa el endpoint público de Google Maps URLs (api=1), que no requiere
 * API key y funciona igual en escritorio y móvil (en móvil, si la app de
 * Google Maps está instalada, el navegador ofrece abrirla directamente).
 */

/**
 * Construye la URL de Google Maps para unas coordenadas dadas.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ zoom?: number }} [options]
 * @returns {string}
 */
export function getGoogleMapsUrl(lat, lng, { zoom } = {}) {
  const query = `${lat},${lng}`;
  const zoomParam = zoom ? `&zoom=${Math.round(zoom)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${zoomParam}`;
}

/**
 * Abre Google Maps en una pestaña nueva, centrado en las coordenadas dadas.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ zoom?: number }} [options]
 */
export function openInGoogleMaps(lat, lng, options = {}) {
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return;
  }
  const url = getGoogleMapsUrl(lat, lng, options);
  window.open(url, "_blank", "noopener,noreferrer");
}
