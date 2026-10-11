import { lazySingleton } from "../../utils/singleton";

/**
 * Precarga (una sola vez) el mundo completo hasta el zoom `maxZ` en la caché del navegador,
 * en segundo plano y con pocas peticiones a la vez. Así, al arrastrar o alejar el mapa plano,
 * las teselas de vista general ya están y no hay que volver a pedirlas.
 */
const URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

export const preloadWorldTiles = lazySingleton(() => {
  if (typeof window === "undefined" || navigator.connection?.saveData) return false;
  const maxZ = 4; // 341 teselas ≈ 4-5 MB
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
  // Espera a que el navegador esté libre y la animación de entrada haya terminado.
  const start = () => setTimeout(pump, 3000);
  if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 4000 });
  else start();
  return true;
});
