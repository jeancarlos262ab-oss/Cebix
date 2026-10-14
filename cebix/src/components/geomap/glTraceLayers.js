/**
 * Dibujo de la parcela NATIVO de MapLibre: una fuente GeoJSON y capas de línea/relleno dentro del propio
 * mapa (contorno, malla y relleno de "superficie excedida"). Se proyectan y recortan con el mapa, giran con
 * el globo y no necesitan un SVG aparte reproyectado en cada cuadro.
 *
 * Mismo estilo que Leaflet (parcelStyle.js): trazo blanco (rojo si pasa la superficie máxima) con el grosor
 * de contorno y de malla compartidos. Las capas de MapLibre no tienen el modo "difference" de Leaflet.
 */
import { toGeoJSONPolygon } from "../../utils/polygon";
import { EXPORT_COLOR, EXPORT_DASH, EXPORT_WEIGHT, GRID_WEIGHT, OUTLINE_WEIGHT, OVER_LIMIT_COLOR, OVER_LIMIT_FILL_OPACITY, traceColor } from "./parcelStyle";

const SRC = "parcel-trace";
const LAYERS = ["parcel-fill", "parcel-grid", "parcel-outline", "parcel-export"];
const ROUND = { "line-join": "round", "line-cap": "round" };
const EMPTY = { type: "FeatureCollection", features: [] };

const lngLat = (p) => [p[1], p[0]];
const feature = (kind, geometry) => ({ type: "Feature", properties: { kind }, geometry });

/** state = { points: [lat,lng][], closed, grid: [lat,lng][][], overLimit } → GeoJSON. */
function toGeoJSON({ points, closed, grid, overLimit }) {
  const features = [];
  const ring = points.map(lngLat);
  const polygon = closed && points.length >= 3;
  if (polygon && overLimit) features.push(feature("fill", { type: "Polygon", coordinates: [[...ring, ring[0]]] }));
  if (points.length >= 2) {
    features.push(
      feature("outline", { type: "LineString", coordinates: polygon ? [...ring, ring[0]] : ring }),
    );
  }
  // Mismo anillo (redondeado a 6 decimales) que sale en el GeoJSON descargado y que recibe el cálculo.
  if (polygon) features.push(feature("export", { type: "LineString", coordinates: toGeoJSONPolygon(points).coordinates[0] }));
  if (polygon && grid.length) {
    features.push(feature("grid", { type: "MultiLineString", coordinates: grid.map((l) => l.map(lngLat)) }));
  }
  return { type: "FeatureCollection", features };
}

/**
 * @param map  maplibregl.Map
 * @returns {{set(state): void, destroy(): void}}
 */
export function createTraceLayers(map) {
  let state = { points: [], closed: false, grid: [], overLimit: false };
  let alive = true;

  const kind = (k) => ["==", ["get", "kind"], k];

  function add() {
    if (!alive || map.getSource(SRC)) return;
    map.addSource(SRC, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "parcel-fill",
      type: "fill",
      source: SRC,
      filter: kind("fill"),
      paint: { "fill-color": OVER_LIMIT_COLOR, "fill-opacity": OVER_LIMIT_FILL_OPACITY },
    });
    map.addLayer({ id: "parcel-grid", type: "line", source: SRC, filter: kind("grid"), layout: ROUND, paint: { "line-color": "#fff", "line-width": GRID_WEIGHT } });
    map.addLayer({ id: "parcel-outline", type: "line", source: SRC, filter: kind("outline"), layout: ROUND, paint: { "line-color": "#fff", "line-width": OUTLINE_WEIGHT } });
    map.addLayer({
      id: "parcel-export",
      type: "line",
      source: SRC,
      filter: kind("export"),
      layout: { "line-join": "round", "line-cap": "butt" },
      paint: { "line-color": EXPORT_COLOR, "line-width": EXPORT_WEIGHT, "line-dasharray": [EXPORT_DASH[0] / EXPORT_WEIGHT, EXPORT_DASH[1] / EXPORT_WEIGHT] },
    });
    paint();
  }

  function paint() {
    if (!alive || !map.getSource(SRC)) return;
    const color = traceColor(state.overLimit);
    map.getSource(SRC).setData(toGeoJSON(state));
    map.setPaintProperty("parcel-grid", "line-color", color);
    map.setPaintProperty("parcel-outline", "line-color", color);
  }

  if (map.isStyleLoaded()) add();
  else map.once("style.load", add);

  return {
    set(next) {
      state = { ...state, ...next };
      paint();
    },
    destroy() {
      alive = false;
      try {
        for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // el mapa ya se liberó
      }
    },
  };
}
