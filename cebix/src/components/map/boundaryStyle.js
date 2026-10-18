export const BOUNDARY_WEIGHT = 2;
export const BOUNDARY_OPACITY = 0.85;

export const BOUNDARY_DASH = [10, 8];

export const boundaryLeafletStyle = (accentHex) => ({
  color: accentHex,
  weight: BOUNDARY_WEIGHT,
  opacity: BOUNDARY_OPACITY,
  dashArray: BOUNDARY_DASH.join(","),
  fillOpacity: 0,
});

export const boundaryGLPaint = (accentHex) => ({
  "line-color": accentHex,
  "line-width": BOUNDARY_WEIGHT,
  "line-opacity": BOUNDARY_OPACITY,
  "line-dasharray": BOUNDARY_DASH.map((d) => d / BOUNDARY_WEIGHT),
});