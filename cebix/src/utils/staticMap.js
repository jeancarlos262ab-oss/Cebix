const BASE_RESOLUTION = 156543.03392804097;
const METERS_PER_DEG_LAT = 111320;

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
    
    
    format: "png24",
    f: "image",
  });

  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}