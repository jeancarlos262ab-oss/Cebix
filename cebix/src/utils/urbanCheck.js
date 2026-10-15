/**
 * Detecta si un contorno dibujado cae sobre una ciudad o un pueblo, con datos de OpenStreetMap (Overpass API).
 *
 * Dos señales:
 *   1) Mancha urbana: polígonos landuse = residential / commercial / industrial / retail / construction.
 *      Se pregunta al servidor `is_in` (¿este punto cae dentro de una mancha urbana?) para unos cuantos puntos de muestra.
 *      Así no se descarga la geometría de ciudades enteras (megabytes): la respuesta son unos cuantos contadores.
 *   2) Otras señales de poblado, para los pueblos que en OSM no tienen mancha urbana dibujada: construcciones (y su
 *      densidad por hectárea), un poblado marcado (place=village…), calles urbanas y comercios/escuelas/iglesias.
 *
 * Los dos servidores públicos se consultan A LA VEZ y gana el primero que responde.
 * Si ninguno responde se lanza un Error: quien llama decide qué hacer (la pantalla avisa pero no bloquea).
 */
import { API_URL } from "../services/modelApi";
import { areaHa, sampleInside } from "./polygon";
import {
  URBAN_BUILDINGS_PER_HA,
  URBAN_MAX_SHARE,
  URBAN_MIN_AMENITIES,
  URBAN_MIN_BUILDINGS,
  URBAN_MIN_PLACES,
  URBAN_MIN_STREETS,
} from "../data/satelite";

// Primero el proxy del backend (POST /overpass): no tiene CORS y prueba varios espejos del lado del servidor. Los
// servidores públicos se dejan como respaldo en paralelo (gana el primero que responde). overpass.kumi.systems y
// overpass.private.coffee ya no se llaman desde el navegador: no mandan cabeceras CORS ("blocked by CORS policy").
const PROXY = `${API_URL}/overpass`;
const ENDPOINTS = [PROXY, "https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const TIMEOUT_MS = 20000;
const ROUNDS = 2; // rondas completas sobre todos los servidores
const RETRY_DELAY_MS = 1500;
const PLACES = "^(city|town|village|hamlet|suburb|neighbourhood|quarter)$";
const TOWN_STREETS = "^(residential|living_street|pedestrian)$";
const URBAN_LANDUSE = "^(residential|commercial|industrial|retail|construction)$";
const MAX_ZONE_SAMPLES = 20; // puntos de muestra dentro del contorno (cada uno es un is_in barato)

const cache = new Map();

const fix = (n) => n.toFixed(6);
/** Un `is_in` + conteo de manchas urbanas que contienen el punto. Genera UN elemento `count` en la respuesta. */
const landuseCount = ([lat, lng], k) => `is_in(${fix(lat)},${fix(lng)})->.a${k};\narea.a${k}["landuse"~"${URBAN_LANDUSE}"];\nout count;`;
/** Total de un elemento `count`: Overpass lo entrega como texto en tags.total. */
const countOf = (el) => Number(el?.tags?.total ?? 0) || 0;

/** Reparte hasta `max` puntos de la lista de forma pareja. */
function spread(list, max) {
  if (list.length <= max) return list;
  const step = list.length / max;
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]);
}

/** Consulta del contorno completo: un conteo de mancha urbana por muestra + señales de poblado dentro del polígono. */
export function buildQuery(points, samples = spread(sampleInside(points), MAX_ZONE_SAMPLES)) {
  const poly = points.map(([lat, lng]) => `${fix(lat)} ${fix(lng)}`).join(" ");
  const inPoly = `(poly:"${poly}")`;
  return `[out:json][timeout:15];
${samples.map(landuseCount).join("\n")}
way["building"]${inPoly};
out count;
nwr["place"~"${PLACES}"]${inPoly};
out count;
way["highway"~"${TOWN_STREETS}"]${inPoly};
out count;
(nwr["amenity"]${inPoly}; nwr["shop"]${inPoly};);
out count;`;
}

/** Aplica las reglas a la respuesta de Overpass. Pura: se puede probar sin red. */
export function evaluate(points, elements, samplesUsed = spread(sampleInside(points), MAX_ZONE_SAMPLES).length) {
  const counts = elements.filter((el) => el.type === "count");
  const inUrban = counts.slice(0, samplesUsed).filter((c) => countOf(c) > 0).length;
  const share = samplesUsed ? inUrban / samplesUsed : 0;

  const buildings = countOf(counts[samplesUsed]);
  const places = countOf(counts[samplesUsed + 1]);
  const streets = countOf(counts[samplesUsed + 2]);
  const amenities = countOf(counts[samplesUsed + 3]);
  const ha = areaHa(points);
  const perHa = ha > 0 ? buildings / ha : 0;

  let reason = null;
  if (share >= URBAN_MAX_SHARE) reason = "landuse";
  else if (places >= URBAN_MIN_PLACES) reason = "place";
  else if (streets >= URBAN_MIN_STREETS) reason = "streets";
  else if (buildings >= URBAN_MIN_BUILDINGS && perHa >= URBAN_BUILDINGS_PER_HA) reason = "buildings";
  else if (amenities >= URBAN_MIN_AMENITIES) reason = "amenities";
  return { urban: reason !== null, reason, share, buildings, places, streets, amenities, perHa };
}

