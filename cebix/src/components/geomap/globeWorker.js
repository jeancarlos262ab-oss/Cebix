import { SphereLayer } from "./globeLayer.js";

const BUDGET_MOVING = 130000; 

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
      const bitmap = out.transferToImageBitmap(); 
      self.postMessage({ type: "frame", seq: m.seq, bitmap, kind: r.kind, ms }, [bitmap]);
    }
  } catch (err) {
    self.postMessage({ type: "fail", error: String(err && err.message ? err.message : err) });
  }
};