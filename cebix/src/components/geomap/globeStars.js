/**
 * Cielo del globo: estrellas + Vía Láctea realista, en Canvas 2D.
 *
 * Diseño ligero:
 *  - Todo se calcula UNA vez al crear el cielo (vectores unitarios en Float32Array).
 *    Por cuadro solo se proyectan ~2000 puntos y se pintan en pocos trazos.
 *  - La Vía Láctea va FIJA al cielo: rota junto con las estrellas (misma orientación y velocidad).
 *    Su brillo y su polvo (lo caro: ~260 sprites grandes) se pintan en capas de baja resolución
 *    que se reutilizan entre cuadros desplazándolas, y se reproyectan exactas cada pocos píxeles.
 *  - Se dibuja dentro del mismo render() de GlobeMap: en reposo no gasta nada.
 *    No hay animación propia ni requestAnimationFrame.
 *  - Las estrellas rotan cuando se gira el globo, en el MISMO sentido que el planeta
 *    (SKY.direction) y en sincronía angular con él (SKY.speed = 1: vuelta completa del globo =
 *    vuelta completa del cielo). La Vía Láctea rota igual que las estrellas (SKY.mwSpeed = 1).
 *    Las rotaciones se acumulan en ángulo (camino corto en longitud, sin saltos al cruzar 180°).
 *  - Proyección acimutal equidistante de campo moderado (SKY.reach): sin la deformación
 *    de los bordes que daba la sensación de estar dentro de una caja.
 *  - Vía Láctea = brillo difuso aditivo (sprites precalculados) + estrellas diminutas
 *    + vetas de polvo oscuro, todo a lo largo de una banda inclinada. Sin gradientes
 *    ni filtros por cuadro.
 */
import { projectDir } from "./globeRender.js";

/** Ajustes rápidos. */
export const SKY = {
  stars: 4200, // estrellas de campo: muchas y tenues, como en Google Earth
  milkyWay: true, // Vía Láctea: brillo difuso + vetas oscuras de polvo + estrellas diminutas
  glow: 170, // manchas de brillo difuso a lo largo de la banda
  lanes: 90, // manchas oscuras (polvo que absorbe la luz)
  grains: 5000, // estrellas diminutas sin resolver, concentradas en la banda
  reach: 1.5, // ángulo (rad) desde el eje de la cámara que llega a la esquina del lienzo
  // Giro del cielo respecto al del globo, en ÁNGULO: 1 = sincronía exacta (cuando el globo da una
  // vuelta completa, el cielo también da una vuelta completa y vuelve a la misma posición);
  // 0 = cielo fijo; 0.1 = estrellas muy lejanas que casi no giran.
  speed: 1,
  // Giro de la Vía Láctea respecto al de las estrellas, en ÁNGULO: 1 = rota exactamente igual que
  // las estrellas (valor actual); 0 = quieta; 0.06 = muy lenta, como algo lejanísimo.
  mwSpeed: 1,
  lowRes: 0.35, // resolución (0-1) de las capas de brillo y polvo (son difusas: no necesitan más)
  // Cuánto se acerca el cielo al hacer zoom al globo (0 = nada; 0.03 = casi nada: con el zoom
  // máximo el cielo crece ~15%). Afecta a estrellas y a la Vía Láctea por igual.
  zoom: 0.03,
  // Sentido del giro del cielo: 1 = el cielo se mueve en la misma dirección que la superficie del
  // planeta (todo gira "con" el planeta);
  // -1 = sentido contrario (el de un cielo fijo en el espacio visto tras la órbita de la cámara).
  direction: 1,
};

// Fracción de la resolución de la capa de brillo mientras el globo se mueve (en reposo: 1).
const GLOW_FAST = 0.5;
// Fracción de granos de la Vía Láctea y de estrellas tenues que se pintan mientras el globo se mueve.
const GRAIN_FAST = 0.3;
const STAR_FAST = 0.55;

const TINTS = [
  [255, 255, 255], // blanca
  [170, 200, 255], // azulada
  [255, 214, 168], // cálida
];