/**
 * Consulta los servidores a la vez y devuelve la respuesta del primero que conteste bien.
 * Antes se probaban uno tras otro con 25 s de espera cada uno: si el primero se colgaba, tardaba casi un minuto.
 */
async function overpass(query, signal) {
  let controllers = ENDPOINTS.map(() => new AbortController()); // se renuevan en cada ronda
  const stopAll = () => controllers.forEach((c) => c.abort());
  if (signal?.aborted) throw Object.assign(new Error("Cancelado"), { name: "AbortError" });
  signal?.addEventListener("abort", stopAll, { once: true });

  const attempt = async (url, i) => {
    const timer = setTimeout(() => controllers[i].abort(), TIMEOUT_MS);
    try {
      const viaProxy = url === PROXY;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": viaProxy ? "application/json" : "application/x-www-form-urlencoded" },
        body: viaProxy ? JSON.stringify({ query }) : `data=${encodeURIComponent(query)}`,
        signal: controllers[i].signal,
      });
      if (!res.ok) throw new Error(`Overpass respondió ${res.status}.`);
      const json = await res.json();
      if (json.remark && /error|timed out|out of memory/i.test(json.remark) && !json.elements?.length) throw new Error(json.remark);
      return json.elements ?? [];
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let lastErr;
    for (let round = 0; round < ROUNDS; round++) {
      try {
        controllers = ENDPOINTS.map(() => new AbortController());
        return await Promise.any(ENDPOINTS.map(attempt));
      } catch (err) {
        if (signal?.aborted) throw Object.assign(new Error("Cancelado"), { name: "AbortError" });
        lastErr = err instanceof AggregateError ? err.errors[0] ?? new Error("Overpass no respondió.") : err;
        console.warn(`Overpass: ronda ${round + 1}/${ROUNDS} sin respuesta`, err instanceof AggregateError ? err.errors : err);
        controllers.forEach((c) => c.abort());
        if (round < ROUNDS - 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    throw lastErr;
  } finally {
    stopAll(); // cancela al servidor que quedó atrás
    signal?.removeEventListener("abort", stopAll);
  }
}

/**
 * @param {[number, number][]} points contorno [lat, lng][]
 * @returns {Promise<{urban: boolean, reason: "landuse"|"buildings"|null, share: number, buildings: number, perHa: number}>}
 */
export async function checkUrban(points, { signal } = {}) {
  const key = points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(";");
  if (cache.has(key)) return cache.get(key);
  const samples = spread(sampleInside(points), MAX_ZONE_SAMPLES);
  const elements = await overpass(buildQuery(points, samples), signal);
  const result = evaluate(points, elements, samples.length);
  cache.set(key, result);
  return result;
}

// ── Verificación de un solo vértice (se usa mientras se dibuja) ─────────────────────────────────────────────────
const POINT_BUILDING_RADIUS_M = 80;
const POINT_MIN_BUILDINGS = 3; // una bodega o un corral aislados no cuentan como pueblo
const POINT_PLACE_RADIUS_M = 150;
const POINT_STREET_RADIUS_M = 40;
const pointCache = new Map();

export function buildPointQuery(point) {
  const [lat, lng] = [fix(point[0]), fix(point[1])];
  return `[out:json][timeout:8];
${landuseCount(point, 0)}
way["building"](around:${POINT_BUILDING_RADIUS_M},${lat},${lng});
out count;
nwr["place"~"${PLACES}"](around:${POINT_PLACE_RADIUS_M},${lat},${lng});
out count;
way["highway"~"${TOWN_STREETS}"](around:${POINT_STREET_RADIUS_M},${lat},${lng});
out count;`;
}

/** Aplica las reglas a un vértice. Pura: se puede probar sin red. */
export function evaluatePoint(_point, elements) {
  const counts = elements.filter((el) => el.type === "count");
  const buildings = countOf(counts[1]);
  let reason = null;
  if (countOf(counts[0]) > 0) reason = "landuse";
  else if (countOf(counts[2]) > 0) reason = "place";
  else if (countOf(counts[3]) > 0) reason = "streets";
  else if (buildings >= POINT_MIN_BUILDINGS) reason = "buildings";
  return { urban: reason !== null, reason, buildings };
}

/**
 * ¿Este vértice cae sobre una ciudad o un pueblo?
 * @param {[number, number]} point [lat, lng]
 */
export async function checkPointUrban(point, { signal } = {}) {
  const key = `${point[0].toFixed(5)},${point[1].toFixed(5)}`;
  if (pointCache.has(key)) return pointCache.get(key);
  const elements = await overpass(buildPointQuery(point), signal);
  const result = evaluatePoint(point, elements);
  pointCache.set(key, result);
  return result;
}
