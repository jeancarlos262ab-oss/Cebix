/**
 * Geometría de las parcelas vistas desde el cielo en perspectiva oblicua.
 *
 * Un terreno plano (u = lateral, v = profundidad) se divide recursivamente en
 * parcelas rectangulares con calle entre ellas, y cada esquina se proyecta
 * con una cámara inclinada: las líneas convergen hacia el horizonte y las
 * parcelas cercanas se ven grandes y las lejanas pequeñas.
 *
 * Sobre el horizonte se dibuja una sierra de minimontañas (MOUNTAINS).
 *
 * Todo es determinista (misma ilustración en cada carga) y se calcula una sola
 * vez al importar el módulo.
 */

export const VIEW_W = 1200;
export const VIEW_H = 900;

// ---- Cámara ---------------------------------------------------------------
const YAW = 0.42; // giro del terreno (rad): da la diagonal característica
const HORIZON_Y = 240; // línea de horizonte: arriba queda lugar para las montañas
const FOCAL = 430;
const CAM_HEIGHT = 3.4;
const DEPTH_OFFSET = 4;
const CENTER_X = 560;

const rnd = (n) => {
  const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

const f = (n) => Number(n.toFixed(1));

function project(u, v) {
  const x = u * Math.cos(YAW) - v * Math.sin(YAW);
  const z = u * Math.sin(YAW) + v * Math.cos(YAW) + DEPTH_OFFSET;
  const k = FOCAL / z;
  return { x: CENTER_X + x * k, y: HORIZON_Y + CAM_HEIGHT * k, k, z };
}

const lerp = (a, b, t) => a + (b - a) * t;

// ---- Subdivisión en parcelas ---------------------------------------------
function split(rect, depth, seed, out) {
  const { u0, u1, v0, v1 } = rect;
  const w = u1 - u0;
  const h = v1 - v0;
  const big = w > 4.2 || h > 4.2;
  const small = w < 3.2 && h < 3.2;
  const stop = !big && (depth >= 12 || (small && rnd(seed) < 0.3) || (w < 1.4 && h < 1.4));

  if (stop) {
    out.push(rect);
    return;
  }

  const cut = 0.34 + rnd(seed + 1) * 0.32;
  const alongU = w > h ? true : h > w ? false : rnd(seed + 2) > 0.5;

  if (alongU) {
    const m = lerp(u0, u1, cut);
    split({ u0, u1: m, v0, v1 }, depth + 1, seed * 2 + 3, out);
    split({ u0: m, u1, v0, v1 }, depth + 1, seed * 2 + 4, out);
  } else {
    const m = lerp(v0, v1, cut);
    split({ u0, u1, v0, v1: m }, depth + 1, seed * 2 + 3, out);
    split({ u0, u1, v0: m, v1 }, depth + 1, seed * 2 + 4, out);
  }
}

function buildParcels() {
  const rects = [];
  split({ u0: -34, u1: 34, v0: -14, v1: 44 }, 0, 7, rects);
  // Terreno lejano: continúa el trazado hacia el horizonte.
  split({ u0: -150, u1: 150, v0: 44, v1: 200 }, 6, 101, rects);
  split({ u0: -150, u1: -34, v0: -14, v1: 44 }, 6, 211, rects);
  split({ u0: 34, u1: 150, v0: -14, v1: 44 }, 6, 307, rects);

  const GAP = 0.16;
  const outline = [];
  const rows = [];
  const dots = [];
  const tint = [];
  let count = 0;

  rects.forEach((r, index) => {
    const u0 = r.u0 + GAP;
    const u1 = r.u1 - GAP;
    const v0 = r.v0 + GAP;
    const v1 = r.v1 - GAP;
    if (u1 - u0 < 0.4 || v1 - v0 < 0.4) return;

    const corners = [project(u0, v0), project(u1, v0), project(u1, v1), project(u0, v1)];
    const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
    const cy = corners.reduce((s, c) => s + c.y, 0) / 4;

    // Descarta lo que queda detrás/pegado a la cámara o fuera del encuadre.
    if (corners.some((c) => c.z < 1.4)) return;
    if (cy > VIEW_H + 260 || cy < -120 || cx < -300 || cx > VIEW_W + 300) return;

    const widthPx = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const heightPx = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
    if (widthPx < 12 || heightPx < 4) return;

    const d = `M${corners.map((c) => `${f(c.x)} ${f(c.y)}`).join("L")}Z`;
    outline.push(d);
    count += 1;

    const pick = rnd(index * 3.7 + 1);
    const near = corners.reduce((s, c) => s + c.k, 0) / 4;

    if (pick < 0.3) {
      // Surcos: solo en parcelas de tamaño apreciable.
      if (widthPx < 30 || heightPx < 12) return;
      const rowsAlongU = rnd(index + 9) > 0.5;
      const span = rowsAlongU ? v1 - v0 : u1 - u0;
      const n = Math.max(4, Math.min(14, Math.round(span / 0.4)));
      for (let i = 1; i < n; i += 1) {
        const t = i / n;
        const pa = rowsAlongU ? project(u0, lerp(v0, v1, t)) : project(lerp(u0, u1, t), v0);
        const pb = rowsAlongU ? project(u1, lerp(v0, v1, t)) : project(lerp(u0, u1, t), v1);
        rows.push(`M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`);
      }
    } else if (pick < 0.5) {
      // Puntos de cultivo: solo cerca, y pocos.
      if (near < 6) return;
      const step = 0.5;
      const pts = [];
      for (let u = u0 + step; u < u1 - step / 2; u += step) {
        for (let v = v0 + step; v < v1 - step / 2; v += step) {
          const p = project(u, v);
          pts.push(`M${f(p.x)} ${f(p.y)}h0.01`);
        }
      }
      if (pts.length <= 90) dots.push(...pts);
    } else if (pick < 0.62) {
      tint.push(d);
    }
  });

  return {
    outline: outline.join(""),
    rows: rows.join(""),
    dots: dots.join(""),
    tint: tint.join(""),
    count,
  };
}

// Todo el trazado en solo cuatro paths: el navegador dibuja 4 elementos, no miles.
export const PARCELS = buildParcels();

// ---- Montañas a lo lejos --------------------------------------------------
// Una sierra lejana que nace en el horizonte: una cresta
// irregular (ruido de valores "ridged", que da picos agudos) y se dibuja de la
// más lejana (baja, tenue) a la más cercana (alta, más marcada).
const smooth = (t) => t * t * (3 - 2 * t);

function noise(x, seed) {
  const i = Math.floor(x);
  const t = smooth(x - i);
  return lerp(rnd(i * 1.37 + seed), rnd((i + 1) * 1.37 + seed), t);
}

function ridgeHeight(x, seed, freq) {
  let h = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < 4; o += 1) {
    const n = noise(x * freq * 2 ** o, seed + o * 17);
    h += (1 - Math.abs(2 * n - 1)) * amp; // 1 en el pico, 0 en el valle
    norm += amp;
    amp *= 0.5;
  }
  return h / norm;
}

