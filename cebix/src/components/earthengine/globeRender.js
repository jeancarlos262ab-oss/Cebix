/**
 * Render de un globo ortográfico en CPU (sin WebGL).
 *
 * Para cada píxel de la esfera se calcula latitud/longitud y se muestrea la
 * textura (teselas Web Mercator de Esri unidas en un solo bitmap) con
 * interpolación bilineal. Es una función pura: no toca el DOM, así que se
 * puede probar en Node.
 *
 * Convención: p = Ry(lon0) · Rx(-lat0) · s, con s = (x derecha, y arriba, z hacia el usuario).
 */

const D2R = Math.PI / 180;
const INV_2PI = 1 / (2 * Math.PI);

/**
 * Luz fija respecto a la pantalla (arriba-izquierda, de frente): al girar el globo
 * la sombra se queda abajo-derecha, como si la cámara orbitara un planeta real.
 * Vector unitario (x derecha, y arriba, z hacia el usuario).
 */
export const LIGHT = [-0.45, 0.5, 0.74];
export const WRAP = 0.05; // suaviza el terminador (0 = corte duro)
export const AMBIENT = 0.06; // luz mínima en el lado en sombra
// Bruma atmosférica: tinte azul ligero en todo el globo + más intenso hacia el borde.
export const HAZE = [112, 165, 238]; // azul medio-claro
export const HAZE_BASE = 0.08;
export const HAZE_RIM = 0.6;
/**
 * @param {Uint32Array} out   buffer RGBA (cw*ch) — se asume ya en cero
 * @param {number} cw         ancho en píxeles
 * @param {number} ch         alto en píxeles
 * @param {number} cx         centro x de la esfera
 * @param {number} cy         centro y de la esfera
 * @param {number} R          radio en píxeles
 * @param {number} lon0       longitud del centro (rad)
 * @param {number} lat0       latitud del centro (rad)
 * @param {{data:Uint32Array,w:number,h:number,top:number[],bottom:number[]}|null} tex
 */
export function renderSphere(out, cw, ch, cx, cy, R, lon0, lat0, tex) {
  const sinP = Math.sin(lat0);
  const cosP = Math.cos(lat0);
  const sinL = Math.sin(lon0);
  const cosL = Math.cos(lon0);
  const invR = 1 / R;
  const x0 = Math.max(0, Math.floor(cx - R));
  const x1 = Math.min(cw, Math.ceil(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R));
  const y1 = Math.min(ch, Math.ceil(cy + R));
  const tw = tex ? tex.w : 0;
  const th = tex ? tex.h : 0;
  const td = tex ? tex.data : null;

  for (let py = y0; py < y1; py++) {
    const ny = (cy - py - 0.5) * invR;
    const row = py * cw;
    for (let px = x0; px < x1; px++) {
      const nx = (px + 0.5 - cx) * invR;
      const r2 = nx * nx + ny * ny;
      if (r2 >= 1) continue;
      const nz = Math.sqrt(1 - r2);

      let r;
      let g;
      let b;
      if (td) {
        const yw = ny * cosP + nz * sinP;
        const z1 = nz * cosP - ny * sinP;
        const xw = nx * cosL + z1 * sinL;
        const zw = z1 * cosL - nx * sinL;

        // Mercator: v = 0.5 - atanh(sin(lat)) / 2π
        const v = (0.5 - Math.atanh(yw) * INV_2PI) * th - 0.5;
        if (v < 0) {
          [r, g, b] = tex.top;
        } else if (v > th - 1) {
          [r, g, b] = tex.bottom;
        } else {
          const u = (Math.atan2(xw, zw) * INV_2PI + 0.5) * tw - 0.5;
          const xi = Math.floor(u);
          const fx = u - xi;
          const xa = (xi + tw) % tw;
          const xb = (xa + 1) % tw;
          const yi = v | 0;
          const fy = v - yi;
          const o0 = yi * tw;
          const o1 = (yi + 1 < th ? yi + 1 : yi) * tw;
          const c00 = td[o0 + xa];
          const c10 = td[o0 + xb];
          const c01 = td[o1 + xa];
          const c11 = td[o1 + xb];
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          r = (c00 & 255) * w00 + (c10 & 255) * w10 + (c01 & 255) * w01 + (c11 & 255) * w11;
          g = ((c00 >> 8) & 255) * w00 + ((c10 >> 8) & 255) * w10 + ((c01 >> 8) & 255) * w01 + ((c11 >> 8) & 255) * w11;
          b = ((c00 >> 16) & 255) * w00 + ((c10 >> 16) & 255) * w10 + ((c01 >> 16) & 255) * w01 + ((c11 >> 16) & 255) * w11;
        }
      } else {
        // Sin textura: esfera lisa y neutra.
        r = 58;
        g = 68;
        b = 82;
      }

      // Luz direccional con terminador suave: la parte baja/derecha queda en sombra.
      const dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      let lit = ((dot + WRAP) / (1 + WRAP)) * 1.2;
      lit = lit < 0 ? 0 : lit > 1 ? 1 : lit;
      const s = AMBIENT + (1 - AMBIENT) * lit;
      // En sombra el color se oscurece un poco menos en azul (luz de cielo/espacio).
      r *= s;
      g *= s * 1.0 + 0.03 * (1 - lit);
      b *= s + 0.04 * (1 - lit);

      // Bruma azul de lejanía: ligera al centro, más fuerte en el borde (fresnel),
      // y más visible del lado iluminado.
      const fr = 1 - nz;
      const hz = HAZE_BASE + HAZE_RIM * fr * fr * (0.2 + 0.8 * lit);
      r += (HAZE[0] * (0.25 + 0.75 * s) - r) * hz;
      g += (HAZE[1] * (0.25 + 0.75 * s) - g) * hz;
      b += (HAZE[2] * (0.25 + 0.75 * s) - b) * hz;
      out[row + px] = 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
    }
  }
}

/**
 * Proyecta (lat, lon) en grados a coordenadas de pantalla.
 * Devuelve false si el punto está en el hemisferio oculto; escribe en `out` ({x,y}).
 */
export function projectPoint(latDeg, lonDeg, lon0, lat0, cx, cy, R, out) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  const cl = Math.cos(lat);
  const px = cl * Math.sin(lon);
  const py = Math.sin(lat);
  const pz = cl * Math.cos(lon);
  const sinL = Math.sin(lon0);
  const cosL = Math.cos(lon0);
  const x1 = px * cosL - pz * sinL;
  const z1 = px * sinL + pz * cosL;
  const sinP = Math.sin(lat0);
  const cosP = Math.cos(lat0);
  const y2 = py * cosP - z1 * sinP;
  const z2 = py * sinP + z1 * cosP;
  out.x = cx + R * x1;
  out.y = cy - R * y2;
  return z2 > 0;
}

/**
 * Igual que projectPoint pero para un vector unitario (x, y, z) ya calculado y con
 * sin/cos precalculados: sirve para la esfera celeste (estrellas).
 * Devuelve z (>0 = delante de la cámara) y escribe x, y de pantalla en `out`.
 */
export function projectDir(px, py, pz, sinL, cosL, sinP, cosP, cx, cy, R, out) {
  const x1 = px * cosL - pz * sinL;
  const z1 = px * sinL + pz * cosL;
  const y2 = py * cosP - z1 * sinP;
  const z2 = py * sinP + z1 * cosP;
  out.x = cx + R * x1;
  out.y = cy - R * y2;
  return z2;
}
