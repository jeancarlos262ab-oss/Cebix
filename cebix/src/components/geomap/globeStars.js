import { projectDir } from "./globeRender.js";

const SKY = {
  stars: 4200, 
  milkyWay: true, 
  glow: 170, 
  lanes: 90, 
  grains: 5000, 
  reach: 1.5, 
  
  
  
  speed: 1,
  
  
  mwSpeed: 1,
  lowRes: 0.35, 
  
  
  zoom: 0.03,
  
  
  
  direction: 1,
};

const GLOW_FAST = 0.5;

const GRAIN_FAST = 0.3;
const STAR_FAST = 0.55;

const TINTS = [
  [255, 255, 255], 
  [170, 200, 255], 
  [255, 214, 168], 
];

const GLOW_TINTS = [
  [222, 196, 164], 
  [206, 200, 198], 
  [176, 190, 214], 
];

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rnd) => (rnd() + rnd() + rnd() - 1.5) / 1.5;

function makeSprites() {
  const mk = (size, [r, g, b], stops) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    const h = size / 2;
    const grad = x.createRadialGradient(h, h, 0, h, h, h);
    for (const [o, a] of stops) grad.addColorStop(o, `rgba(${r},${g},${b},${a})`);
    x.fillStyle = grad;
    x.fillRect(0, 0, size, size);
    return c;
  };
  return {
    star: TINTS.map((t) => mk(32, t, [[0, 1], [0.16, 0.9], [0.42, 0.2], [1, 0]])),
    glow: GLOW_TINTS.map((t) => mk(64, t, [[0, 1], [0.3, 0.5], [0.62, 0.13], [1, 0]])),
    dark: mk(64, [0, 0, 0], [[0, 1], [0.4, 0.55], [0.75, 0.12], [1, 0]]),
  };
}

const LIM = -Math.cos(SKY.reach + 0.4); 
function skyProject(px, py, pz, sinL, cosL, sinP, cosP, cx, cy, k, out) {
  const z2 = projectDir(px, py, pz, sinL, cosL, sinP, cosP, 0, 0, 1, out);
  if (z2 > LIM) return false;
  const x1 = out.x;
  const y2 = -out.y;
  const s2 = x1 * x1 + y2 * y2;
  const c = z2 < -1 ? 1 : -z2;
  const f = s2 > 1e-9 ? (k * Math.acos(c)) / Math.sqrt(s2) : k;
  out.x = cx + x1 * f;
  out.y = cy - y2 * f;
  return true;
}

