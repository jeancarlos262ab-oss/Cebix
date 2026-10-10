/**
 * Cielo estrellado para MapLibre GL: una capa personalizada (custom layer) con shaders WebGL propios.
 * Equivale al cielo de Canvas 2D de globeStars.js, pero vive dentro del mismo contexto WebGL del mapa.
 *
 *  - Se añade DEBAJO de todas las capas (`map.addLayer(layer, "bg")`): el globo la tapa y solo se ve el
 *    espacio alrededor del planeta.
 *  - Estrellas = un solo buffer de puntos (gl.POINTS) calculado una vez; la mancha difusa = un cuadrilátero
 *    de pantalla completa cuyo shader la dibuja de forma procedural (franja inclinada + ruido suave).
 *  - El cielo gira con el planeta: se rota con el centro del mapa (lng, lat) y se proyecta con una
 *    acimutal equidistante centrada en el eje de la cámara, igual que globeStars.js.
 *  - No tiene animación propia: solo se pinta cuando el mapa se repinta (en reposo no gasta nada).
 */

/** Ajustes rápidos (mismo significado que SKY en globeStars.js). */
export const SKY_GL = {
  stars: 3000, // estrellas de campo (pocas y tenues, como en Google Earth)
  grains: 1500, // estrellas diminutas, algo más densas a lo largo de la mancha (solo si haze)
  haze: true, // mancha tenue y difusa que cruza las estrellas, estilo Google Earth (false = solo estrellas)
  reach: 1.5, // ángulo (rad) desde el eje de la cámara que llega a la esquina del lienzo
  zoom: 0.03, // cuánto se acerca el cielo con el zoom (0 = nada)
  hazeStrength: 0.5, // intensidad de la mancha (0–1)
};

const TINTS = [
  [1, 1, 1],
  [0.67, 0.78, 1],
  [1, 0.84, 0.66],
];

/** Generador pseudoaleatorio con semilla: el cielo es siempre el mismo. */
function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normal del plano de la mancha (vector unitario): la misma inclinación para las estrellas diminutas
// (CPU) y para el brillo difuso (shader).
const BAND_N = (() => {
  const v = [0.34, 0.86, 0.38];
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
})();

/** Datos de las estrellas: [x, y, z, tamaño(px), r, g, b, brillo] por estrella. */
function buildStars({ stars, grains }) {
  const rnd = mulberry32(7421);
  const out = [];
  const push = (x, y, z, size, tint, bright) => out.push(x, y, z, size, tint[0], tint[1], tint[2], bright);

  // Estrellas de campo repartidas por toda la esfera.
  for (let i = 0; i < stars; i++) {
    const y = 2 * rnd() - 1;
    const rr = Math.sqrt(1 - y * y);
    const phi = 2 * Math.PI * rnd();
    const u = rnd();
    const tint = TINTS[rnd() < 0.7 ? 0 : rnd() < 0.5 ? 1 : 2];
    if (u < 0.8) push(rr * Math.sin(phi), y, rr * Math.cos(phi), 1.6, tint, 0.35 + 0.25 * rnd());
    else if (u < 0.962) push(rr * Math.sin(phi), y, rr * Math.cos(phi), 2.4, tint, 0.65 + 0.2 * rnd());
    else push(rr * Math.sin(phi), y, rr * Math.cos(phi), 3.8 + 1.6 * rnd(), tint, 0.9 + 0.1 * rnd());
  }

  // Granos diminutos concentrados a lo largo de la banda (círculo máximo perpendicular a BAND_N).
  const [nx, ny, nz] = BAND_N;
  // Dos ejes ortogonales sobre el plano de la banda.
  let ax = ny * 1 - nz * 0;
  let ay = nz * 0 - nx * 1;
  let az = 0;
  const al = Math.hypot(ax, ay, az) || 1;
  ax /= al;
  ay /= al;
  az /= al;
  const bx = ny * az - nz * ay;
  const by = nz * ax - nx * az;
  const bz = nx * ay - ny * ax;
  for (let i = 0; i < grains; i++) {
    const t = 2 * Math.PI * rnd();
    const g = (rnd() + rnd() + rnd() - 1.5) / 1.5; // casi gaussiano
    const off = g * 0.12; // anchura de la mancha (rad)
    // punto sobre el círculo máximo, desplazado hacia la normal
    let x = Math.cos(t) * ax + Math.sin(t) * bx + off * nx;
    let y = Math.cos(t) * ay + Math.sin(t) * by + off * ny;
    let z = Math.cos(t) * az + Math.sin(t) * bz + off * nz;
    const l = Math.hypot(x, y, z);
    x /= l;
    y /= l;
    z /= l;
    push(x, y, z, 1.2, TINTS[0], 0.12 + 0.16 * rnd());
  }
  return new Float32Array(out);
}

