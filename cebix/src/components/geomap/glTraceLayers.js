/**
 * Dibujo de la parcela NATIVO de MapLibre: una fuente GeoJSON y capas de línea/relleno dentro del propio
 * mapa (contorno, malla y relleno de "superficie excedida"). Se proyectan y recortan con el mapa, giran con
 * el globo y no necesitan un SVG aparte reproyectado en cada cuadro.
 *
 * Las capas de MapLibre no admiten el modo de mezcla "difference" de Leaflet; para que el trazo blanco se
 * lea sobre cualquier imagen, cada línea lleva debajo un trazo oscuro más ancho (como un borde).
 */
import { GRID_WEIGHT, OUTLINE_WEIGHT, OVER_LIMIT_COLOR, OVER_LIMIT_FILL_OPACITY, traceColor } from "./parcelStyle";

const SRC = "parcel-trace";
const LAYERS = ["parcel-fill", "parcel-grid-casing", "parcel-grid", "parcel-outline-casing", "parcel-outline"];
const CASING = { "line-color": "#000", "line-opacity": 0.35, "line-blur": 0.5 };
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
    map.addLayer({ id: "parcel-grid-casing", type: "line", source: SRC, filter: kind("grid"), layout: ROUND, paint: { ...CASING, "line-width": GRID_WEIGHT + 2 } });
    map.addLayer({ id: "parcel-grid", type: "line", source: SRC, filter: kind("grid"), layout: ROUND, paint: { "line-color": "#fff", "line-width": GRID_WEIGHT } });
    map.addLayer({ id: "parcel-outline-casing", type: "line", source: SRC, filter: kind("outline"), layout: ROUND, paint: { ...CASING, "line-width": OUTLINE_WEIGHT + 2 } });
    map.addLayer({ id: "parcel-outline", type: "line", source: SRC, filter: kind("outline"), layout: ROUND, paint: { "line-color": "#fff", "line-width": OUTLINE_WEIGHT } });
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
