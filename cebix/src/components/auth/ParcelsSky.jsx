import { memo } from "react";
import { CLOUDS, MOUNTAINS, PARCELS, VIEW_H, VIEW_W } from "./parcelsGeometry";

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
        {}
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

        {}
        <path className="parcel-cloud" d={CLOUDS} />

        {}
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