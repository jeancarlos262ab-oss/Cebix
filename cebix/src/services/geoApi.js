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
 * Un shapefile se sube como un .zip, o con sus archivos sueltos (.shp + .dbf + .prj) en la misma petición.
 */
import { API_URL, ApiError, errorFromResponse, friendlyError } from "./modelApi";

/** Extensiones que se mandan al backend de geoprocesamiento. */
export const GEO_EXTENSIONS = ["shp", "dbf", "prj", "shx", "cpg", "zip", "geojson", "json", "kml", "kmz"];

export const fileExtension = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
export const isGeoFile = (file) => GEO_EXTENSIONS.includes(fileExtension(file?.name));

export async function parseGeometryFiles(files, { signal } = {}) {
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
