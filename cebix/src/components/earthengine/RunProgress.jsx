import { Check, Loader2 } from "lucide-react";
import { GEE_FEATURES, WINDOWS } from "../../data/earthEngine";
import { SourceChip } from "./SourceChip";

/**
 * Panel de avance mientras se calculan las 10 variables: encabezado con el estado general,
 * barra de avance fina y una tabla de variables con su estado.
 * `current` es el índice de la variable en curso (>= total = prediciendo con el modelo).
 */
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

export default function RunProgress({ current, elapsedSec, year }) {
  const total = GEE_FEATURES.length;
  const predicting = current >= total;
  const pct = Math.min(100, Math.round((Math.min(current, total) / total) * 100));
  const stateOf = (i) => (i < current ? "done" : i === current ? "running" : "pending");

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800" aria-live="polite">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Cálculo de índices satelitales</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Ciclo {year} ·{" "}
            {predicting ? "Ejecutando el modelo" : `Variable ${Math.min(current + 1, total)} de ${total}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold leading-none tabular-nums text-gray-900 dark:text-gray-100">{pct}%</p>
          <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{elapsedSec} s transcurridos</p>
        </div>
      </header>

      <div
        className="h-0.5 w-full bg-gray-100 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-accent-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className={`${ROW} hidden border-b border-gray-100 py-2 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800/70 dark:text-gray-500 sm:grid`}>
        <span>N.º</span>
        <span>Variable</span>
        <span>Fuente</span>
        <span className="hidden md:block">Ventana</span>
        <span className="text-right">Estado</span>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800/70">
        {GEE_FEATURES.map((f, i) => {
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
        Se leen imágenes de Sentinel-2, Landsat y lluvia de CHIRPS (fuentes abiertas). Una parcela tarda entre 30 y 90 s; no cierres la pantalla. El avance por variable es una estimación de tiempo.
      </footer>
    </section>
  );
}
