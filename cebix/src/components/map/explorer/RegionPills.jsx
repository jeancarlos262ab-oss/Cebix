import { GLASS } from "./tokens";

/** Filtro por región en píldoras. `options`: [{ key, label, count }]. */
export default function RegionPills({ options, value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Filtrar por región"
      className={`flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 scrollbar-none ${GLASS}`}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={[
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {o.label}
            <span className={`tabular-nums ${active ? "text-black/50" : "text-white/40"}`}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
