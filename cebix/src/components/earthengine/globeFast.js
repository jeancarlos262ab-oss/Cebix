/**
 * Render rápido del globo en CPU (sin WebGL).
 *
 * Idea central: la columna de textura de cada píxel es  atan2(nx, z1) + lon0,
 * donde z1 depende solo de la inclinación (lat0). Girar de lado = sumar un
 * desplazamiento a una tabla ya calculada; solo si cambia la inclinación se
 * recalcula esa tabla.
 *
 *  1. Una vez por textura  → prepareGlobeTexture(): filas lineales en sen(lat)
 *     (adiós atanh por píxel) + mipmaps de caja. Se hace en rebanadas.
 *  2. Una vez por tamaño   → SphereRaster.configure(): normal, luz y bruma por
 *     píxel (la luz está fija a la pantalla, no cambia al girar).
 *  3. Al cambiar lat       → tabla de columna base, fila y nivel de mip por píxel.
 *  4. En cada cuadro       → por píxel: sumar desplazamiento, leer textura, aplicar luz y bruma.
 *
 * Módulo puro (sin DOM): se puede probar en Node. La referencia exacta sigue
 * siendo renderSphere() de globeRender.js.
 */
import { LIGHT, WRAP, AMBIENT, SHADE_GAMMA, HAZE, HAZE_BASE, HAZE_RIM, HAZE_FLOOR } from "./globeRender.js";

const INV_2PI = 1 / (2 * Math.PI);
const HALF_PI = Math.PI / 2;

/** sen(lat) máximo que cubre Web Mercator (lat ≈ 85.0511°): tanh(π). */
export const SMAX = Math.tanh(Math.PI);

const RB = 0x00ff00ff;
const GM = 0x0000ff00;
const FLAT = [58, 68, 82]; // esfera sin textura (igual que la referencia)

/* ───────────── atan2 aproximado ───────────── */

/** atan(t) para t en [0,1]: Abramowitz & Stegun 4.4.49 (error ≤ 1e-5 rad). */
function atanPoly(t) {
  const t2 = t * t;
  return t * (0.999866 + t2 * (-0.3302995 + t2 * (0.180141 + t2 * (-0.085133 + t2 * 0.0208351))));
}

/** Aproximación de Math.atan2 (error máximo ~1e-5 rad). Solo se exporta para pruebas. */
export function fastAtan2(y, x) {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  if (ax === 0 && ay === 0) return 0;
  let a = ay <= ax ? atanPoly(ay / ax) : HALF_PI - atanPoly(ax / ay);
  if (x < 0) a = Math.PI - a;
  return y < 0 ? -a : a;
}

/* ───────────── paso 1: textura lineal en sen(lat) + mipmaps ───────────── */

const defaultYield = () => new Promise((r) => setTimeout(r, 0));
const defaultNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Fila (continua, con centros de texel en +0.5) de la textura Mercator para un sen(lat). */
const mercRow = (s, th) => (0.5 - Math.atanh(s) * INV_2PI) * th - 0.5;

/**
 * Convierte una textura Web Mercator en una textura equirrectangular en sen(lat)
 * (filas uniformes en el seno de la latitud) con su cadena de mipmaps.
 *
 * @param {{data:Uint32Array,w:number,h:number,top:number[],bottom:number[]}} merc  w debe ser potencia de 2
 * @param {{sliceMs?:number, yieldFn?:()=>Promise<void>, now?:()=>number}} [opts]
 *        Trabaja en rebanadas de ~sliceMs y cede el hilo entre una y otra.
 * @returns {Promise<{levels:{data:Uint32Array,w:number,h:number}[], top:number[], bottom:number[]}>}
 */
