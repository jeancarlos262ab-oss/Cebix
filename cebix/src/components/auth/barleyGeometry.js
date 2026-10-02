/**
 * Geometría de una espiga de cebada (cebada de seis hileras), en coordenadas
 * locales: la base del tallo está en (0, 0) y la planta crece hacia -y.
 *
 * Qué la distingue de otros cereales y por eso se dibuja así:
 *  - Granos (lemas) apuntados que se montan unos sobre otros como tejas,
 *    formando un patrón de espiga de pez en la cara de la espiga.
 *  - Aristas muy largas, casi paralelas, que rematan cada grano y forman un
 *    "pincel" en la punta.
 *  - Espiga algo arqueada por el peso (cebada madura).
 *  - Tallo con nudos, vainas y hojas largas con nervio central.
 */

const NODES = 17; // pisos de granos por espiga
const EAR_LENGTH = 300;
const EAR_BASE_Y = -330; // donde termina el pedúnculo y empieza la espiga
const BEND = 34; // cuánto se arquea la espiga hacia la derecha
const KERNEL_TIP = 13; // distancia del centro del grano a su punta

// Aleatoriedad determinista: la ilustración es idéntica en cada carga.
const rnd = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const f = (n) => Number(n.toFixed(1));

// Punto del eje de la espiga en s ∈ [0, 1] y su inclinación (rad).
function axis(s) {
  return {
    x: BEND * s * s,
    y: EAR_BASE_Y - s * EAR_LENGTH,
    tilt: Math.atan2(2 * BEND * s, EAR_LENGTH),
  };
}

function build() {
  const top = axis(1);
  const rows = { center: [], inner: [], outer: [] };
  const awns = [];
  let order = 0;

  for (let i = NODES - 1; i >= 0; i -= 1) {
    const s = i / (NODES - 1);

    const place = (row, side, lateral, sOffset, splay, withAwn) => {
      const a = axis(Math.min(1, s + sOffset / (NODES - 1)));
      const px = a.x + lateral * Math.cos(a.tilt);
      const py = a.y + lateral * Math.sin(a.tilt);
      const rot = (a.tilt * 180) / Math.PI + splay;
      const rad = (rot * Math.PI) / 180;
      rows[row].push({ x: f(px), y: f(py), rot: f(rot) });

      if (!withAwn) return;

      // La arista nace en la punta del grano y termina en un pincel común.
      const x0 = px + KERNEL_TIP * Math.sin(rad);
      const y0 = py - KERNEL_TIP * Math.cos(rad);
      const seed = i * 7 + (side + 2) * 3 + (row === "center" ? 1 : 0);
      const spread = side === 0 ? (rnd(seed) - 0.5) * 30 : side * (8 + rnd(seed) * 30);
      const x1 = top.x + BEND * 0.5 + spread;
      const y1 = top.y - 55 - rnd(seed + 1) * 70;
      const qx = (x0 + x1) / 2 + side * 4 + (1 - s) * side * 6;
      const qy = (y0 + y1) / 2;
      awns.push({ d: `M${f(x0)} ${f(y0)} Q${f(qx)} ${f(qy)} ${f(x1)} ${f(y1)}`, order: order++ });
    };

    place("center", 0, 0, 0.3, 0, i % 2 === 0);
    [-1, 1].forEach((side) => {
      if (i < NODES - 1) place("inner", side, side * 3.6, 0.5, side * 5, false);
      place("outer", side, side * 9.5, 0, side * 13, true);
    });
  }

  // Tres aristas terminales en la punta.
  [-1, 0, 1].forEach((side, k) => {
    const x0 = top.x;
    const y0 = top.y - 6;
    const x1 = top.x + BEND * 0.5 + side * 18;
    const y1 = y0 - 150 - k * 8;
    awns.push({ d: `M${f(x0)} ${f(y0)} Q${f(x0 + side * 4 + 6)} ${f((y0 + y1) / 2)} ${f(x1)} ${f(y1)}`, order: order++ });
  });

  return { rows, awns };
}

export const EAR = build();

// Lema: grano apuntado, con la punta hacia -y; la nervadura va aparte.
export const KERNEL_PATH = "M0 11 C5.5 9 6 -4 0 -13 C-6 -4 -5.5 9 0 11 Z";
export const KERNEL_CREASE = "M0 8 L0 -9";

// Tallo con dos nudos, vainas y dos hojas con nervio central.
export const STALK = `M0 0 C4 -110 -3 -220 ${f(axis(0).x)} ${EAR_BASE_Y}`;
export const NODES_MARKS = [
  "M-3.5 -90 L3.5 -90",
  "M-3.5 -200 L3.5 -200",
];
export const SHEATH = "M-3 -90 C-3 -140 -4 -170 -3 -200 M3.5 -90 C3.5 -140 4 -170 3.5 -200";
export const LEAVES = [
  // Hoja bandera: sube y se arquea hacia la derecha
  {
    blade: "M3 -200 C20 -300 110 -352 204 -312 C120 -322 40 -272 -1 -190 Z",
    rib: "M2 -196 C28 -292 112 -338 200 -310",
  },
  // Hoja inferior: cae hacia la izquierda
  {
    blade: "M-3 -90 C-20 -172 -104 -214 -196 -172 C-112 -192 -40 -150 1 -84 Z",
    rib: "M-2 -87 C-26 -166 -104 -202 -192 -170",
  },
];
