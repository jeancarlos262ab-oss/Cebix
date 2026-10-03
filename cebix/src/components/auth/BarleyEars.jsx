import { memo } from "react";

/**
 * Espigas de cebada dibujadas en línea. La cebada se reconoce por sus aristas
 * (las barbas largas que salen de cada grano), así que son lo protagonista:
 * cada grano lanza una arista hacia arriba y el conjunto forma ese rayado
 * característico de la espiga.
 *
 * Usa `currentColor`, por lo que toma el color del panel de marca. Las aristas
 * se trazan una sola vez al cargar (ver `.ear-awn` en auth.css) y respetan
 * `prefers-reduced-motion`.
 */

const NODES = 9; // pares de granos por espiga
const STEP = 27; // separación vertical entre pares
const KX = 12; // semiancho del grano
const KY = 25; // semialto del grano (antes 6 x 12: ahora ~2x más grandes)
const KOFF = 12; // separación lateral del grano respecto al eje
const BASE_Y = -340; // dónde empieza la espiga sobre el tallo

// Grano picudo: base redondeada y punta afilada hacia arriba (-y), centrado en (0, 0).
const KERNEL = [
  `M0 ${KY}`,
  `C${KX * 0.7} ${KY} ${KX} ${KY * 0.5} ${KX} 0`,
  `C${KX} ${-KY * 0.45} ${KX * 0.45} ${-KY * 0.8} 0 ${-KY}`,
  `C${-KX * 0.45} ${-KY * 0.8} ${-KX} ${-KY * 0.45} ${-KX} 0`,
  `C${-KX} ${KY * 0.5} ${-KX * 0.7} ${KY} 0 ${KY} Z`,
].join(" ");

// Geometría local de una espiga: base del tallo en (0, 0), crece hacia -y.
function buildEar() {
  const kernels = [];
  const awns = [];

  // Se recorre de la punta hacia la base: los pisos de abajo se dibujan al
  // final, así quedan al frente y tapan a los de arriba (como tejas).
  for (let i = NODES - 1; i >= 0; i -= 1) {
    const t = i / (NODES - 1);
    const y = BASE_Y - i * STEP;

    [-1, 1].forEach((side) => {
      kernels.push({ cx: side * KOFF, cy: y, rotate: side * 16, i });

      // Las aristas casi paralelas, abriéndose apenas hacia la punta.
      const angle = (side * (1.5 + t * 4.5) * Math.PI) / 180;
      const length = 270 - t * 30;
      const x0 = side * KOFF;
      const y0 = y - KY + 2;
      const x1 = x0 + Math.sin(angle) * length;
      const y1 = y0 - Math.cos(angle) * length;
      const qx = x0 + Math.sin(angle) * length * 0.5 + side * 3;
      const qy = y0 - Math.cos(angle) * length * 0.5;

      awns.push({
        d: `M${x0} ${y0} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`,
        order: i * 2 + (side > 0 ? 1 : 0),
      });
    });
  }

  // Arista terminal, al centro de la punta.
  const topY = BASE_Y - (NODES - 1) * STEP - KY;
  awns.push({ d: `M0 ${topY} Q-2 ${topY - 130} 0 ${topY - 262}`, order: NODES * 2 });

  return { kernels, awns };
}

const EAR = buildEar();
const STALK = "M0 0 C 6 -170 -4 -290 0 -336";
const LEAF = "M0 -110 C 50 -190 110 -280 140 -420 C 90 -330 40 -250 0 -110 Z";

function Ear({ x, y, rotate, scale, delay }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <g className="ear-line">
        {/* 1) Aristas al fondo: los granos las tapan donde se cruzan */}
        {EAR.awns.map((a, index) => (
          <path
            key={index}
            className="ear-awn"
            pathLength="1"
            d={a.d}
            style={{ animationDelay: `${delay + 0.35 + a.order * 0.035}s` }}
          />
        ))}
        {/* 2) Tallo y hoja, con relleno opaco */}
        <path className="ear-body ear-solid" d={LEAF} style={{ animationDelay: `${delay + 0.1}s` }} />
        <path className="ear-body" d={STALK} style={{ strokeWidth: 2, animationDelay: `${delay}s` }} />
        {/* 3) Granos con relleno opaco, de la punta a la base */}
        {EAR.kernels.map((k, index) => (
          <path
            key={index}
            className="ear-body ear-solid"
            d={KERNEL}
            transform={`translate(${k.cx} ${k.cy}) rotate(${k.rotate})`}
            style={{ animationDelay: `${delay + 0.15 + index * 0.03}s` }}
          />
        ))}
      </g>
    </g>
  );
}

function BarleyEars({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 640 900"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <Ear x={250} y={960} rotate={-9} scale={0.78} delay={0} />
      <Ear x={545} y={960} rotate={16} scale={0.62} delay={0.25} />
      <Ear x={420} y={940} rotate={6} scale={1} delay={0.5} />
    </svg>
  );
}

export default memo(BarleyEars);