import { SphereRaster } from "./globeFast.js";
import { renderSphere } from "./globeRender.js";

const BUDGET_MOVING = 90000; 
const BUDGET_IDLE = 300000; 
const ZOOM_LO = 0.8;
const ZOOM_HI = 1.25;
const FRAME_MS = 13; 
const Q_MIN = 0.3;
const SLACK = 1 / ZOOM_LO; 
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
  constructor({ createCanvas = defaultCanvas, createImage = defaultImage, now = defaultNow, collectStats = false, budgetMoving = BUDGET_MOVING } = {}) {
    this.budgetMoving = budgetMoving;
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
    this.refTex = tex?.merc ?? null; 
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

  

  reportFrame(ms, fast) {
    if (fast && (this.lastKind === "tilt" || this.lastKind === "lateral")) this._adapt(ms);
  }

  

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
      const budget = fast ? this.budgetMoving * this.quality : BUDGET_IDLE;
      const k = Math.min(1, Math.sqrt(budget / (vw * vh)));
      const bw = Math.max(2, Math.ceil(vw * k));
      const bh = Math.max(2, Math.ceil(vh * k));
      
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
        this.raster.render(g.img32, lon0, lat0, fast);
        kind = rebuilt ? "geom" : this.raster.lastTilt ? "tilt" : "lateral";
      }
      g.offCtx.putImageData(g.img, 0, 0);
      this.lon = lon0;
      this.lat = lat0;
      this.rasterOk = true;
    }
    const ms = this.now() - t0;
    this._record(kind, ms);
    this.lastKind = kind;

    const s = R / g.R;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(g.off, 0, 0, g.bw, g.bh, cx + (g.x0 - cx) * s, cy + (g.y0 - cy) * s, (g.bw / g.k) * s, (g.bh / g.k) * s);
    return { kind, ms };
  }
}