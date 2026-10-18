import { resolveMapEngine } from "./mapDevice";

export const loadParcelMapGL = () => import("../components/map/ParcelMapGL");
export const loadParcelMapLite = () => import("../components/map/ParcelMapLite");
export const loadGlobeMapGL = () => import("../components/geomap/GlobeMapGL");

export function prefetchMapEngine() {
  const engine = resolveMapEngine();
  return Promise.all(engine === "lite" ? [loadParcelMapLite()] : [loadParcelMapGL(), loadGlobeMapGL()]);
}