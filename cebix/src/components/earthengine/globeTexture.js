/**
 * Textura del globo: une las teselas Esri World_Imagery de un nivel de zoom
 * (z=2 → 16 teselas, 1024 px; z=3 → 64 teselas, 2048 px) en un solo bitmap,
 * lo convierte a filas lineales en sen(lat) con mipmaps (globeFast.js) y lo
 * deja como Uint32Array para muestrearlo rápido desde la CPU.
 *
 * Es la misma fuente que ya usa el mapa plano, así que no hay API key ni
 * dominios nuevos. Las teselas se piden con CORS anónimo (Esri lo permite) para
 * poder leer los píxeles; si el navegador lo bloquea, la promesa se rechaza y el
 * globo cae a un océano liso.
 */
import { prepareGlobeTexture } from "./globeFast.js";

const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const TILE = 256;

const cache = new Map();

function loadTile(z, x, y) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${TILE_URL}/${z}/${y}/${x}`;
  });
}

function rowAverage(data, w, row) {
  let r = 0;
  let g = 0;
  let b = 0;
  const step = Math.max(1, Math.floor(w / 128));
  let n = 0;
  for (let x = 0; x < w; x += step) {
    const c = data[row * w + x];
    r += c & 255;
    g += (c >> 8) & 255;
    b += (c >> 16) & 255;
    n++;
  }
  return [r / n, g / n, b / n];
}

async function build(z) {
  const n = 2 ** z;
  const size = TILE * n;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#14345c";
  ctx.fillRect(0, 0, size, size);

  const jobs = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      jobs.push(
        loadTile(z, x, y).then((img) => {
          if (!img) return false;
          ctx.drawImage(img, x * TILE, y * TILE);
          return true;
        }),
      );
    }
  }
  const ok = (await Promise.all(jobs)).filter(Boolean).length;
  if (!ok) throw new Error("No se pudo cargar ninguna tesela del globo");

  // Lee los píxeles por franjas (cediendo el hilo entre una y otra) para no congelar la pantalla.
  // La primera lectura lanza SecurityError si el lienzo quedó "contaminado" (sin CORS).
  const data = new Uint32Array(size * size);
  const STRIP = 128;
  for (let y = 0; y < size; y += STRIP) {
    const px = ctx.getImageData(0, y, size, Math.min(STRIP, size - y)).data;
    data.set(new Uint32Array(px.buffer, px.byteOffset, px.byteLength >> 2), y * size);
    if (y + STRIP < size) await new Promise((r) => setTimeout(r, 0));
  }
  canvas.width = canvas.height = 0; // libera el bitmap
  const merc = { data, w: size, h: size, top: rowAverage(data, size, 0), bottom: rowAverage(data, size, size - 1) };

  // Paso 1: filas lineales en sen(lat) + mipmaps, en rebanadas. La textura Mercator se descarta.
  const tex = await prepareGlobeTexture(merc);
  // Solo en desarrollo se conserva la Mercator original para poder comparar con la referencia
  // (window.__globePerf.reference = true en GlobeMap).
  if (import.meta.env.DEV) tex.merc = merc;
  return tex;
}

/** Devuelve (y cachea) la textura del nivel z. Si falla, el siguiente intento vuelve a probar. */
export function loadGlobeTexture(z) {
  if (!cache.has(z)) {
    const p = build(z).catch((err) => {
      cache.delete(z);
      throw err;
    });
    cache.set(z, p);
  }
  return cache.get(z);
}
