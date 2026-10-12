/**
 * Cargadores de los motores de mapa (chunks pesados: MapLibre, Leaflet, globo).
 *
 * Se usan tanto para `lazy()` como para precargar en segundo plano (App.jsx), así al abrir una pantalla con
 * mapa el código ya está descargado y no hay una segunda espera después de entrar a la pantalla.
 * `import()` guarda su resultado, por lo que llamarlo varias veces no vuelve a descargar nada.
 */
import { resolveMapEngine } from "./mapDevice";

export const loadParcelMapGL = () => import("../components/map/ParcelMapGL");
export const loadParcelMapLite = () => import("../components/map/ParcelMapLite");
export const loadGlobeMapGL = () => import("../components/geomap/GlobeMapGL");

/** Precarga solo el motor que este equipo va a usar (el de WebGL o el ligero). */
export function prefetchMapEngine() {
  const engine = resolveMapEngine();
  return Promise.all(engine === "lite" ? [loadParcelMapLite()] : [loadParcelMapGL(), loadGlobeMapGL()]);
}
