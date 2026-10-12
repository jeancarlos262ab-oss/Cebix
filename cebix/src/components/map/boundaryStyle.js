/**
 * Contorno de los estados de estudio (Hidalgo, Puebla y Tlaxcala) con el color de acento de la app.
 * Archivo ÚNICO y reciclado: lo usan Mapa satelital (ParcelMapGL / ParcelMapLite) y Parcela satelital
 * (GlobeMapGL / GeometryMap), tanto en MapLibre como en Leaflet. Para cambiar el trazo se toca solo aquí.
 */
export const BOUNDARY_WEIGHT = 2;
export const BOUNDARY_OPACITY = 0.85;
/** Guion en píxeles: 10 px de trazo, 8 px de hueco. */
export const BOUNDARY_DASH = [10, 8];

/** Estilo para `<GeoJSON style>` de Leaflet. */
export const boundaryLeafletStyle = (accentHex) => ({
  color: accentHex,
  weight: BOUNDARY_WEIGHT,
  opacity: BOUNDARY_OPACITY,
  dashArray: BOUNDARY_DASH.join(","),
  fillOpacity: 0,
});

/** `paint` de una capa "line" de MapLibre (ahí el guion se mide en múltiplos del ancho de línea). */
export const boundaryGLPaint = (accentHex) => ({
  "line-color": accentHex,
  "line-width": BOUNDARY_WEIGHT,
  "line-opacity": BOUNDARY_OPACITY,
  "line-dasharray": BOUNDARY_DASH.map((d) => d / BOUNDARY_WEIGHT),
});
