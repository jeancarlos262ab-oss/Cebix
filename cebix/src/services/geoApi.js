import { API_URL, ApiError, errorFromResponse, friendlyError } from "./modelApi";

const GEO_EXTENSIONS = ["shp", "dbf", "prj", "shx", "cpg", "zip", "geojson", "json", "kml", "kmz"];

const fileExtension = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
export const isGeoFile = (file) => GEO_EXTENSIONS.includes(fileExtension(file?.name));

const SHAPEFILE_PARTS = ["shp", "dbf", "prj", "shx", "cpg"];
const stemOf = (name = "") => name.replace(/\.[^./\\]+$/, "").toLowerCase();

function shapefileProblem(files) {
  const parts = files.filter((f) => SHAPEFILE_PARTS.includes(fileExtension(f.name)));
  if (parts.length === 0) return null;
  const hasZip = files.some((f) => ["zip", "kmz"].includes(fileExtension(f.name)));
  const shpStems = new Set(parts.filter((f) => fileExtension(f.name) === "shp").map((f) => stemOf(f.name)));
  if (shpStems.size > 0 || hasZip) return null;
  const names = parts.map((f) => f.name).join(", ");
  return `Subiste ${names}, pero ese archivo no trae los polígonos (solo la tabla de datos). Sube el .shp (los demás archivos son opcionales) o el .zip del shapefile, que es un solo archivo.`;
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