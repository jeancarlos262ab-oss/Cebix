/**
 * Malla de relleno que se adapta a la forma de la parcela (efecto "perspectiva").
 *
 * La parcela se trata como un parche con cuatro bordes y se rellena con una malla interpolada entre
 * ellos (parche de Coons). En un triángulo, uno de los cuatro bordes se reduce a un punto: las líneas
 * convergen hacia ese vértice y las demás corren paralelas al lado opuesto. En un cuadrilátero la malla
 * se deforma según los lados; en polígonos de más lados, los vértices se reparten en cuatro tramos.
 * Las líneas se recortan al contorno, así que nunca se salen de la parcela.
 *
 * Todo se calcula en un plano local (lng escalada por cos(lat)); la interpolación es afín-invariante,
 * así que el resultado no depende de esa escala.
 */

const EPS = 1e-9;

/** Punto a una fracción `u` (0–1) de la longitud de una cadena de puntos. */
function chainAt(chain, u) {
  if (chain.length === 1) return chain[0];
  const lens = [0];
  for (let i = 1; i < chain.length; i++) {
    lens.push(lens[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]));
  }
  const total = lens[lens.length - 1];
  if (total < EPS) return chain[0];
  const target = Math.min(1, Math.max(0, u)) * total;
  let i = 1;
  while (i < chain.length - 1 && lens[i] < target) i++;
  const span = lens[i] - lens[i - 1] || 1;
  const f = (target - lens[i - 1]) / span;
  return [
    chain[i - 1][0] + (chain[i][0] - chain[i - 1][0]) * f,
    chain[i - 1][1] + (chain[i][1] - chain[i - 1][1]) * f,
  ];
}

/** Vértices desde el índice `a` hasta el `b` (avanzando y dando la vuelta si hace falta). */
function loopChain(P, a, b) {
  const out = [P[a]];
  let i = a;
  while (i !== b) {
    i = (i + 1) % P.length;
    out.push(P[i]);
  }
  return out;
}

function pointInPolygon([x, y], P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Parámetros t (0–1) donde el segmento a→b cruza algún lado del polígono. */
function crossings(a, b, P) {
  const ts = [];
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  for (let i = 0; i < P.length; i++) {
    const c = P[i];
    const d = P[(i + 1) % P.length];
    const sx = d[0] - c[0];
    const sy = d[1] - c[1];
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < EPS) continue;
    const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
    const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  return ts;
}

/** Recorta una polilínea al interior del polígono; devuelve varios tramos continuos. */
function clipToPolygon(line, P) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const ts = [0, ...crossings(a, b, P).sort((x, y) => x - y), 1];
    for (let k = 0; k < ts.length - 1; k++) {
      const t0 = ts[k];
      const t1 = ts[k + 1];
      if (t1 - t0 < EPS) continue;
      const mid = (t0 + t1) / 2;
      if (!pointInPolygon([a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid], P)) {
        cur = null;
        continue;
      }
      const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const last = cur && cur[cur.length - 1];
      if (last && Math.hypot(last[0] - p0[0], last[1] - p0[1]) < 1e-7) {
        cur.push(p1);
      } else {
        cur = [p0, p1];
        runs.push(cur);
      }
    }
  }
  return runs;
}

/** Elige los cuatro bordes (bot, right, topRev, leftRev) según el número de vértices. */
function boundaries(P) {
  const n = P.length;
  if (n === 3) {
    // El vértice opuesto al lado más largo es el punto de fuga; el lado más largo queda como base.
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < 3; i++) {
      const l = Math.hypot(P[(i + 1) % 3][0] - P[i][0], P[(i + 1) % 3][1] - P[i][1]);
      if (l > bestLen) {
        bestLen = l;
        best = i;
      }
    }
    const A = P[best];
    const B = P[(best + 1) % 3];
    const C = P[(best + 2) % 3];
    return { bot: [A, B], right: [B, C], topRev: [C], leftRev: [C, A] };
  }

  // Cuatro esquinas que reparten el perímetro en cuartos (con 4 vértices son los propios vértices).
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    cum.push(cum[i - 1] + Math.hypot(P[i % n][0] - P[i - 1][0], P[i % n][1] - P[i - 1][1]));
  }
  const total = cum[n];
  const corners = [0];
  for (let k = 1; k <= 3; k++) {
    const target = (k * total) / 4;
    let pick = corners[k - 1] + 1;
    for (let i = corners[k - 1] + 1; i <= n - (4 - k); i++) {
      if (Math.abs(cum[i] - target) < Math.abs(cum[pick] - target)) pick = i;
    }
    corners.push(pick);
  }
  const [c0, c1, c2, c3] = corners;
  return {
    bot: loopChain(P, c0, c1),
    right: loopChain(P, c1, c2),
    topRev: loopChain(P, c2, c3),
    leftRev: loopChain(P, c3, c0),
  };
}

/**
 * @param {[number, number][]} points  vértices [lat, lng] de la parcela (≥ 3, sin repetir el primero)
 * @param {{divisions?: number, samples?: number}} [opts]
 * @returns {[number, number][][]} polilíneas [lat, lng] de la malla, ya recortadas a la parcela
 */
export function parcelGridLines(points, { divisions = 12, samples = 32 } = {}) {
  if (!points || points.length < 3) return [];
  const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180) || 1;
  const P = points.map(([lat, lng]) => [lng * k, lat]); // [x, y]

  const { bot, right, topRev, leftRev } = boundaries(P);
  const Bot = (s) => chainAt(bot, s);
  const Right = (t) => chainAt(right, t);
  const Top = (s) => chainAt(topRev, 1 - s);
  const Left = (t) => chainAt(leftRev, 1 - t);
  const P00 = Bot(0);
  const P10 = Bot(1);
  const P11 = Top(1);
  const P01 = Top(0);

  // Parche de Coons: dos interpolaciones entre bordes opuestos menos la bilineal de las esquinas.
  const surface = (s, t) => {
    const b = Bot(s);
    const tp = Top(s);
    const l = Left(t);
    const r = Right(t);
    return [0, 1].map(
      (i) =>
        (1 - t) * b[i] + t * tp[i] + (1 - s) * l[i] + s * r[i] -
        ((1 - s) * (1 - t) * P00[i] + s * (1 - t) * P10[i] + (1 - s) * t * P01[i] + s * t * P11[i]),
    );
  };

  const lines = [];
  for (let i = 1; i < divisions; i++) {
    const f = i / divisions;
    const alongT = Array.from({ length: samples + 1 }, (_, j) => surface(f, j / samples)); // s constante
    const alongS = Array.from({ length: samples + 1 }, (_, j) => surface(j / samples, f)); // t constante
    lines.push(...clipToPolygon(alongT, P), ...clipToPolygon(alongS, P));
  }
  return lines.map((run) => run.map(([x, y]) => [y, x / k]));
}