/* ───────────── shaders ───────────── */

const STAR_VS = `
precision highp float;
attribute vec3 aDir;
attribute float aSize;
attribute vec3 aTint;
attribute float aBright;
uniform mat3 uRot;
uniform vec2 uRes;
uniform float uK;
uniform float uDpr;
uniform float uMaxAng;
varying vec3 vTint;
varying float vBright;
void main() {
  vec3 v = uRot * aDir;
  float s = length(v.xy);
  float ang = acos(clamp(-v.z, -1.0, 1.0));
  vec2 off = s > 1e-5 ? v.xy / s * uK * ang : vec2(0.0);
  if (ang > uMaxAng) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  } else {
    gl_Position = vec4(off / (uRes * 0.5), 0.99999, 1.0); // al fondo del buffer de profundidad
    gl_PointSize = aSize * uDpr;
  }
  vTint = aTint;
  vBright = aBright;
}`;

const STAR_FS = `
precision mediump float;
varying vec3 vTint;
varying float vBright;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.6) * vBright;
  gl_FragColor = vec4(vTint * a, a);
}`;

const SKY_VS = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.99999, 1.0); }`;

const SKY_FS = `
precision highp float;
uniform mat3 uRot;     // vista <- cielo; su transpuesta hace la inversa
uniform vec2 uRes;
uniform float uK;
uniform float uMaxAng;
uniform vec3 uBandN;
uniform float uStrength;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec2 d = (gl_FragCoord.xy - uRes * 0.5) / uK;
  float ang = length(d);
  if (ang > uMaxAng) discard;
  vec2 dir = ang > 1e-5 ? d / ang : vec2(0.0);
  vec3 v = vec3(dir * sin(ang), -cos(ang));
  vec3 p = normalize(v * uRot); // v * M == transpose(M) * v

  // Mancha: una franja estrecha y suave, de brillo desigual, sin colores ni vetas.
  float lat = dot(p, uBandN);
  float haze = exp(-pow(lat / 0.085, 2.0));
  float soft = exp(-pow(lat / 0.22, 2.0)) * 0.25;
  float patch = 0.35 + 0.65 * smoothstep(0.25, 0.75, fbm(p * 2.2));
  float a = (haze + soft) * patch * uStrength * 0.16;
  vec3 col = vec3(0.80, 0.85, 0.95) * a; // blanco azulado muy tenue
  gl_FragColor = vec4(col, a);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader del cielo: ${log}`);
  }
  return sh;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  const a = compile(gl, gl.VERTEX_SHADER, vs);
  const b = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, a);
  gl.attachShader(p, b);
  gl.linkProgram(p);
  gl.deleteShader(a);
  gl.deleteShader(b);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`Programa del cielo: ${log}`);
  }
  return p;
}

/** Matriz de vista (column-major) a partir del centro del mapa: Rx(lat) · Ry(-lng). */
function viewMatrix(lngDeg, latDeg, out) {
  const l = (lngDeg * Math.PI) / 180;
  const p = (latDeg * Math.PI) / 180;
  const c = Math.cos(l);
  const s = Math.sin(l);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  // filas
  const m00 = c, m01 = 0, m02 = -s;
  const m10 = -sp * s, m11 = cp, m12 = -sp * c;
  const m20 = cp * s, m21 = sp, m22 = cp * c;
  out[0] = m00; out[1] = m10; out[2] = m20;
  out[3] = m01; out[4] = m11; out[5] = m21;
  out[6] = m02; out[7] = m12; out[8] = m22;
  return out;
}

/**
 * Crea la capa personalizada. Uso:
 *   map.addLayer(createStarsLayer(), "bg");
 * @param {object} [opts] sobrescribe SKY_GL
 */
export function createStarsLayer(opts = {}) {
  const cfg = { ...SKY_GL, ...opts };
  const mat = new Float32Array(9);
  let gl = null;
  let mapRef = null;
  let starProg = null;
  let skyProg = null;
  let starBuf = null;
  let quadBuf = null;
  let starCount = 0;
  let starLoc = null;
  let skyLoc = null;

  return {
    id: "sky-stars",
    type: "custom",
    renderingMode: "2d",

    onAdd(map, context) {
      gl = context;
      mapRef = map;
      const data = buildStars(cfg);
      starCount = data.length / 8;
      starBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      starProg = program(gl, STAR_VS, STAR_FS);
      starLoc = {
        aDir: gl.getAttribLocation(starProg, "aDir"),
        aSize: gl.getAttribLocation(starProg, "aSize"),
        aTint: gl.getAttribLocation(starProg, "aTint"),
        aBright: gl.getAttribLocation(starProg, "aBright"),
        uRot: gl.getUniformLocation(starProg, "uRot"),
        uRes: gl.getUniformLocation(starProg, "uRes"),
        uK: gl.getUniformLocation(starProg, "uK"),
        uDpr: gl.getUniformLocation(starProg, "uDpr"),
        uMaxAng: gl.getUniformLocation(starProg, "uMaxAng"),
      };
      if (cfg.haze) {
        skyProg = program(gl, SKY_VS, SKY_FS);
        skyLoc = {
          aPos: gl.getAttribLocation(skyProg, "aPos"),
          uRot: gl.getUniformLocation(skyProg, "uRot"),
          uRes: gl.getUniformLocation(skyProg, "uRes"),
          uK: gl.getUniformLocation(skyProg, "uK"),
          uMaxAng: gl.getUniformLocation(skyProg, "uMaxAng"),
          uBandN: gl.getUniformLocation(skyProg, "uBandN"),
          uStrength: gl.getUniformLocation(skyProg, "uStrength"),
        };
      }
    },

    render(ctx) {
      const map = mapRef;
      const w = ctx.drawingBufferWidth;
      const h = ctx.drawingBufferHeight;
      const c = map.getCenter();
      viewMatrix(c.lng, c.lat, mat);
      const maxAng = cfg.reach + 0.4;
      const zoomScale = 1 + cfg.zoom * 5 * Math.min(Math.max(map.getZoom(), 0) / 19, 1); // máx. ≈ +15 %
      const k = (0.5 * Math.hypot(w, h) * zoomScale) / cfg.reach;

      // MapLibre pinta antes el fondo/globo opaco (escribe profundidad) y después las capas
      // personalizadas: el cielo se dibuja en el fondo del buffer de profundidad y sin escribirla,
      // así solo aparece donde no hay planeta.
      ctx.enable(ctx.DEPTH_TEST);
      ctx.depthFunc(ctx.LEQUAL);
      ctx.depthMask(false);
      ctx.disable(ctx.CULL_FACE);
      ctx.enable(ctx.BLEND);
      ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);

      // 1) Mancha difusa (pantalla completa).
      if (skyProg) {
        ctx.useProgram(skyProg);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuf);
        ctx.enableVertexAttribArray(skyLoc.aPos);
        ctx.vertexAttribPointer(skyLoc.aPos, 2, ctx.FLOAT, false, 0, 0);
        ctx.uniformMatrix3fv(skyLoc.uRot, false, mat);
        ctx.uniform2f(skyLoc.uRes, w, h);
        ctx.uniform1f(skyLoc.uK, k);
        ctx.uniform1f(skyLoc.uMaxAng, maxAng);
        ctx.uniform3f(skyLoc.uBandN, BAND_N[0], BAND_N[1], BAND_N[2]);
        ctx.uniform1f(skyLoc.uStrength, cfg.hazeStrength);
        ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
        ctx.disableVertexAttribArray(skyLoc.aPos);
      }

      // 2) Estrellas.
      ctx.useProgram(starProg);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, starBuf);
      const stride = 8 * 4;
      const bind = (loc, size, off) => {
        ctx.enableVertexAttribArray(loc);
        ctx.vertexAttribPointer(loc, size, ctx.FLOAT, false, stride, off * 4);
      };
      bind(starLoc.aDir, 3, 0);
      bind(starLoc.aSize, 1, 3);
      bind(starLoc.aTint, 3, 4);
      bind(starLoc.aBright, 1, 7);
      ctx.uniformMatrix3fv(starLoc.uRot, false, mat);
      ctx.uniform2f(starLoc.uRes, w, h);
      ctx.uniform1f(starLoc.uK, k);
      ctx.uniform1f(starLoc.uDpr, Math.min(window.devicePixelRatio || 1, 2));
      ctx.uniform1f(starLoc.uMaxAng, maxAng);
      ctx.drawArrays(ctx.POINTS, 0, starCount);
      ctx.disableVertexAttribArray(starLoc.aDir);
      ctx.disableVertexAttribArray(starLoc.aSize);
      ctx.disableVertexAttribArray(starLoc.aTint);
      ctx.disableVertexAttribArray(starLoc.aBright);
      ctx.depthMask(true);
    },

    onRemove() {
      if (!gl) return;
      gl.deleteBuffer(starBuf);
      gl.deleteBuffer(quadBuf);
      gl.deleteProgram(starProg);
      if (skyProg) gl.deleteProgram(skyProg);
      gl = null;
    },
  };
}
