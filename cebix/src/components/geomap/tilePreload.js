import { lazySingleton } from "../../utils/singleton";

const URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

export const preloadWorldTiles = lazySingleton(() => {
  if (typeof window === "undefined" || navigator.connection?.saveData) return false;
  const maxZ = 4; 
  const queue = [];
  for (let z = 0; z <= maxZ; z++) {
    const n = 2 ** z;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) queue.push(`${URL}/${z}/${y}/${x}`);
  }
  let active = 0;
  const pump = () => {
    while (active < 4 && queue.length) {
      const img = new Image();
      active++;
      img.onload = img.onerror = () => {
        active--;
        pump();
      };
      img.src = queue.shift();
    }
  };
  
  const start = () => setTimeout(pump, 3000);
  if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 4000 });
  else start();
  return true;
});