export function createSky({ stars = SKY.stars } = {}) {
  
  const rnd = mulberry32(7421);

  
  const faint = [];
  const mid = [];
  const bright = []; 
  for (let i = 0; i < stars; i++) {
    const y = 2 * rnd() - 1;
    const rr = Math.sqrt(1 - y * y);
    const phi = 2 * Math.PI * rnd();
    const x = rr * Math.sin(phi);
    const z = rr * Math.cos(phi);
    const u = rnd();
    if (u < 0.8) faint.push(x, y, z);
    else if (u < 0.962) mid.push(x, y, z);
    else {
      const t = rnd();
      bright.push(x, y, z, 3 + rnd() * 2.5, t < 0.55 ? 0 : t < 0.78 ? 1 : 2);
    }
  }
  const T0 = new Float32Array(faint);
  const T1 = new Float32Array(mid);
  const T2 = new Float32Array(bright);

  
  
  const nrm = [0.32, 0.82, 0.47];
  const nl = Math.hypot(...nrm);
  const n = nrm.map((v) => v / nl);
  let ex = [n[1], -n[0], 0]; 
  const el = Math.hypot(...ex);
  ex = ex.map((v) => v / el);
  const ey0 = [n[1] * ex[2] - n[2] * ex[1], n[2] * ex[0] - n[0] * ex[2], n[0] * ex[1] - n[1] * ex[0]];
  
  
  const bx = ey0;
  const by = ex.map((v) => -v);
  
  const onBand = (ang, off) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const co = Math.cos(off);
    const so = Math.sin(off);
    return [
      (bx[0] * ca + by[0] * sa) * co + n[0] * so,
      (bx[1] * ca + by[1] * sa) * co + n[1] * so,
      (bx[2] * ca + by[2] * sa) * co + n[2] * so,
    ];
  };
  
  const ARC = 2.4; 
  const coreness = (a) => Math.exp(-(a * a) / (2 * 0.85 * 0.85));

  
  const gl = [];
  for (let i = 0; i < SKY.glow; i++) {
    const a = ((i + rnd()) / SKY.glow) * ARC * 2 - ARC; 
    const core = coreness(a);
    const v = onBand(a, gauss(rnd) * 0.1); 
    const warm = core > 0.5 && rnd() < 0.7;
    gl.push(
      v[0], v[1], v[2],
      0.16 + rnd() * 0.16 + core * 0.06,
      core * (0.55 + 0.45 * rnd()), 
      warm ? 0 : rnd() < 0.5 ? 1 : 2,
    );
  }
  for (let i = 0; i < 8; i++) {
    
    const v = onBand(gauss(rnd) * 0.25, gauss(rnd) * 0.09);
    gl.push(v[0], v[1], v[2], 0.2 + rnd() * 0.12, 0.9, 0);
  }
  const GL = new Float32Array(gl);

  
  
  const ln = [];
  for (let i = 0; i < SKY.lanes; i++) {
    const a = (i / (SKY.lanes - 1) * 2 - 1) * 1.7 + (rnd() - 0.5) * 0.04;
    const off = 0.025 + 0.03 * Math.sin(a * 3.1 + 1) + gauss(rnd) * 0.02;
    const v = onBand(a, off);
    ln.push(v[0], v[1], v[2], 0.06 + rnd() * 0.07, (0.25 + 0.35 * rnd()) * coreness(a));
  }
  const LN = new Float32Array(ln);

  
  const g0 = [];
  const g1 = [];
  for (let i = 0; i < SKY.grains; i++) {
    const a = gauss(rnd) * 1.5; 
    const v = onBand(a, gauss(rnd) * 0.11);
    (coreness(a) > 0.4 && rnd() < 0.6 ? g1 : g0).push(v[0], v[1], v[2]);
  }
  const G0 = new Float32Array(g0);
  const G1 = new Float32Array(g1);

  let sprites = null;
  const pt = { x: 0, y: 0 };
  
  let aLon = 0;
  let aLat = 0;
  let mLon = 0; 
  let mLat = 0;
  let pLon = null;
  let pLat = null;

  
  
  
  
  const MARGIN = 0; 
  let lay = null;

  function ensureLayers(cw, ch) {
    const dw = cw + 2 * MARGIN;
    const dh = ch + 2 * MARGIN;
    const w = Math.max(2, Math.ceil(dw * SKY.lowRes));
    const h = Math.max(2, Math.ceil(dh * SKY.lowRes));
    if (lay && lay.w === w && lay.h === h) return;
    const mk = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      return { canvas, ctx: canvas.getContext("2d") };
    };
    lay = { glow: mk(), dust: mk(), w, h, dw, dh };
  }

  
  function buildLayers(cw, ch, zs, ks, sinL, cosL, sinP, cosP, fast) {
    const sc = lay.w / lay.dw;
    
    
    
    const gs = fast ? GLOW_FAST : 1;
    lay.gs = gs;
    const lcx = (cw / 2 + MARGIN) * sc;
    const lcy = (ch / 2 + MARGIN) * sc;
    const lk = ks * sc;
    const W = lay.w;
    const H = lay.h;

    const g = lay.glow.ctx;
    const gW = Math.ceil(W * gs);
    const gH = Math.ceil(H * gs);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < GL.length; i += 6) {
      const a = GL[i + 4] * 0.12;
      if (a < 0.0015) continue; 
      if (!skyProject(GL[i], GL[i + 1], GL[i + 2], sinL, cosL, sinP, cosP, lcx, lcy, lk, pt)) continue;
      const h = GL[i + 3] * lk;
      if (pt.x < -h || pt.x > W + h || pt.y < -h || pt.y > H + h) continue;
      const hh = h * gs;
      g.globalAlpha = a;
      g.drawImage(sprites.glow[GL[i + 5]], pt.x * gs - hh, pt.y * gs - hh, hh * 2, hh * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    lay.gW = gW;
    lay.gH = gH;

    const d = lay.dust.ctx;
    d.clearRect(0, 0, W, H);
    for (let i = 0; i < LN.length; i += 5) {
      if (!skyProject(LN[i], LN[i + 1], LN[i + 2], sinL, cosL, sinP, cosP, lcx, lcy, lk, pt)) continue;
      const h = LN[i + 3] * lk;
      if (pt.x < -h || pt.x > W + h || pt.y < -h || pt.y > H + h) continue;
      d.globalAlpha = LN[i + 4];
      d.drawImage(sprites.dark, pt.x - h, pt.y - h, h * 2, h * 2);
    }
    d.globalAlpha = 1;
  }

  
  

  function draw(ctx, { cw, ch, lon0, lat0, q, zoom = 1, fast = false }) {
    if (!sprites) sprites = makeSprites();
    const k = (Math.hypot(cw, ch) * 0.5) / SKY.reach; 
    
    
    const zs = 1 + (Math.max(1, zoom) - 1) * SKY.zoom;
    const ks = k * zs;

    
    
    if (pLon === null) {
      pLon = lon0;
      pLat = lat0;
    }
    const dLon = lon0 - pLon;
    
    
    
    
    const f = -SKY.direction * SKY.speed;
    const dl = dLon - Math.PI * 2 * Math.round(dLon / (Math.PI * 2)); 
    const dp = lat0 - pLat;
    aLon += dl * f;
    aLat += dp * f;
    
    const fm = -SKY.direction * SKY.mwSpeed;
    mLon += dl * fm;
    mLat += dp * fm;
    pLon = lon0;
    pLat = lat0;
    const sinL = Math.sin(aLon);
    const cosL = Math.cos(aLon);
    const sinP = Math.sin(aLat);
    const cosP = Math.cos(aLat);
    const sinM = Math.sin(mLon);
    const cosM = Math.cos(mLon);
    const sinQ = Math.sin(mLat);
    const cosQ = Math.cos(mLat);
    const cx = cw / 2;
    const cy = ch / 2;

    ctx.save();

    if (SKY.milkyWay) {
      ensureLayers(cw, ch);
      
      
      
      
      buildLayers(cw, ch, zs, ks, sinM, cosM, sinQ, cosQ, fast);
      const ox = 0;
      const oy = 0;
      const rx = ox - MARGIN;
      const ry = oy - MARGIN;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";

      
      ctx.drawImage(lay.glow.canvas, 0, 0, lay.gW, lay.gH, rx, ry, lay.dw, lay.dh);

      
      
      
      
      const gf = fast ? GRAIN_FAST : 1;
      const ga = fast ? 1 / GRAIN_FAST : 1; 
      const grains = [
        [G0, `rgba(214,222,240,${Math.min(1, 0.34 * ga).toFixed(3)})`],
        [G1, `rgba(255,226,188,${Math.min(1, 0.38 * ga).toFixed(3)})`],
      ];
      const gs = 1.05 * q;
      for (const [arr, style] of grains) {
        ctx.fillStyle = style;
        ctx.beginPath();
        const end = Math.floor(arr.length / 3 * gf) * 3;
        for (let i = 0; i < end; i += 3) {
          if (!skyProject(arr[i], arr[i + 1], arr[i + 2], sinM, cosM, sinQ, cosQ, cx, cy, ks, pt)) continue;
          if (pt.x < 0 || pt.x > cw || pt.y < 0 || pt.y > ch) continue;
          ctx.rect(pt.x, pt.y, gs, gs);
        }
        ctx.fill();
      }

      
      ctx.drawImage(lay.dust.canvas, rx, ry, lay.dw, lay.dh);
    }

    
    const sf = fast ? STAR_FAST : 1;
    const sa = fast ? 1 / STAR_FAST : 1;
    const groups = [
      [T0, `rgba(205,218,245,${Math.min(1, 0.42 * sa).toFixed(3)})`, 1.1 * q],
      [T1, "rgba(230,238,255,0.78)", 1.6 * q],
    ];
    for (const [arr, style, s] of groups) {
      ctx.fillStyle = style;
      ctx.beginPath();
      const h = s / 2;
      const end = arr === T0 ? Math.floor(arr.length / 3 * sf) * 3 : arr.length;
      for (let i = 0; i < end; i += 3) {
        if (!skyProject(arr[i], arr[i + 1], arr[i + 2], sinL, cosL, sinP, cosP, cx, cy, ks, pt)) continue;
        if (pt.x < 0 || pt.x > cw || pt.y < 0 || pt.y > ch) continue;
        ctx.rect(pt.x - h, pt.y - h, s, s);
      }
      ctx.fill();
    }

    
    for (let i = 0; i < T2.length; i += 5) {
      if (!skyProject(T2[i], T2[i + 1], T2[i + 2], sinL, cosL, sinP, cosP, cx, cy, ks, pt)) continue;
      if (pt.x < 0 || pt.x > cw || pt.y < 0 || pt.y > ch) continue;
      const h = T2[i + 3] * q;
      ctx.drawImage(sprites.star[T2[i + 4]], pt.x - h, pt.y - h, h * 2, h * 2);
    }

    ctx.restore();
  }

  return { draw };
}