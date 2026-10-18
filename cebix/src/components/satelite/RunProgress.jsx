import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { SAT_FEATURES, WINDOWS } from "../../data/satelite";
import { STEP_MS } from "../../services/sateliteApi";
import { getPredictionMode } from "../../services/predictionMode";
import { SourceChip } from "./SourceChip";
import ExtractionPreview from "./ExtractionPreview";

function formatRemaining(sec) {
  if (sec < 60) return `${Math.max(1, Math.ceil(sec))} s`;
  const m = Math.floor(sec / 60);
  const r = Math.ceil(sec % 60);
  return r === 60 ? `${m + 1} min` : r ? `${m} min ${r} s` : `${m} min`;
}

const ROW = "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2.5 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto_5.5rem] md:grid-cols-[1.75rem_minmax(0,1fr)_auto_7rem_5.5rem]";

function Status({ state }) {
  if (state === "done")
    return (
      <span className="inline-flex items-center justify-end gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Check size={13} strokeWidth={2.25} /> Listo
      </span>
    );
  if (state === "running")
    return (
      <span className="inline-flex items-center justify-end gap-1.5 text-xs font-medium text-accent-600 dark:text-accent-400">
        <Loader2 size={13} className="animate-spin" /> En curso
      </span>
    );
  return <span className="text-right text-xs text-gray-400 dark:text-gray-600">Pendiente</span>;
}

export default function RunProgress({ predicting: responded = false, year, points = [] }) {
  
  const [mode] = useState(() => getPredictionMode());
  const onlyRain = mode === "lluvia" || mode === "ciclo";
  const features = SAT_FEATURES.filter((f) => (!f.modeOnly || f.modeOnly === mode) && (!onlyRain || f.source === "chirps"));
  const total = features.length;
  
  const [frozenPoints] = useState(points);
  
  const [step, setStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 500);
    const steps = setInterval(() => setStep((i) => Math.min(i + 1, total - 1)), STEP_MS);
    return () => {
      clearInterval(tick);
      clearInterval(steps);
    };
  }, [total]);
  const current = responded ? total : step; 
  const predicting = current >= total;
  const pct = Math.min(100, Math.round((Math.min(current, total) / total) * 100));
  
  const estimatedTotalSec = (total * STEP_MS) / 1000;
  const remainingSec = Math.max(0, estimatedTotalSec - elapsedSec);
  const etaLabel = responded
    ? "Cálculo completado"
    : predicting || remainingSec <= 0
      ? "Finalizando el cálculo…"
      : `≈ ${formatRemaining(remainingSec)} restantes`;
  const stateOf = (i) => (i < current ? "done" : i === current ? "running" : "pending");

  return (
    <section className="grid overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 lg:min-h-[380px] lg:grid-cols-2">
    <div className="min-w-0" aria-live="polite">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{onlyRain ? "Cálculo de la lluvia (CHIRPS)" : "Cálculo de índices satelitales"}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Ciclo {year} ·{" "}
            {predicting ? "Ejecutando el modelo" : `Variable ${Math.min(current + 1, total)} de ${total}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold leading-none tabular-nums text-gray-900 dark:text-gray-100">{pct}%</p>
          <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{elapsedSec} s transcurridos</p>
          <p
            className="mt-0.5 text-xs font-medium tabular-nums text-accent-600 dark:text-accent-400"
            title={`Tiempo total estimado: ≈ ${formatRemaining(estimatedTotalSec)}`}
          >
            {etaLabel}
          </p>
        </div>
      </header>

      <div
        className="h-0.5 w-full bg-gray-100 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-accent-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className={`${ROW} hidden border-b border-gray-100 py-2 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800/70 dark:text-gray-500 sm:grid`}>
        <span>N.º</span>
        <span>Variable</span>
        <span>Fuente</span>
        <span className="hidden md:block">Ventana</span>
        <span className="text-right">Estado</span>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800/70">
        {features.map((f, i) => {
          const st = stateOf(i);
          return (
            <li
              key={f.key}
              className={`${ROW} transition-colors ${st === "running" ? "bg-gray-50 dark:bg-gray-900/60" : ""} ${st === "pending" ? "opacity-60" : ""}`}
            >
              <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">{f.label}</span>
              <span className="hidden shrink-0 sm:block">
                <SourceChip source={f.source} />
              </span>
              <span className="hidden text-xs text-gray-500 dark:text-gray-400 md:block">{WINDOWS[f.window].range}</span>
              <Status state={st} />
            </li>
          );
        })}
        <li className={`${ROW} transition-colors ${predicting ? "bg-gray-50 dark:bg-gray-900/60" : "opacity-60"}`}>
          <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">{String(total + 1).padStart(2, "0")}</span>
          <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200 sm:col-span-2 md:col-span-3">
            Predicción del modelo (Random Forest + SHAP)
          </span>
          <Status state={predicting ? "running" : "pending"} />
        </li>
      </ul>

      <footer className="border-t border-gray-100 px-5 py-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800/70 dark:text-gray-400">
        {onlyRain
          ? "Solo se lee la lluvia de CHIRPS (fuente abierta) dentro del polígono. No cierres la pantalla. El avance es una estimación de tiempo."
          : "Se leen imágenes de Sentinel-2, Landsat y lluvia de CHIRPS (fuentes abiertas). Una parcela tarda entre 30 y 90 s; no cierres la pantalla. El avance por variable es una estimación de tiempo."}
      </footer>
    </div>
    <ExtractionPreview
      points={frozenPoints}
      feature={predicting ? null : features[Math.min(current, total - 1)]}
      index={Math.min(current, total - 1)}
      total={total}
      predicting={predicting}
      year={year}
      features={features}
      onlyRain={onlyRain}
    />
    </section>
  );
}