export async function prepareGlobeTexture(merc, opts = {}) {
  const { sliceMs = 8, yieldFn = defaultYield, now = defaultNow } = opts;
  const { data: src, w: tw, h: th } = merc;
  if (tw & (tw - 1)) throw new Error("El ancho de la textura debe ser potencia de 2");
  const H = th >> 1; // con la mitad de filas se conserva (o mejora) el detalle hasta ~37° de latitud
  const base = new Uint32Array(tw * H);
  const acc = new Float32Array(tw * 3);

  let t0 = now();
  const slice = async () => {
    if (now() - t0 > sliceMs) {
      await yieldFn();
      t0 = now();
    }
  };

  for (let j = 0; j < H; j++) {
    // La fila j abarca sen(lat) ∈ [sb, sa]; en Mercator eso son `span` filas de la fuente (promedio de caja).
    const ya = mercRow(SMAX * (1 - (2 * j) / H), th);
    const yb = mercRow(SMAX * (1 - (2 * (j + 1)) / H), th);
    const span = yb - ya;
    const n = Math.min(16, Math.max(1, Math.ceil(span)));
    acc.fill(0);
    for (let q = 0; q < n; q++) {
      let y = ya + ((q + 0.5) / n) * span;
      y = y < 0 ? 0 : y > th - 1 ? th - 1 : y;
      const y0 = y | 0;
      const fy = y - y0;
      const w0 = 1 - fy;
      const o0 = y0 * tw;
      const o1 = (y0 < th - 1 ? y0 + 1 : y0) * tw;
      for (let x = 0, k = 0; x < tw; x++, k += 3) {
        const c0 = src[o0 + x];
        const c1 = src[o1 + x];
        acc[k] += (c0 & 255) * w0 + (c1 & 255) * fy;
        acc[k + 1] += ((c0 >> 8) & 255) * w0 + ((c1 >> 8) & 255) * fy;
        acc[k + 2] += ((c0 >> 16) & 255) * w0 + ((c1 >> 16) & 255) * fy;
      }
    }
    const inv = 1 / n;
    const ro = j * tw;
    for (let x = 0, k = 0; x < tw; x++, k += 3) {
      base[ro + x] =
        0xff000000 |
        (Math.round(acc[k + 2] * inv) << 16) |
        (Math.round(acc[k + 1] * inv) << 8) |
        Math.round(acc[k] * inv);
    }
    await slice();
  }

  // Mipmaps con filtro de caja 2×2 (suma empaquetada por carriles RB / G).
  const levels = [{ data: base, w: tw, h: H }];
  for (;;) {
    const prev = levels[levels.length - 1];
    const w = prev.w >> 1;
    const h = prev.h >> 1;
    if (w < 16 || h < 8) break;
    const d = new Uint32Array(w * h);
    const pd = prev.data;
    const pw = prev.w;
    for (let y = 0; y < h; y++) {
      const a = 2 * y * pw;
      const b = a + pw;
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const i = 2 * x;
        const c0 = pd[a + i];
        const c1 = pd[a + i + 1];
        const c2 = pd[b + i];
        const c3 = pd[b + i + 1];
        const rb = (((c0 & RB) + (c1 & RB) + (c2 & RB) + (c3 & RB) + 0x00020002) >>> 2) & RB;
        const g = (((c0 & GM) + (c1 & GM) + (c2 & GM) + (c3 & GM) + 0x200) >>> 2) & GM;
        d[o + x] = (0xff000000 | rb | g) >>> 0;
      }
      if ((y & 31) === 31) await slice();
    }
    levels.push({ data: d, w, h });
  }
  return { levels, top: merc.top, bottom: merc.bottom };
}

/* ───────────── pasos 2-4: rasterizador por tablas ───────────── */

// Umbrales de f² (texels² por píxel de pantalla) para pasar al nivel L: huella ≥ 2^(L + 0.4).
// El sesgo +0.4 (algo más nítido que el mip "exacto") se eligió barriendo valores y midiendo el error
// contra una imagen supermuestreada 4×: el mínimo está entre +0.25 y +0.5 (ver tools/verify-globe.mjs, prueba 5).
const LOD_BIAS = 0.4;
const LOD_T = new Float64Array(16);
for (let L = 1; L < 16; L++) LOD_T[L] = 2 ** (2 * L + 2 * LOD_BIAS);

