import { Check, Loader2 } from "lucide-react";
import LiquidOrbLoader from "../model/LiquidOrbLoader";
import { GEE_FEATURES, WINDOWS } from "../../data/earthEngine";
import { SourceChip } from "./SourceChip";

/**
 * Pantalla de espera mientras se calculan las 10 variables: orbe + lista de avance.
 * `current` es el índice de la variable en curso (>= total = prediciendo con el modelo).
 */
export default function RunProgress({ current, elapsedSec, year }) {
  const total = GEE_FEATURES.length;
  const predicting = current >= total;
  const pct = Math.min(100, Math.round((Math.min(current, total) / total) * 100));

  return (
    <div className="grid items-center gap-8 rounded-2xl border border-gray-200 p-6 dark:border-gray-800 lg:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center text-center">
        <LiquidOrbLoader size={190} running />
        <p className="mt-4 font-display text-base font-semibold text-gray-900 dark:text-gray-100">
          Calculando índices satelitales…
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {predicting ? "Ejecutando el modelo" : `Variable ${Math.min(current + 1, total)} de ${total}`} · {elapsedSec} s
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Imágenes satelitales · ciclo {year}</p>
          <p className="font-display text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct}%</p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <ul className="mt-5 space-y-1">
          {GEE_FEATURES.map((f, i) => {
            const done = i < current;
            const running = i === current;
            return (
              <li
                key={f.key}
                className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-opacity ${
                  done || running ? "opacity-100" : "opacity-40"
                } ${running ? "bg-gray-50 dark:bg-gray-900" : ""}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-ndvi-500 text-white" : "border border-gray-300 dark:border-gray-700"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : running ? <Loader2 size={12} className="animate-spin text-accent-600 dark:text-accent-400" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200">{f.label}</span>
                <span className="hidden shrink-0 sm:block">
                  <SourceChip source={f.source} />
                </span>
                <span className="hidden w-28 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500 md:block">
                  {WINDOWS[f.window].range}
                </span>
              </li>
            );
          })}
          <li
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-opacity ${predicting ? "bg-gray-50 opacity-100 dark:bg-gray-900" : "opacity-40"}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700">
              {predicting && <Loader2 size={12} className="animate-spin text-accent-600 dark:text-accent-400" />}
            </span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Predicción del modelo (Random Forest + SHAP)</span>
          </li>
        </ul>

        <p className="mt-5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Se leen imágenes reales de Sentinel-2, Landsat y lluvia de CHIRPS (fuentes abiertas, sin cuenta). Una parcela tarda entre 30 y 90 s; no cierres la pantalla. El avance por variable es una estimación de tiempo.
        </p>
      </div>
    </div>
  );
}
