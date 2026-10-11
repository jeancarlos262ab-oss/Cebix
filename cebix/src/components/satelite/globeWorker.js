/**
 * Hilo aparte para la esfera del globo.
 *
 * Aquí viven la textura, el rasterizador por tablas (globeFast.js) y la capa SphereLayer (globeLayer.js).
 * Por cada petición de la pantalla se pinta la esfera en un OffscreenCanvas del tamaño del lienzo y se
 * devuelve como ImageBitmap (sin copias de píxeles). El cálculo, lo más pesado del globo, deja de
 * ocupar el hilo principal: ahí queda el cielo, la composición y la interfaz.
 *
 * Mensajes de entrada:  {type:"tex", tex}   textura (niveles de mip, color de los polos) o null
 *                       {type:"draw", seq, cw, ch, cx, cy, R, lon0, lat0, fast}
 * Mensajes de salida:   {type:"frame", seq, bitmap, kind, ms}   |   {type:"fail", error}
 */
import { SphereLayer } from "./globeLayer.js";

const BUDGET_MOVING = 130000; // aquí hay margen extra: el cielo se pinta en paralelo en el hilo principal

let layer = null;
let out = null;
let octx = null;

const getLayer = () =>
  layer ||
  (layer = new SphereLayer({
    createCanvas: (w, h) => new OffscreenCanvas(w, h),
    createImage: (w, h) => new ImageData(w, h),
    budgetMoving: BUDGET_MOVING,
  }));

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === "tex") {
      getLayer().setTexture(m.tex);
    } else if (m.type === "draw") {
      const l = getLayer();
      if (!out || out.width !== m.cw || out.height !== m.ch) {
        out = new OffscreenCanvas(m.cw, m.ch);
        octx = out.getContext("2d");
      }
      const t0 = performance.now();
      const r = l.draw(octx, { cw: m.cw, ch: m.ch, cx: m.cx, cy: m.cy, R: m.R, lon0: m.lon0, lat0: m.lat0, fast: m.fast });
      const ms = performance.now() - t0;
      l.reportFrame(ms, m.fast);
      const bitmap = out.transferToImageBitmap(); // deja el lienzo en blanco para el siguiente cuadro
      self.postMessage({ type: "frame", seq: m.seq, bitmap, kind: r.kind, ms }, [bitmap]);
    }
  } catch (err) {
    self.postMessage({ type: "fail", error: String(err && err.message ? err.message : err) });
  }
};
