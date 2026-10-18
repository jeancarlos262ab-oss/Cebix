function getGoogleMapsUrl(lat, lng, { zoom } = {}) {
  const query = `${lat},${lng}`;
  const zoomParam = zoom ? `&zoom=${Math.round(zoom)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${zoomParam}`;
}

export function openInGoogleMaps(lat, lng, options = {}) {
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return;
  }
  const url = getGoogleMapsUrl(lat, lng, options);
  window.open(url, "_blank", "noopener,noreferrer");
}