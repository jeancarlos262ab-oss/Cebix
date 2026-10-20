import { useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { formatFixed } from "../../utils/intl";
import { APPROX_SHAP_TEXT } from "../../utils/shapSource";
import { useParcels } from "../../context/ParcelsContext";
import { explainParcel, friendlyError } from "../../services/modelApi";
import { toast } from "../../services/toast";
import SlowHint from "../ui/SlowHint";
const MAX_YIELD = 6; 
const DIRECTION_COLOR = { positivo: "var(--chart-positive)", negativo: "var(--chart-negative)", mixto: "var(--chart-mixed)" };
const SIGN = { positivo: "+", negativo: "−", mixto: "±" };

export function Label({ children }) {
  return <h3 className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{children}</h3>;
}

export function RangeBar({ estimate, half }) {
  const low = Math.max(0, estimate - half);
  const high = Math.min(MAX_YIELD, estimate + half);
  const pct = (v) => (Math.min(MAX_YIELD, Math.max(0, v)) / MAX_YIELD) * 100;
  const ticks = Array.from({ length: MAX_YIELD + 1 }, (_, i) => i);
  const shift = (t) => (t === 0 ? "0" : t === MAX_YIELD ? "-100%" : "-50%");

  return (
    <div
      className="mt-7"
      role="img"
      aria-label={`Estimación ${formatFixed(estimate, 1)} ton/ha, intervalo al 90 % de ${formatFixed(low, 1)} a ${formatFixed(high, 1)} ton/ha`}
    >
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300 dark:bg-gray-700" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-accent-500/35" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-accent-600 dark:bg-accent-400" style={{ left: `calc(${pct(estimate)}% - 1px)` }} />
      </div>
      <div className="relative mt-1 h-4 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
        {ticks.map((t) => (
          <span key={t} className="absolute" style={{ left: `${pct(t)}%`, transform: `translateX(${shift(t)})` }}>
            {t}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">ton/ha · el sombreado es el intervalo al 90 %</p>
    </div>
  );
}

export function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-6 py-3.5 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

// Pide al modelo el SHAP real de una o varias parcelas y lo guarda. Se puede cancelar.
export function useExplainShap() {
  const { setParcelShap } = useParcels();
  const [running, setRunning] = useState(false);
  const ctlRef = useRef(null);

  const cancel = () => ctlRef.current?.abort();

  async function run(list) {
    if (running || !list.length) return;
    const controller = new AbortController();
    ctlRef.current = controller;
    setRunning(true);
    let ok = 0;
    let failed = 0;
    let cancelled = false;
    const notes = [];
    try {
      for (const parcel of list) {
        try {
          const r = await explainParcel(parcel, controller.signal);
          const res = await setParcelShap(parcel.id, r.shap);
          if (res?.error) throw res.error;
          ok += 1;
          // Parcela capturada a mano: su rendimiento no sale del modelo.
          if (!parcel.satelite?.features && Math.abs(Number(parcel.yieldEstimate) - r.yieldEstimate) > 0.05)
            notes.push(`${parcel.name}: el modelo estima ${r.yieldEstimate} t/ha y la parcela tiene ${parcel.yieldEstimate} t/ha capturados.`);
        } catch (err) {
          if (controller.signal.aborted || err?.name === "AbortError") {
            cancelled = true;
            break;
          }
          failed += 1;
          console.error("[shap]", parcel.name, err);
          if (list.length === 1) toast.error(friendlyError(err));
        }
      }
      if (cancelled) toast(`Cálculo cancelado.${ok ? ` Se actualizaron ${ok}.` : ""} Puedes volver a intentarlo.`);
      else if (ok) toast.success(`SHAP calculado por el modelo en ${ok} parcela${ok === 1 ? "" : "s"}.${failed ? ` ${failed} fallaron.` : ""}${notes.length ? " " + notes.slice(0, 2).join(" ") : ""}`, { duration: notes.length ? 12000 : 5000 });
      else if (failed && list.length > 1) toast.error("No se pudo calcular el SHAP. Inténtalo de nuevo.");
    } finally {
      ctlRef.current = null;
      setRunning(false);
    }
  }
  return { run, running, cancel };
}

// Etiqueta chica «SHAP aproximado» + botón para pedirle el real al modelo. El detalle va en el tooltip.
export function ApproxShapNote({ parcels, className = "" }) {
  const { run, running, cancel } = useExplainShap();
  const list = Array.isArray(parcels) ? parcels : parcels ? [parcels] : [];
  const many = list.length > 1;
  const BTN = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60";
  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          title={APPROX_SHAP_TEXT}
          className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {many ? `${list.length} con SHAP aproximado` : "SHAP aproximado"}
        </span>
        {list.length > 0 && !running && (
          <button type="button" onClick={() => run(list)} className={`${BTN} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`}>
            <Sparkles size={12} strokeWidth={1.75} /> {many ? "Calcular todas con el modelo" : "Calcular con el modelo"}
          </button>
        )}
        {running && (
          <>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Calculando…
            </span>
            <button type="button" onClick={cancel} className={`${BTN} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`}>
              <X size={12} strokeWidth={1.75} /> Cancelar
            </button>
          </>
        )}
      </div>
      {running && <SlowHint className="max-w-md text-[11px]" />}
    </div>
  );
}

export function Contributions({ data }) {
  const rows = (data ?? [])
    .map((d) => ({ ...d, magnitude: Math.abs(d.value ?? d.impact ?? 0) }))
    .sort((a, b) => b.magnitude - a.magnitude);
  const max = Math.max(...rows.map((r) => r.magnitude), 0.0001);
  if (!rows.length) return <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No hay contribuciones por variable disponibles.</p>;

  const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(7rem,38%)_3.5rem] items-center gap-x-4";
  return (
    <div className="mt-3">
      <div className={`${COLS} pb-2 text-[11px] text-gray-400 dark:text-gray-500`}>
        <span />
        <span className="flex justify-between">
          <span>← Resta</span>
          <span>Suma →</span>
        </span>
        <span />
      </div>
      <ul className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70">
        {rows.map((r) => {
          const half = Math.max(1, (r.magnitude / max) * 50);
          const negative = r.direction === "negativo";
          return (
            <li key={r.feature} className={`${COLS} py-2.5 text-sm`}>
              <span className="min-w-0 leading-snug text-gray-800 dark:text-gray-200">{r.feature}</span>
              <span
                className="relative h-4"
                role="img"
                aria-label={`${r.feature}: ${r.direction ?? "efecto"} de ${formatFixed(r.magnitude, 2)}`}
              >
                <span className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-700" />
                <span
                  className="absolute top-1/2 h-1.5 -translate-y-1/2"
                  style={{
                    backgroundColor: DIRECTION_COLOR[r.direction] ?? "var(--chart-neutral)",
                    width: `${half}%`,
                    ...(negative ? { right: "50%" } : { left: "50%" }),
                  }}
                />
              </span>
              <span className="text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                {SIGN[r.direction] ?? ""}
                {formatFixed(r.magnitude, 2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SummaryPanel({ yieldEstimate, half, low, high, score, rows = [] }) {
  return (
    <section className="grid overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="p-6">
        <Label>Rendimiento esperado</Label>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-4xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatFixed(yieldEstimate, 1)}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">ton/ha</span>
          <span className="ml-1 text-sm tabular-nums text-gray-500 dark:text-gray-400">± {formatFixed(half, 1)}</span>
        </p>
        <RangeBar estimate={yieldEstimate} half={half} />
      </div>

      <dl className="divide-y divide-gray-100 border-t border-gray-200 dark:divide-gray-800/70 dark:border-gray-800 lg:border-l lg:border-t-0">
        <Row label="Intervalo al 90 %">
          {formatFixed(low, 1)} – {formatFixed(high, 1)} ton/ha
        </Row>
        <Row label="Índice de rendimiento">{score} / 100</Row>
        {rows.map((r) => (
          <Row key={r.label} label={r.label}>
            {r.value}
          </Row>
        ))}
      </dl>
    </section>
  );
}