// Brillo de la Vía Láctea: cálido (núcleo), neutro y frío (brazos).
const GLOW_TINTS = [
  [222, 196, 164], // pardo cálido (núcleo)
  [206, 200, 198], // gris neutro
  [176, 190, 214], // gris azulado
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

/** Número casi gaussiano (suma de 3 uniformes), rango ≈ [-1, 1]. */
const gauss = (rnd) => (rnd() + rnd() + rnd() - 1.5) / 1.5;

/** Sprites precalculados: estrellas (halo), brillo difuso y mancha oscura de polvo. */
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

/**
 * Proyecta un punto de la esfera celeste con acimutal equidistante centrada en el eje de la
 * cámara (el cielo que queda detrás del globo): radio en pantalla = k · ángulo.
 * Reutiliza projectDir() para el giro (con R=1 devuelve x1, -y2 y z2).
 * Devuelve false si el punto cae más allá del alcance.
 */
const LIM = -Math.cos(SKY.reach + 0.4); // más allá de la esquina: la caché lleva margen y se desplaza sin huecos
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
  /* ───────────── datos (una sola vez) ───────────── */
  const rnd = mulberry32(7421);

  // Estrellas de fondo, repartidas por toda la esfera.
  const faint = [];
  const mid = [];
  const bright = []; // x, y, z, tamaño, tinte
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

  // Vía Láctea: un círculo máximo inclinado. Ángulo 0 = núcleo galáctico (más brillante y cálido).
  // Base ortonormal del plano de la banda: (ex, ey), normal n.
  const nrm = [0.32, 0.82, 0.47];
  const nl = Math.hypot(...nrm);
  const n = nrm.map((v) => v / nl);
  let ex = [n[1], -n[0], 0]; // ⟂ n
  const el = Math.hypot(...ex);
  ex = ex.map((v) => v / el);
  const ey0 = [n[1] * ex[2] - n[2] * ex[1], n[2] * ex[0] - n[0] * ex[2], n[0] * ex[1] - n[1] * ex[0]];
  // Base girada 90°: así el núcleo (ángulo 0) queda en la parte del cielo que se ve detrás del
  // globo, y la banda es un ARCO que se desvanece hacia los extremos (no un anillo completo).
  const bx = ey0;
  const by = ex.map((v) => -v);
  /** Punto en la banda: ángulo a lo largo, desvío fuera del plano (rad). */
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
  /** 1 en el núcleo, cae hacia el lado opuesto de la banda. */
  const ARC = 2.4; // semiancho (rad) del tramo de banda que se dibuja
  const coreness = (a) => Math.exp(-(a * a) / (2 * 0.85 * 0.85));

  // Brillo difuso: x, y, z, radio angular (rad), alfa, tinte. Se suma (lighter) a lo largo de la banda.
  const gl = [];
  for (let i = 0; i < SKY.glow; i++) {
    const a = ((i + rnd()) / SKY.glow) * ARC * 2 - ARC; // solo el arco [-ARC, ARC]
    const core = coreness(a);
    const v = onBand(a, gauss(rnd) * 0.1); // banda más ancha y difusa
    const warm = core > 0.5 && rnd() < 0.7;
    gl.push(
      v[0], v[1], v[2],
      0.16 + rnd() * 0.16 + core * 0.06,
      core * (0.55 + 0.45 * rnd()), // se apaga hacia los extremos del arco
      warm ? 0 : rnd() < 0.5 ? 1 : 2,
    );
  }
  for (let i = 0; i < 8; i++) {
    // protuberancia del núcleo
    const v = onBand(gauss(rnd) * 0.25, gauss(rnd) * 0.09);
    gl.push(v[0], v[1], v[2], 0.2 + rnd() * 0.12, 0.9, 0);
  }
  const GL = new Float32Array(gl);

  // Vetas de polvo oscuro: un sendero continuo y sinuoso a un lado del eje de la banda
  // (como la Gran Grieta), hecho de muchas manchas pequeñas y tenues que se solapan.
  const ln = [];
  for (let i = 0; i < SKY.lanes; i++) {
    const a = (i / (SKY.lanes - 1) * 2 - 1) * 1.7 + (rnd() - 0.5) * 0.04;
    const off = 0.025 + 0.03 * Math.sin(a * 3.1 + 1) + gauss(rnd) * 0.02;
    const v = onBand(a, off);
    ln.push(v[0], v[1], v[2], 0.06 + rnd() * 0.07, (0.25 + 0.35 * rnd()) * coreness(a));
  }
  const LN = new Float32Array(ln);

  // Estrellas diminutas sin resolver (la "textura" de la banda), más densas hacia el núcleo.
  const g0 = [];
  const g1 = [];
  for (let i = 0; i < SKY.grains; i++) {
    const a = gauss(rnd) * 1.5; // concentrados en el arco, ralos hacia los extremos
    const v = onBand(a, gauss(rnd) * 0.11);
    (coreness(a) > 0.4 && rnd() < 0.6 ? g1 : g0).push(v[0], v[1], v[2]);
  }
  const G0 = new Float32Array(g0);
  const G1 = new Float32Array(g1);

  let sprites = null;
  const pt = { x: 0, y: 0 };
  // Estado de rotación del cielo (ver draw): ángulos acumulados y última vista dibujada.
  let aLon = 0;
  let aLat = 0;
  let mLon = 0; // rotación acumulada de la Vía Láctea (más lenta que la de las estrellas)
  let mLat = 0;
  let pLon = null;
  let pLat = null;

  /* ───────────── capas de baja resolución (brillo y polvo) ───────────── */
  // El brillo y el polvo son difusos y caros (~260 sprites grandes), así que se pintan en lienzos
  // auxiliares a baja resolución (SKY.lowRes) y se escalan al copiarlos. Se reproyectan exactos en
  // cada cuadro: el movimiento es continuo, sin saltos.
  const MARGIN = 0; // px de margen alrededor de la pantalla para poder desplazar la capa
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

  /** Reproyecta brillo y polvo con la orientación actual (coste completo, a baja resolución). */
  function buildLayers(cw, ch, zs, ks, sinL, cosL, sinP, cosP, fast) {
    const sc = lay.w / lay.dw;
    // El brillo es muy difuso (manchas de ≥ 70 px): mientras el globo se mueve se pinta a una
    // fracción de la resolución, en la esquina del mismo lienzo (sin reasignar nada), y se
    // escala al copiarlo. En reposo (fast = false) se pinta completo, igual que antes.
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
      if (a < 0.0015) continue; // invisible (<½ nivel de 8 bits)
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

  /* ───────────── dibujo (por cuadro) ───────────── */
  /**
   * Dibuja el cielo ANTES de la esfera (la esfera, opaca, tapa lo que queda detrás).
   * @param {CanvasRenderingContext2D} ctx
   * @param {{cw:number,ch:number,lon0:number,lat0:number,q:number}} p
   *        lon0/lat0 en radianes (los mismos que la esfera); q = densidad del lienzo;
   *        zoom = zoom actual del globo (para mantener la velocidad relativa al planeta).
   */
  function draw(ctx, { cw, ch, lon0, lat0, q, zoom = 1, fast = false }) {
    if (!sprites) sprites = makeSprites();
    const k = (Math.hypot(cw, ch) * 0.5) / SKY.reach; // px por radián
    // Zoom del cielo: crece una fracción mínima de lo que crece el planeta (nunca por debajo de 1,
    // para no dejar bordes vacíos). ks = px por radián con ese zoom.
    const zs = 1 + (Math.max(1, zoom) - 1) * SKY.zoom;
    const ks = k * zs;

    // Rotación acumulada del cielo: el giro del globo (camino corto en longitud, sin saltos al
    // cruzar los 180°) multiplicado por SKY.speed.
    if (pLon === null) {
      pLon = lon0;
      pLat = lat0;
    }
    const dLon = lon0 - pLon;
    // El cielo se proyecta DETRÁS del globo: con la misma rotación que la esfera se movería al
    // revés que la superficie frontal. Por eso el factor lleva signo negativo (× direction), para
    // que gire en el mismo sentido que el planeta. La rotación se acumula en ÁNGULO (no en píxeles):
    // con speed = 1 una vuelta completa del globo es una vuelta completa del cielo.
    const f = -SKY.direction * SKY.speed;
    const dl = dLon - Math.PI * 2 * Math.round(dLon / (Math.PI * 2)); // camino corto
    const dp = lat0 - pLat;
    aLon += dl * f;
    aLat += dp * f;
    // La Vía Láctea sigue el mismo giro pero muy atenuado (está mucho más lejos).
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
      // Reproyección EXACTA en cada cuadro (como las estrellas): así la banda se mueve de forma
      // continua y recta. Reutilizar la capa desplazándola era más barato, pero cada
      // reconstrucción producía un pequeño salto y la Vía Láctea se veía avanzar "a golpes".
      // El coste se mantiene bajo porque las capas son de baja resolución.
      buildLayers(cw, ch, zs, ks, sinM, cosM, sinQ, cosQ, fast);
      const ox = 0;
      const oy = 0;
      const rx = ox - MARGIN;
      const ry = oy - MARGIN;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";

      // 1) Brillo difuso (capa).
      ctx.drawImage(lay.glow.canvas, 0, 0, lay.gW, lay.gH, rx, ry, lay.dw, lay.dh);

      // 2) Estrellas diminutas de la banda: un solo trazo por color (a resolución completa).
      // Mientras el globo se mueve se pinta solo una fracción de los granos (una muestra uniforme: el
      // arreglo ya está barajado) con más opacidad, para que la banda conserve su brillo y textura.
      // En reposo (fast = false) se pintan todos, igual que antes.
      const gf = fast ? GRAIN_FAST : 1;
      const ga = fast ? 1 / GRAIN_FAST : 1; // misma cobertura total (tope: opacidad 1)
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

      // 3) Polvo oscuro (capa): tapa brillo y granos, formando las vetas.
      ctx.drawImage(lay.dust.canvas, rx, ry, lay.dw, lay.dh);
    }

    // Estrellas tenues y medias: un solo trazo por grupo.
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

    // Estrellas brillantes: sprite con halo.
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
