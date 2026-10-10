import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { GLASS, RISK_META } from "./tokens";

const ICONS = { green: CircleCheck, yellow: CircleAlert, red: TriangleAlert };

/** Tres contadores de elegibilidad (verde / amarillo / rojo) de las parcelas a la vista. */
export default function RiskTiles({ counts }) {
  return (
    <div className={`grid grid-cols-3 gap-2 rounded-lg p-4 ${GLASS}`}>
      {["green", "yellow", "red"].map((key) => {
        const meta = RISK_META[key];
        const Icon = ICONS[key];
        return (
          <div key={key}>
            <Icon size={16} strokeWidth={2.25} style={{ color: meta.color }} aria-hidden="true" />
            <p className="mt-3 text-[26px] font-thin leading-none tracking-tight tabular-nums text-white">
              {counts[key] ?? 0}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-white/50">{meta.plural}</p>
          </div>
        );
      })}
    </div>
  );
}
