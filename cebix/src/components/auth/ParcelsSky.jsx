import { memo } from "react";
import { CLOUDS, MOUNTAINS, PARCELS, VIEW_H, VIEW_W } from "./parcelsGeometry";

/**
 * Parcelas vistas desde el cielo, en perspectiva oblicua, con una sierra de
 * minimontañas a lo lejos y nubes de línea fina. Solo siluetas: contornos
 * finos, algunas parcelas con surcos o puntos de cultivo.
 *
 * Es deliberadamente ligera: el terreno son 4 <path> (contornos, surcos,
 * puntos y tinte), más 1 de nubes y 1 de sierra, sin máscaras, mezclas de
 * color ni animaciones por elemento. La única animación es un fundido de
 * entrada de todo el conjunto (ver `.parcels-fade` en auth.css).
 */
function ParcelsSky({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Bruma: el terreno se pierde en el horizonte (arriba) y en el borde izquierdo */}
        <linearGradient id="parcels-haze-y" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.25" style={{ stopColor: "var(--paper)" }} stopOpacity="1" />
          <stop offset="0.36" style={{ stopColor: "var(--paper)" }} stopOpacity="0.65" />
          <stop offset="0.56" style={{ stopColor: "var(--paper)" }} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="parcels-haze-x" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--paper)" }} stopOpacity="0.45" />
          <stop offset="0.12" style={{ stopColor: "var(--paper)" }} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g className="parcels-fade">
        <path className="parcel-tint" d={PARCELS.tint} />
        <path className="parcel-outline" d={PARCELS.outline} />
        <path className="parcel-rows" d={PARCELS.rows} />
        <path className="parcel-dots" d={PARCELS.dots} />

        <rect width={VIEW_W} height={VIEW_H} fill="url(#parcels-haze-y)" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#parcels-haze-x)" />

        {/* Nubes: un solo path, por encima de la bruma */}
        <path className="parcel-cloud" d={CLOUDS} />

        {/* Sierra lejana: una sola línea de minimontañas */}
        {MOUNTAINS.map((m, i) => (
          <g key={i}>
            <path className="mountain-fill" d={m.fill} />
            <path className="mountain-ridge" d={m.ridge} style={{ strokeOpacity: m.opacity }} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export default memo(ParcelsSky);
