import { GLASS } from "./tokens";

/** Reparto de parcelas por región; cada fila también filtra el mapa. */
export default function RegionBars({ regions, total, value, onChange }) {
  if (regions.length === 0) return null;
  return (
    <div className={`rounded-lg p-4 ${GLASS}`}>
      <p className="text-xs text-white/55">Regiones cubiertas</p>
      <ul className="mt-3 space-y-1">
        {regions.map((r) => {
          const share = total ? (r.count / total) * 100 : 0;
          const active = value === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onChange(active ? "all" : r.key)}
                aria-pressed={active}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span className="flex items-baseline justify-between gap-3 text-xs">
                  <span className={active ? "font-medium text-white" : "text-white/80"}>{r.label}</span>
                  <span className="tabular-nums text-white/55">
                    <span className="font-medium text-white">{r.count}</span> · {share.toFixed(0)}%
                  </span>
                </span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${active ? "bg-accent-400" : "bg-white/65"}`}
                    style={{ width: `${share}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
