import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BigNumber from "./BigNumber";
import { riskColorOf } from "./tokens";

/** Tira horizontal de parcelas (de mayor a menor rendimiento). Tocar una la selecciona y centra el mapa en ella. */
export default function ParcelStrip({ parcels, selectedId, onSelect, className = "" }) {
  const scroller = useRef(null);
  const cards = useRef(new Map());
  const [edges, setEdges] = useState({ start: false, end: true });

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateEdges, parcels]);

  // Si la selección viene del mapa, trae su tarjeta a la vista.
  useEffect(() => {
    const el = cards.current.get(selectedId);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  function scrollBy(dir) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section aria-label="Parcelas" className={className}>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-white/60 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
          <span className="font-medium text-white">{parcels.length}</span> parcelas · de mayor a menor rendimiento
        </p>
        <div className="hidden gap-1 lg:flex">
          {[-1, 1].map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => scrollBy(dir)}
              aria-label={dir < 0 ? "Parcelas anteriores" : "Parcelas siguientes"}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              {dir < 0 ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>
          ))}
        </div>
      </div>

      <ul
        ref={scroller}
        onScroll={updateEdges}
        // Desvanecido solo del lado donde aún hay parcelas por ver (inicio / final).
        style={{ "--fade-start": edges.start ? "40px" : "0px", "--fade-end": edges.end ? "40px" : "0px" }}
        className="strip-fade flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        {parcels.map((p) => {
          const active = p.id === selectedId;
          const color = riskColorOf(p);
          return (
            <li key={p.id} ref={(el) => (el ? cards.current.set(p.id, el) : cards.current.delete(p.id))} className="snap-start">
              <button
                type="button"
                onClick={() => onSelect(p)}
                aria-pressed={active}
                className={[
                  "flex h-[112px] w-[176px] shrink-0 flex-col justify-between rounded-lg p-3 text-left transition-colors",
                  active
                    ? "bg-accent-500/25"
                    : "bg-black/65 hover:bg-black/80",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-white">{p.polygonId ?? p.name}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-label={p.risk} />
                </span>
                <span className="truncate text-[11px] text-white/45">
                  {p.municipio && p.municipio !== "—" ? p.municipio : p.region}
                </span>
                <span className="flex items-end justify-between gap-2">
                  <BigNumber value={p.yieldEstimate} unit="t/ha" className="text-[26px]" unitClassName="text-[10px]" />
                  <span className="mb-0.5 text-[10px] tabular-nums text-white/40">{p.score}/100</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