export class SphereRaster {
  constructor() {
    this.cap = 0;
    this.n = 0;
    this.R = 1;
    this.tex = null;
    this.tiltOk = false;
    this.tiltLat = NaN;
    /** true si el último render() tuvo que recalcular la tabla de inclinación (para cronometrar). */
    this.lastTilt = false;
    this.bStart = new Int32Array(20);
  }

  _alloc(cap) {
    if (cap <= this.cap) return;
    this.cap = cap;
    this.nxA = new Float32Array(cap);
    this.nyA = new Float32Array(cap);
    this.nzA = new Float32Array(cap);
    this.dst = new Int32Array(cap);
    this.sh = new Float32Array(cap * 6);
    this.tb = new Float32Array(cap);
    this.vb = new Float32Array(cap);
    this.lvA = new Uint8Array(cap);
    this.ord = new Int32Array(cap);
  }

  setTexture(tex) {
    this.tex = tex;
    this.tiltOk = false; // el nivel de mip y los casquetes polares dependen del tamaño de la textura
  }

  /**
   * Paso 2. Guarda para cada píxel de la esfera su normal y sus factores de luz y bruma.
   * Mismas convenciones que renderSphere(): (cx, cy) y R en píxeles del búfer.
   * @param {number} stride  ancho real del búfer de salida (Uint32Array)
   * @param {number} w       ancho útil a calcular (≤ stride)
   * @param {number} h       alto útil a calcular
   */
  configure(stride, w, h, cx, cy, R) {
    const x0 = Math.max(0, Math.floor(cx - R));
    const x1 = Math.min(w, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R));
    const y1 = Math.min(h, Math.ceil(cy + R));
    this._alloc(Math.max(1, (x1 - x0) * (y1 - y0)));
    const { nxA, nyA, nzA, dst, sh } = this;
    const invR = 1 / R;
    const [L0, L1, L2] = LIGHT;
    let n = 0;
    for (let py = y0; py < y1; py++) {
      const ny = (cy - py - 0.5) * invR;
      const row = py * stride;
      for (let px = x0; px < x1; px++) {
        const nx = (px + 0.5 - cx) * invR;
        const r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;
        const nz = Math.sqrt(1 - r2);
        nxA[n] = nx;
        nyA[n] = ny;
        nzA[n] = nz;
        dst[n] = row + px;

        // Luz y bruma: idénticas a renderSphere(), pero agrupadas como  canal' = canal·mul + add.
        const dot = nx * L0 + ny * L1 + nz * L2;
        let lit = ((dot + WRAP) / (1 + WRAP)) * 1.2;
        lit = lit < 0 ? 0 : lit > 1 ? 1 : lit;
        lit = Math.pow(lit, SHADE_GAMMA);
        const s = AMBIENT + (1 - AMBIENT) * lit;
        const fr = 1 - nz;
        const hz = HAZE_BASE + HAZE_RIM * fr * fr * (0.2 + 0.8 * lit);
        const hk = (HAZE_FLOOR + (1 - HAZE_FLOOR) * s) * hz;
        const q = 6 * n;
        sh[q] = s * (1 - hz);
        sh[q + 1] = s * (1 - hz);
        sh[q + 2] = s * (1 - hz);
        sh[q + 3] = HAZE[0] * hk;
        sh[q + 4] = HAZE[1] * hk;
        sh[q + 5] = HAZE[2] * hk;
        n++;
      }
    }
    this.n = n;
    this.R = R;
    this.tiltOk = false;
  }

  /**
   * Paso 3. Para cada píxel: columna base (en vueltas, 0..1), fila normalizada (0..1) y nivel de mip.
   * Se agrupan los píxeles por nivel para que el bucle de cada cuadro tenga constantes por nivel.
   */
  _tilt(lat0) {
    const { levels } = this.tex;
    const maxL = levels.length - 1;
    const W0 = levels[0].w;
    const H0 = levels[0].h;
    const sinP = Math.sin(lat0);
    const cosP = Math.cos(lat0);
    const kU = (W0 * INV_2PI) / this.R; // texels de columna por radián, por píxel de pantalla
    const kV = (H0 * 0.5) / SMAX / this.R; // texels de fila por unidad de sen(lat), por píxel
    const vScale = 0.5 / SMAX;
    const capTop = maxL + 1;
    const capBot = maxL + 2;
    const { nxA, nyA, nzA, tb, vb, lvA, ord, bStart, n } = this;
    const counts = bStart;
    counts.fill(0);

    for (let i = 0; i < n; i++) {
      const nx = nxA[i];
      const ny = nyA[i];
      const nz = nzA[i];
      const yw = ny * cosP + nz * sinP;
      const z1 = nz * cosP - ny * sinP;
      const vN = 0.5 - yw * vScale;
      vb[i] = vN;

      // α = atan2(nx, z1), aproximado.
      const ax = nx < 0 ? -nx : nx;
      const az = z1 < 0 ? -z1 : z1;
      let a;
      if (az >= ax) a = az === 0 ? 0 : atanPoly(ax / az);
      else a = HALF_PI - atanPoly(az / ax);
      if (z1 < 0) a = Math.PI - a;
      if (nx < 0) a = -a;
      tb[i] = a * INV_2PI + 0.5;

      // El casquete empieza donde termina Mercator (sen lat = ±SMAX, vN = 0 / 1), como en la
      // referencia; entre el centro de la primera fila y ese borde se repite la fila extrema.
      let L;
      if (vN < 0) L = capTop;
      else if (vN > 1) L = capBot;
      else {
        // Nivel de mip: tamaño en texels de la huella de un píxel de pantalla (derivadas analíticas).
        const inz = 1 / (nz > 1e-3 ? nz : 1e-3);
        const gx = nx * inz;
        const gy = ny * inz;
        const dywx = -sinP * gx;
        const dywy = cosP - sinP * gy;
        const dz1x = -cosP * gx;
        const dz1y = -cosP * gy - sinP;
        const ir2 = 1 / (nx * nx + z1 * z1 + 1e-9);
        const dax = (z1 - nx * dz1x) * ir2 * kU;
        const day = -nx * dz1y * ir2 * kU;
        const vx = dywx * kV;
        const vy = dywy * kV;
        const fx2 = dax * dax + vx * vx;
        const fy2 = day * day + vy * vy;
        const f2 = fx2 > fy2 ? fx2 : fy2;
        L = 0;
        while (L < maxL && f2 >= LOD_T[L + 1]) L++;
      }
      lvA[i] = L;
      counts[L]++;
    }

    // Conteo → posiciones de inicio (bStart[L] = inicio del grupo L; bStart[capBot + 1] = n).
    let acc = 0;
    for (let L = 0; L <= capBot; L++) {
      const c = counts[L];
      counts[L] = acc;
      acc += c;
    }
    counts[capBot + 1] = acc;
    // Colocación estable (los índices de cada grupo quedan crecientes → buen acceso a memoria).
    const pos = this._pos || (this._pos = new Int32Array(20));
    pos.set(counts);
    for (let i = 0; i < n; i++) ord[pos[lvA[i]]++] = i;

    this.tiltLat = lat0;
    this.tiltOk = true;
    this.maxL = maxL;
  }

  /**
   * Paso 4 (y el resto si hace falta). Escribe la esfera en `out` (Uint32Array RGBA).
   * Solo recalcula la tabla de inclinación si lat0 cambió; girar en longitud no hace trigonometría.
   * `out` debe tener ya en cero los píxeles fuera de la esfera.
   */
  render(out, lon0, lat0) {
    if (!this.tex) {
      this.lastTilt = false;
      this._flat(out);
      return;
    }
    if (!this.tiltOk || Math.abs(lat0 - this.tiltLat) > 1e-6) {
      this._tilt(lat0);
      this.lastTilt = true;
    } else this.lastTilt = false;
    this._sample(out, lon0);
  }

  _flat(out) {
    const { n, dst, sh } = this;
    for (let i = 0; i < n; i++) {
      const q = 6 * i;
      let r = FLAT[0] * sh[q] + sh[q + 3];
      let g = FLAT[1] * sh[q + 1] + sh[q + 4];
      let b = FLAT[2] * sh[q + 2] + sh[q + 5];
      r = r > 255 ? 255 : r;
      g = g > 255 ? 255 : g;
      b = b > 255 ? 255 : b;
      out[dst[i]] = 0xff000000 | (b << 16) | (g << 8) | r;
    }
  }

  _sample(out, lon0) {
    const { levels, top, bottom } = this.tex;
    const { tb, vb, ord, dst, sh, bStart } = this;
    const maxL = levels.length - 1;
    let o = lon0 * INV_2PI;
    o -= Math.floor(o);

    for (let L = 0; L <= maxL; L++) {
      const j0 = bStart[L];
      const j1 = bStart[L + 1];
      if (j0 === j1) continue;
      const lev = levels[L];
      const d = lev.data;
      const W = lev.w;
      const H = lev.h;
      const mask = W - 1;
      const hMax = H - 1;
      const uOff = o * W + W - 0.5; // +W mantiene u positivo; la máscara resuelve la costura de ±180°
      for (let j = j0; j < j1; j++) {
        const i = ord[j];
        const u = tb[i] * W + uOff;
        const xi = u | 0;
        const fx = ((u - xi) * 256) | 0;
        let v = vb[i] * H - 0.5;
        v = v < 0 ? 0 : v > hMax ? hMax : v;
        const yi = v | 0;
        const fy = ((v - yi) * 256) | 0;
        const xa = xi & mask;
        const xb = (xi + 1) & mask;
        const o0 = yi * W;
        const o1 = (yi < hMax ? yi + 1 : yi) * W;
        const c00 = d[o0 + xa];
        const c10 = d[o0 + xb];
        const c01 = d[o1 + xa];
        const c11 = d[o1 + xb];
        const fx1 = 256 - fx;
        const fy1 = 256 - fy;
        // Bilineal en enteros: R y B juntos (carriles de 16 bits), G aparte.
        const ha = ((c00 & RB) * fx1 + (c10 & RB) * fx + 0x00800080) >>> 8;
        const hb = ((c01 & RB) * fx1 + (c11 & RB) * fx + 0x00800080) >>> 8;
        const rb = (ha & RB) * fy1 + (hb & RB) * fy + 0x00800080;
        const ga = ((c00 & GM) * fx1 + (c10 & GM) * fx + 0x80) >>> 8;
        const gb = ((c01 & GM) * fx1 + (c11 & GM) * fx + 0x80) >>> 8;
        const gv = ga * fy1 + gb * fy + 0x8000;
        const q = 6 * i;
        let r = ((rb >>> 8) & 255) * sh[q] + sh[q + 3];
        let g = (gv >>> 16) * sh[q + 1] + sh[q + 4];
        let b = (rb >>> 24) * sh[q + 2] + sh[q + 5];
        r = r > 255 ? 255 : r;
        g = g > 255 ? 255 : g;
        b = b > 255 ? 255 : b;
        out[dst[i]] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }

    // Casquetes polares: color liso (promedio de la fila extrema), con luz y bruma.
    for (let c = 0; c < 2; c++) {
      const L = maxL + 1 + c;
      const col = c === 0 ? top : bottom;
      for (let j = bStart[L]; j < bStart[L + 1]; j++) {
        const i = ord[j];
        const q = 6 * i;
        let r = col[0] * sh[q] + sh[q + 3];
        let g = col[1] * sh[q + 1] + sh[q + 4];
        let b = col[2] * sh[q + 2] + sh[q + 5];
        r = r > 255 ? 255 : r;
        g = g > 255 ? 255 : g;
        b = b > 255 ? 255 : b;
        out[dst[i]] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
  }
}
