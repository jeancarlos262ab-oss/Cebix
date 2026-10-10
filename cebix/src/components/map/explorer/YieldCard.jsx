import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import BigNumber from "./BigNumber";
import { GLASS } from "./tokens";

const BINS = 14;

/** Rendimiento promedio de las parcelas a la vista + histograma de cómo se reparten. */
export default function YieldCard({ parcels, selected }) {
  const stats = useMemo(() => {
    const values = parcels.map((p) => p.yieldEstimate).filter(Number.isFinite);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const counts = Array(BINS).fill(0);
    for (const v of values) counts[Math.min(BINS - 1, Math.floor(((v - min) / range) * BINS))] += 1;
    return { min, max, range, mean, counts, peak: Math.max(...counts) };
  }, [parcels]);

  if (!stats) return null;

  const binOf = (v) => Math.min(BINS - 1, Math.max(0, Math.floor(((v - stats.min) / stats.range) * BINS)));
  const selectedBin = selected && Number.isFinite(selected.yieldEstimate) ? binOf(selected.yieldEstimate) : -1;
  const meanPct = ((stats.mean - stats.min) / stats.range) * 100;

  return (
    <div className={`rounded-lg p-4 ${GLASS}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-white/55">Rendimiento estimado</p>
        <Link
          to="/predicciones"
          aria-label="Ver todas las predicciones"
          className="-m-1 rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="mt-2.5">
        <BigNumber value={stats.mean} unit="t/ha promedio" className="text-[44px]" />
      </div>

      <div className="relative mt-5 h-[68px]">
        <div className="flex h-full items-end gap-[3px]" aria-hidden="true">
          {stats.counts.map((count, i) => (
            <div
              key={i}
              title={`${count} parcela${count === 1 ? "" : "s"}`}
              className={`flex-1 rounded-t-[5px] transition-colors ${i === selectedBin ? "bg-accent-400" : "bg-white/20 hover:bg-white/35"}`}
              style={{ height: `${Math.max(count ? 8 : 3, (count / stats.peak) * 100)}%` }}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/50"
          style={{ left: `${meanPct}%` }}
        >
          <span className="absolute -top-4 left-1 text-[10px] font-medium text-white/60">Media</span>
        </div>
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-white/35">
        <span>{stats.min.toFixed(1)}</span>
        <span>{stats.max.toFixed(1)} t/ha</span>
      </div>
    </div>
  );
}
