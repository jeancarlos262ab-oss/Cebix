import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

let configured = false;
if (!configured) {
  configured = true;
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
  try {
    maplibregl.prewarm();
  } catch {
    
  }
}

export default maplibregl;