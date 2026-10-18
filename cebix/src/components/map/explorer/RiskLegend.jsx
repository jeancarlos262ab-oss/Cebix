import { GLASS, RISK_META } from "./tokens";

const ORDER = ["green", "yellow", "red"];
const LABELS = { green: "Rendimiento alto", yellow: "Rendimiento medio", red: "Rendimiento bajo" };

export default function RiskLegend({ className = "" }) {
  return (
    <section aria-label="Leyenda de rendimiento" className={`rounded-lg px-4 py-3 ${GLASS} ${className}`}>
      <ul className="flex items-center justify-between gap-3">
        {ORDER.map((key) => (
          <li key={key} className="flex items-center gap-2 text-xs text-white/80">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RISK_META[key].color }} aria-hidden="true" />
            {LABELS[key]}
          </li>
        ))}
      </ul>
    </section>
  );
}