/**
 * Capa de la esfera: decide qué hay que recalcular en cada cuadro y dibuja el
 * resultado en el lienzo. Sin dependencias de React ni del DOM (el lienzo
 * auxiliar y el ImageData se inyectan), así que la lógica se prueba en Node.
 *
 *  - Zoom que cambia (rueda, botones, vuelos): mientras la escala siga dentro de
 *    [ZOOM_LO, ZOOM_HI] de la geometría vigente, solo se re-escala con drawImage
 *    el último cuadro (o se vuelve a muestrear si además cambió el giro).
 *  - Zoom que se asienta (fast = false): se reconstruye la geometría a la escala exacta.
 *  - Giro lateral / inercia: no se recalcula ninguna tabla, solo el desplazamiento.
 *  - Cambio de inclinación: se recalcula la tabla de filas/columnas (lo hace SphereRaster).
 *  - Si el muestreo pasa de FRAME_MS por cuadro, baja el número de píxeles de la esfera.
 */
import { SphereRaster } from "./globeFast.js";
import { renderSphere } from "./globeRender.js";

// Píxeles que se calculan para la esfera (se escalan al tamaño de pantalla con drawImage).
export const BUDGET_MOVING = 90000; // mientras se arrastra / vuela (antes: 60000)
export const BUDGET_IDLE = 300000; // en reposo
export const ZOOM_LO = 0.8;
export const ZOOM_HI = 1.25;
export const FRAME_MS = 12; // si el muestreo pasa de esto, baja la resolución
export const Q_MIN = 0.3;
const SLACK = 1 / ZOOM_LO; // margen del raster para poder alejar sin dejar huecos
const ADAPT_EVERY = 6;

const defaultCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const defaultImage = (w, h) =>
  typeof ImageData !== "undefined" ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
const defaultNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class SphereLayer {
  constructor({ createCanvas = defaultCanvas, createImage = defaultImage, now = defaultNow, collectStats = false } = {}) {
    this.createCanvas = createCanvas;
    this.createImage = createImage;
    this.now = now;
    this.collectStats = collectStats;
    this.raster = new SphereRaster();
    this.tex = null;
    this.refTex = null;
    this.geo = null;
    this.rasterOk = false;
    this.lon = NaN;
    this.lat = NaN;
    this.quality = 1;
    this.qv = 0;
    this.ema = 0;
    this.adaptCount = 0;
    this.samples = { geom: [], tilt: [], lateral: [], scale: [], ref: [] };
  }

  setTexture(tex) {
    if (tex === this.tex) return;
    this.tex = tex;
    this.refTex = tex?.merc ?? null; // solo existe en desarrollo (para comparar con la referencia)
    this.raster.setTexture(tex);
    this.rasterOk = false;
  }

  invalidate() {
    this.geo = null;
    this.rasterOk = false;
  }

  _record(kind, ms) {
    if (!this.collectStats) return;
    const a = this.samples[kind];
    a.push(ms);
    if (a.length > 600) a.shift();
  }

  /** Resumen de tiempos por tipo de cuadro (ms): n, media, p95, máximo. */
  report() {
    const out = {};
    for (const [kind, a] of Object.entries(this.samples)) {
      if (!a.length) continue;
      const s = [...a].sort((x, y) => x - y);
      out[kind] = {
        n: s.length,
        avg: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2),
        p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(2),
        max: +s[s.length - 1].toFixed(2),
      };
    }
    return out;
  }

  resetStats() {
    for (const k of Object.keys(this.samples)) this.samples[k] = [];
  }

  /** Mide el muestreo de los cuadros "en movimiento" y ajusta la resolución con histéresis. */
  _adapt(ms) {
    this.ema = this.ema ? this.ema * 0.7 + ms * 0.3 : ms;
    if (++this.adaptCount < ADAPT_EVERY) return;
    this.adaptCount = 0;
    if (this.ema > FRAME_MS && this.quality > Q_MIN) {
      this.quality = Math.max(Q_MIN, this.quality * 0.8);
      this.qv++;
      this.ema *= 0.8;
    } else if (this.ema < FRAME_MS * 0.5 && this.quality < 1) {
      this.quality = Math.min(1, this.quality * 1.2);
      this.qv++;
      this.ema *= 1.2;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{cw:number,ch:number,cx:number,cy:number,R:number,lon0:number,lat0:number,fast:boolean,reference?:boolean}} p
   *        R, cx, cy y cw/ch en píxeles del lienzo; lon0/lat0 en radianes.
   * @returns {{kind:'geom'|'tilt'|'lateral'|'scale'|'ref'|'none', ms:number}}
   */
  draw(ctx, p) {
    const { cw, ch, cx, cy, R, lon0, lat0, fast } = p;
    const reference = !!(p.reference && this.refTex);
    let g = this.geo;
    const ratio = g ? R / g.R : 0;
    const reuse =
      g &&
      g.cw === cw &&
      g.ch === ch &&
      g.fast === fast &&
      g.qv === this.qv &&
      (fast ? ratio >= ZOOM_LO && ratio <= ZOOM_HI : Math.abs(ratio - 1) < 0.02);

    const t0 = this.now();
    let rebuilt = false;
    if (!reuse) {
      // Ventana del lienzo que cubre la esfera, con margen para poder alejar sin huecos.
      const hx = Math.min(R, cw * 0.5 * SLACK);
      const hy = Math.min(R, ch * 0.5 * SLACK);
      const x0 = Math.floor(cx - hx);
      const y0 = Math.floor(cy - hy);
      const vw = Math.ceil(cx + hx) - x0;
      const vh = Math.ceil(cy + hy) - y0;
      if (vw < 2 || vh < 2) {
        this.geo = null;
        return { kind: "none", ms: 0 };
      }
      const budget = fast ? BUDGET_MOVING * this.quality : BUDGET_IDLE;
      const k = Math.min(1, Math.sqrt(budget / (vw * vh)));
      const bw = Math.max(2, Math.ceil(vw * k));
      const bh = Math.max(2, Math.ceil(vh * k));
      // Búfer redondeado a 32 para no realocar en cada reconstrucción.
      const aw = Math.ceil(bw / 32) * 32;
      const ah = Math.ceil(bh / 32) * 32;
      const old = this.geo;
      let img = old?.img;
      let off = old?.off;
      if (!img || img.width !== aw || img.height !== ah) {
        img = this.createImage(aw, ah);
        off = this.createCanvas(aw, ah);
      }
      const img32 = new Uint32Array(img.data.buffer);
      img32.fill(0);
      this.raster.configure(aw, bw, bh, (cx - x0) * k, (cy - y0) * k, R * k);
      g = this.geo = {
        cw, ch, fast, qv: this.qv, R, x0, y0, k, bw, bh, aw, ah,
        img, img32, off, offCtx: off.getContext("2d"),
      };
      rebuilt = true;
    }

    let kind = "scale";
    if (rebuilt || reference || !this.rasterOk || lon0 !== this.lon || lat0 !== this.lat) {
      if (reference) {
        g.img32.fill(0);
        renderSphere(g.img32, g.aw, g.ah, (cx - g.x0) * g.k, (cy - g.y0) * g.k, g.R * g.k, lon0, lat0, this.refTex);
        kind = "ref";
      } else {
        this.raster.render(g.img32, lon0, lat0);
        kind = rebuilt ? "geom" : this.raster.lastTilt ? "tilt" : "lateral";
      }
      g.offCtx.putImageData(g.img, 0, 0);
      this.lon = lon0;
      this.lat = lat0;
      this.rasterOk = true;
    }
    const ms = this.now() - t0;
    this._record(kind, ms);
    if (fast && (kind === "tilt" || kind === "lateral")) this._adapt(ms);

    const s = R / g.R;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(g.off, 0, 0, g.bw, g.bh, cx + (g.x0 - cx) * s, cy + (g.y0 - cy) * s, (g.bw / g.k) * s, (g.bh / g.k) * s);
    return { kind, ms };
  }
}
