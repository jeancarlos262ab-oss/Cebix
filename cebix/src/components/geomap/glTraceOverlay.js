/**
 * Dibujo de la parcela sobre MapLibre con el MISMO diseño que Leaflet (ver parcelStyle.js).
 *
 * Las capas de MapLibre viven dentro del canvas WebGL y no admiten el modo de mezcla "difference" que usa
 * Leaflet para que el trazo invierta la imagen de abajo. Por eso el contorno y la malla se dibujan en un SVG
 * encima del mapa (con `mix-blend-mode`), reproyectado con map.project() en cada cuadro.
 */
import { GRID_WEIGHT, OUTLINE_WEIGHT, OVER_LIMIT_FILL_OPACITY, OVER_LIMIT_COLOR, traceBlend, traceColor } from "./parcelStyle";

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/**
 * @param map  maplibregl.Map
 * @returns {{set(state): void, destroy(): void}}  state = { points: [lat,lng][], closed, grid: [lat,lng][][], overLimit }
 */
export function createTraceOverlay(map) {
  const svg = el("svg", { "aria-hidden": "true" });
  svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none";
  const fill = el("path", { fill: "none", stroke: "none" });
  const grid = el("path", { fill: "none", "stroke-width": GRID_WEIGHT, "stroke-linecap": "round", "stroke-linejoin": "round" });
  const outline = el("path", { fill: "none", "stroke-width": OUTLINE_WEIGHT });
  svg.append(fill, grid, outline);
  map.getCanvasContainer().appendChild(svg);

  let state = { points: [], closed: false, grid: [], overLimit: false };

  const pt = (p) => {
    const { x, y } = map.project([p[1], p[0]]);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const line = (pts, close) => (pts.length ? `M${pts.map(pt).join("L")}${close ? "Z" : ""}` : "");

  function draw() {
    const { points, closed, grid: g, overLimit } = state;
    const color = traceColor(overLimit);
    const ready = points.length >= 3;
    svg.style.mixBlendMode = traceBlend(overLimit);
    const polygon = closed && ready;
    outline.setAttribute("stroke", points.length >= 2 ? color : "none");
    outline.setAttribute("stroke-linejoin", polygon ? "miter" : "round");
    outline.setAttribute("stroke-linecap", polygon ? "butt" : "round");
    outline.setAttribute("d", points.length >= 2 ? line(points, polygon) : "");
    fill.setAttribute("fill", polygon && overLimit ? OVER_LIMIT_COLOR : "none");
    fill.setAttribute("fill-opacity", OVER_LIMIT_FILL_OPACITY);
    fill.setAttribute("d", polygon && overLimit ? line(points, true) : "");
    grid.setAttribute("stroke", polygon && g.length ? color : "none");
    grid.setAttribute("d", polygon ? g.map((l) => line(l, false)).join("") : "");
  }

  map.on("render", draw);
  draw();

  return {
    set(next) {
      state = { ...state, ...next };
      draw();
    },
    destroy() {
      map.off("render", draw);
      svg.remove();
    },
  };
}
