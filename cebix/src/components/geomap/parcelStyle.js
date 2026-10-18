const TRACE_COLOR = "#fff";

export const OVER_LIMIT_COLOR = "#ef4444";
export const OVER_LIMIT_FILL_OPACITY = 0.18;

export const OUTLINE_WEIGHT = 2.5;

export const EXPORT_COLOR = "#22d3ee";
export const EXPORT_WEIGHT = 2;
export const EXPORT_DASH = [6, 5]; 
export const EXPORT_LABEL = "Contorno que se descarga";
export const GRID_WEIGHT = 1;

export const traceBlend = (overLimit) => (overLimit ? "normal" : "difference");
export const traceColor = (overLimit) => (overLimit ? OVER_LIMIT_COLOR : TRACE_COLOR);

export const IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const IMAGERY_CREDIT = "Imagen: Esri, Maxar, Earthstar Geographics";

export const STUDY_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];
export const STUDY = { lat: 19.6, lon: -98.1 };

export function vertexLook(closeTarget, color = TRACE_COLOR) {
  return {
    size: closeTarget ? 20 : 10,
    css: closeTarget
      ? `border:2.5px solid ${color};background:transparent`
      : `border:1.5px solid rgba(0,0,0,.45);background:${color}`,
  };
}

export function drawStatus({ locked, drawing, ready, closed, count }) {
  if (locked) return "Calculando índices… la parcela queda bloqueada";
  if (drawing) {
    return ready
      ? "Sigue marcando vértices · toca el círculo hueco del primer punto o 'Terminar' para cerrar"
      : `Haz clic en el mapa para marcar los vértices (${count}/3 mínimo)`;
  }
  if (closed) return "Arrastra los vértices para ajustar el contorno";
  return null;
}

export const statusDot = ({ locked, drawing }) =>
  locked ? "animate-pulse bg-amber-400" : drawing ? "bg-white" : "bg-white/40";