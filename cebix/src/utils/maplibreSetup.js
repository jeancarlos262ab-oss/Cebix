/**
 * Configuración única de MapLibre GL (se importa desde TODOS los mapas GL).
 *
 * Por qué existe: MapLibre procesa los GeoJSON (contornos estatales, puntos de parcelas) en un Web Worker.
 * Su URL por defecto se deriva de `import.meta.url` y, empaquetado con Vite, apunta a un archivo que no
 * existe. Antes `setWorkerUrl` solo se llamaba dentro de GlobeMapGL, así que si ParcelMapGL creaba su mapa
 * antes de que ese otro chunk se evaluara, el worker nacía roto: el mapa base (tiles raster, que no usan
 * worker) se veía, pero contornos y puntos nunca se pintaban hasta recargar la página.
 *
 * Al importarse este módulo desde cada mapa, la URL queda fijada antes de crear cualquier `Map`, sin
 * importar qué chunk cargue primero. `prewarm()` crea el pool de workers de antemano.
 */
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

let configured = false;
if (!configured) {
  configured = true;
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
  try {
    maplibregl.prewarm();
  } catch {
    /* sin soporte de workers: MapLibre lo reportará al crear el mapa */
  }
}

export default maplibregl;
