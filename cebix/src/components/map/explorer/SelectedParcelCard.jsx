import { Link } from "react-router-dom";
import { ArrowUpRight, ExternalLink, X } from "lucide-react";
import BigNumber from "./BigNumber";
import { GLASS, RISK_META, riskColorOf } from "./tokens";

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

function Stat({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.06] px-3 py-2">
      <p className="truncate text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-white">{value}</p>
    </div>
  );
}

/** Detalle de la parcela elegida: rendimiento, intervalo de confianza 90 %, factores SHAP y accesos. */
export default function SelectedParcelCard({ parcel, scale, onClose, className = "" }) {
  const [lo, hi] = parcel.ic90 ?? [parcel.yieldEstimate, parcel.yieldEstimate];
  const [min, max] = scale;
  const span = max - min || 1;
  const pct = (v) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

  const factors = (parcel.shap ?? [])
    .map((s) => ({
      name: s.feature ?? s.label ?? s.name ?? "",
      impact: Number(s.impact ?? s.value),
    }))
    .filter((s) => s.name && Number.isFinite(s.impact))
    .slice(0, 3);
  const maxImpact = Math.max(0.0001, ...factors.map((f) => Math.abs(f.impact)));

  const color = riskColorOf(parcel);
  const meta = RISK_META[parcel.riskColor];
  const hasCoords = Number.isFinite(parcel.lat) && Number.isFinite(parcel.lng);

  return (
    <section aria-label={`Detalle de ${parcel.name}`} className={`flex flex-col rounded-lg p-4 ${GLASS} ${className}`}>
      {/* Solo el contenido se desplaza si la pantalla es baja; los botones quedan siempre visibles. */}
      <div className="min-h-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium text-white">{parcel.name}</h2>
            <p className="mt-0.5 truncate text-xs text-white/50">
              {parcel.municipio && parcel.municipio !== "—" ? `${parcel.municipio}, ` : ""}
              {parcel.region}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="-m-1 shrink-0 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <BigNumber value={parcel.yieldEstimate} unit="t/ha" className="text-[46px]" unitClassName="text-sm" />
          <span
            className="mb-1 flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-white"
            title={`Puntaje ${parcel.score} de 100`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {meta?.label ?? parcel.risk}
            <span className="tabular-nums text-white/45">{parcel.score}</span>
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] text-white/45">
            <span>Intervalo de confianza 90%</span>
            <span className="tabular-nums text-white/70">
              {fmt(lo, 1)} – {fmt(hi, 1)}
            </span>
          </div>
          <div className="relative mt-2.5 h-1.5 rounded-full bg-white/10" aria-hidden="true">
            <div
              className="absolute inset-y-0 rounded-full bg-white/35"
              style={{ left: `${pct(lo)}%`, width: `${Math.max(2, pct(hi) - pct(lo))}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black"
              style={{ left: `${pct(parcel.yieldEstimate)}%`, backgroundColor: color }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Margen" value={`±${fmt(parcel.confidence)}`} />
          <Stat label="NDVI" value={fmt(parcel.ndvi)} />
          <Stat label="Área" value={parcel.area ?? "—"} />
        </div>

        {factors.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] text-white/45">Qué más influye</p>
            <ul className="mt-2 space-y-2">
              {factors.map((f) => (
                <li key={f.name} className="text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-white/80">{f.name}</span>
                    <span className={`shrink-0 tabular-nums ${f.impact >= 0 ? "text-white" : "text-white/55"}`}>
                      {f.impact >= 0 ? "+" : "−"}
                      {Math.abs(f.impact).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${f.impact >= 0 ? "bg-accent-400" : "bg-white/40"}`}
                      style={{ width: `${(Math.abs(f.impact) / maxImpact) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex shrink-0 gap-2">
        <Link
          to={`/parcelas/${parcel.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-black transition-colors hover:bg-white/85"
        >
          Ver detalle
          <ArrowUpRight size={14} />
        </Link>
        {hasCoords && (
          <a
            href={`https://www.google.com/maps?q=${parcel.lat},${parcel.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/15"
          >
            Google Maps
            <ExternalLink size={13} className="text-white/55" />
          </a>
        )}
      </div>
    </section>
  );
}
