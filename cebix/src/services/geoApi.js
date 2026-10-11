/**
 * Cliente de POST /parse-geometry (backend/app/api/geo.py).
 *
 * Manda uno o varios archivos de parcelas (shapefile, GeoJSON, KML/KMZ) y recibe los polígonos ya
 * reproyectados a lat/lng, con área, centroide y, si no se pueden calcular, el motivo (`error`):
 *
 *   { n_poligonos, n_validos, advertencias: string[],
 *     poligonos: [{ ID_POLIGONO, nombre, Estado, Municipio, geometry (Polygon), area_ha, lat, lng,
 *                   vertices, error, origen, propiedades }] }
 *
 * Un shapefile se sube como un .zip, o con sus archivos sueltos (.shp, .dbf, .prj, .shx y .cpg) en la misma
 * petición. Solo el .shp es obligatorio; el .dbf aporta los atributos, el .prj el sistema de coordenadas y el
 * .cpg la codificación de los textos.
 */
import { API_URL, ApiError, errorFromResponse, friendlyError } from "./modelApi";

/** Extensiones que se mandan al backend de geoprocesamiento. */
export const GEO_EXTENSIONS = ["shp", "dbf", "prj", "shx", "cpg", "zip", "geojson", "json", "kml", "kmz"];

export const fileExtension = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
export const isGeoFile = (file) => GEO_EXTENSIONS.includes(fileExtension(file?.name));

const SHAPEFILE_PARTS = ["shp", "dbf", "prj", "shx", "cpg"];
const stemOf = (name = "") => name.replace(/\.[^./\\]+$/, "").toLowerCase();

/**
 * Revisa que los archivos sueltos de un shapefile estén completos antes de subirlos.
 * Devuelve el mensaje de error si falta el .shp (la geometría) y no hay un .zip que lo traiga; null si todo bien.
 */
export function shapefileProblem(files) {
  const parts = files.filter((f) => SHAPEFILE_PARTS.includes(fileExtension(f.name)));
  if (parts.length === 0) return null;
  const hasZip = files.some((f) => ["zip", "kmz"].includes(fileExtension(f.name)));
  const shpStems = new Set(parts.filter((f) => fileExtension(f.name) === "shp").map((f) => stemOf(f.name)));
  if (shpStems.size > 0 || hasZip) return null;
  const names = parts.map((f) => f.name).join(", ");
  return `Falta el archivo .shp (es el que trae la geometría). Recibí: ${names}. Selecciona el .shp junto con su .dbf, .prj, .shx y .cpg (o sube todo en un .zip).`;
}

export async function parseGeometryFiles(files, { signal } = {}) {
  const problem = shapefileProblem(files);
  if (problem) throw new ApiError(problem, { url: `${API_URL}/parse-geometry`, raw: "shapefile incompleto" });
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  const url = `${API_URL}/parse-geometry`;
  let res;
  try {
    res = await fetch(url, { method: "POST", body: form, signal });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(friendlyError(err), { url, raw: String(err) });
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}
