/**
 * Utilidades para la parcela que se dibuja en la pantalla de parcela satelital.
 * Los puntos viajan como [lat, lng] (orden de Leaflet); GeoJSON usa [lng, lat],
 * la conversión se hace solo en toGeoJSONPolygon / parseGeoJSON.
 */
import { haversine } from "./geo";
import estadosBoundaries from "../data/estadosBoundaries.json";
import { formatNumber } from "./intl";

const R = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;

/** Área geodésica aproximada (m²) de un anillo [lat,lng][]. Precisa de sobra para parcelas. */
export function areaM2(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * R * R) / 2);
}

export const areaHa = (points) => areaM2(points) / 10000;

export function perimeterM(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    total += haversine(lat1, lng1, lat2, lng2);
  }
  return total;
}

/** Centroide por área (plano local); si el polígono es degenerado, promedio de vértices. */
export function centroid(points) {
  const n = points.length;
  if (!n) return null;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [y1, x1] = points[i];
    const [y2, x2] = points[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-14) {
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cy / (3 * a), cx / (3 * a)];
}

/** Anillo cerrado en orden [lng, lat], como lo pide GeoJSON y ee.Geometry. */
export function toGeoJSONPolygon(points) {
  const ring = points.map(([lat, lng]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

/**
 * Lee un GeoJSON (Polygon, MultiPolygon, Feature o FeatureCollection) y devuelve el primer
 * anillo exterior como [lat,lng][]. Lanza Error con un mensaje legible si no hay polígono.
 */
export function parseGeoJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const polygons = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === "FeatureCollection") node.features?.forEach(walk);
    else if (node.type === "Feature") walk(node.geometry);
    else if (node.type === "Polygon") polygons.push(node.coordinates);
    else if (node.type === "MultiPolygon") node.coordinates.forEach((c) => polygons.push(c));
  };
  walk(data);
  if (!polygons.length) throw new Error("No encontré ningún polígono en el GeoJSON.");

  let ring = polygons[0][0].map(([lng, lat]) => [lat, lng]);
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
    ring = ring.slice(0, -1);
  }
  if (ring.length < 3) throw new Error("El polígono necesita al menos 3 vértices.");
  if (ring.some(([lat, lng]) => Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    throw new Error("Las coordenadas no están en lat/lng (EPSG:4326). ¿Vienen en UTM?");
  }
  return { points: ring, extra: polygons.length > 1 ? polygons.length - 1 : 0 };
}

function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Estado (Hidalgo / Puebla / Tlaxcala) que contiene el punto, o null si cae fuera de los tres. */
export function detectEstado(lat, lng) {
  for (const f of estadosBoundaries.features) {
    if (pointInRing(lat, lng, f.geometry.coordinates[0])) return f.properties.name;
  }
  return null;
}

/** [[sur, oeste], [norte, este]] de un estado, para centrar el mapa. */
export function estadoBounds(name) {
  const f = estadosBoundaries.features.find((x) => x.properties.name === name);
  if (!f) return null;
  const ring = f.geometry.coordinates[0];
  const lats = ring.map((p) => p[1]);
  const lngs = ring.map((p) => p[0]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** true si dos lados no contiguos se cruzan (polígono "en moño"): el backend lo rechaza o da área absurda. */
export function selfIntersects(points) {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) === 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

export const formatHa = (ha) => (ha < 10 ? ha.toFixed(2) : ha < 100 ? ha.toFixed(1) : formatNumber(Math.round(ha)));