function buildMountains() {
  const X0 = -400;
  const X1 = VIEW_W + 400;
  const STEP = 8;

  // Una sola cresta, baja y con muchos picos pequeños: se lee como una sierra
  // muy lejana, pegada al horizonte.
  const layers = [{ seed: 11, freq: 0.014, height: 38, foot: 0, opacity: 0.32 }];

  return layers.map(({ seed, freq, height, foot, opacity }) => {
    const base = HORIZON_Y + foot;
    const pts = [];
    for (let x = X0; x <= X1; x += STEP) {
      const h = ridgeHeight(x, seed, freq) ** 1.3;
      pts.push([x, base - 1 - h * height]);
    }
    const ridge = `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`;
    const fill = `${ridge}L${X1} ${base}L${X0} ${base}Z`;
    return { ridge, fill, opacity };
  });
}

export const MOUNTAINS = buildMountains();

// ---- Nubes ----------------------------------------------------------------
// Solo óvalos estirados. Cada nube es un racimo: un óvalo grande y otros que
// se achican y se escalonan hacia un lado, como un altocúmulo que se deshace
// con el viento. Todo en un solo path. Perspectiva: arriba (cerca) son
// grandes; hacia el horizonte (lejos) son pequeñas y más planas.
function oval(cx, cy, rx, ry) {
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
}

function buildClouds() {
  const TOP = 30;
  const BOTTOM = HORIZON_Y - 55; // por encima de las montañas

  // [x, y, hacia dónde se deshace (1 = derecha, -1 = izquierda)]
  const list = [
    [230, 50, 1], [740, 38, 1], [1040, 90, 1], [470, 96, -1], [110, 128, 1],
    [900, 142, -1], [620, 162, 1], [1140, 172, -1], [330, 174, 1],
  ];

  const parts = [];
  const placed = []; // óvalos ya dibujados, para que nunca se crucen
  const free = (x, y, rx, ry) =>
    placed.every((o) => Math.abs(x - o.x) > (rx + o.rx) * 1.04 || Math.abs(y - o.y) > (ry + o.ry) * 1.3);
  list.forEach(([x0, y0, dir], k) => {
    const t = Math.min(1, Math.max(0, (y0 - TOP) / (BOTTOM - TOP))); // 0 cerca, 1 lejos
    const seed = 50 + k * 19;
    const flat = lerp(0.2, 0.11, t); // cuánto se aplasta el óvalo
    let rx = lerp(86, 30, t) * (0.85 + rnd(seed) * 0.3);
    const n = 3 + Math.floor(rnd(seed + 1) * 3); // 3 a 5 óvalos
    let x = x0;
    let y = y0;
    for (let i = 0; i < n && rx > 9; i += 1) {
      const ry = rx * flat * (0.85 + rnd(seed + i * 3 + 2) * 0.3);
      if (free(x, y, rx, ry)) {
        placed.push({ x, y, rx, ry });
        parts.push(oval(x, y, rx, ry));
      }
      // Siguiente óvalo: más chico, un poco más abajo y pegado al anterior.
      const next = rx * (0.5 + rnd(seed + i * 5 + 3) * 0.25);
      x += dir * (rx + next * 1.15);
      y += ry * (1.2 + rnd(seed + i * 7 + 4) * 1.6);
      rx = next;
    }
  });

  return parts.join("");
}

export const CLOUDS = buildClouds();
