/**
 * Diseño y textos del dibujo de la parcela, COMPARTIDOS por el mapa plano (Leaflet, GeometryMap.jsx) y el
 * globo/mapa de MapLibre (GlobeMapGL.jsx). La referencia visual es la de Leaflet: cualquier cambio de
 * trazo, malla, vértices o mensajes se hace AQUÍ y se ve igual en los dos motores.
 */

/** Color del contorno, la malla y los vértices (se dibujan en modo "difference": invierten la imagen de abajo). */
const TRACE_COLOR = "#fff";
/** Color de contorno, malla y vértices cuando la parcela pasa la superficie máxima (modo de mezcla normal). */
export const OVER_LIMIT_COLOR = "#ef4444";
export const OVER_LIMIT_FILL_OPACITY = 0.18;

export const OUTLINE_WEIGHT = 2.5;

/** Contorno EXACTO que se descarga / se envía al cálculo (toGeoJSONPolygon): trazo punteado sobre el dibujo. */
export const EXPORT_COLOR = "#22d3ee";
export const EXPORT_WEIGHT = 2;
export const EXPORT_DASH = [6, 5]; // px: trazo, hueco
export const EXPORT_LABEL = "Contorno que se descarga";
export const GRID_WEIGHT = 1;

/** Modo de mezcla de todo el dibujo de la parcela. */
export const traceBlend = (overLimit) => (overLimit ? "normal" : "difference");
export const traceColor = (overLimit) => (overLimit ? OVER_LIMIT_COLOR : TRACE_COLOR);

// El contorno de los estados vive en components/map/boundaryStyle.js (compartido con Mapa satelital).

/** Imagen satelital base de ambos mapas. */
export const IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const IMAGERY_CREDIT = "Imagen: Esri, Maxar, Earthstar Geographics";

/** Zona de estudio: Hidalgo, Tlaxcala y Puebla. Límites [[s,w],[n,e]] y centro. */
export const STUDY_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];
export const STUDY = { lat: 19.6, lon: -98.1 };

/**
 * Vértice: círculo relleno. Solo el primero, cuando ya se puede cerrar el polígono (`closeTarget`), es un
 * anillo hueco y más grande, para que se note que ahí hay que hacer clic.
 * @returns {{size: number, css: string}}  `css` va dentro de un elemento de `size` × `size` px
 */
export function vertexLook(closeTarget, color = TRACE_COLOR) {
  return {
    size: closeTarget ? 20 : 10,
    css: closeTarget
      ? `border:2.5px solid ${color};background:transparent`
      : `border:1.5px solid rgba(0,0,0,.45);background:${color}`,
  };
}

/** Mensaje de estado bajo el mapa mientras se dibuja (igual en los dos motores). Devuelve null si no aplica. */
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

/** Punto de color del mensaje de estado. */
export const statusDot = ({ locked, drawing }) =>
  locked ? "animate-pulse bg-amber-400" : drawing ? "bg-white" : "bg-white/40";
