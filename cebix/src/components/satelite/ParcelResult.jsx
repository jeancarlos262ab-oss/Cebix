import { Download, RotateCcw } from "lucide-react";
import FeaturesTable from "./FeaturesTable";
import Semaphore from "../ui/Semaphore";
import { Contributions, Label, SummaryPanel } from "../results/ReportParts";
import { formatHa } from "../../utils/polygon";

/**
 * Resultado de una parcela calculada en vivo. Es un informe de una sola columna, sin tarjetas
 * ni iconos decorativos: resumen numérico → contribución de cada variable → tabla de variables.
 * Comparte piezas con Predicciones (components/results/ReportParts.jsx).
 */

const BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

export default function ParcelResult({ result, view, ran, stale, onDownload, onReset }) {
  return (
    <div className={`space-y-10 transition-opacity ${stale ? "opacity-60" : ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-gray-200 pb-4 dark:border-gray-800">
        <div className="min-w-0">
          <Label>Resultado</Label>
          <h2 className="mt-1 truncate font-display text-lg font-semibold text-gray-900 dark:text-gray-100">{ran.name}</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {ran.estado} · Ciclo {ran.anio} · {formatHa(ran.ha)} ha
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDownload} className={BTN}>
            <Download size={13} strokeWidth={1.75} /> Descargar variables (JSON)
          </button>
          <button type="button" onClick={onReset} className={BTN}>
            <RotateCcw size={13} strokeWidth={1.75} /> Nueva parcela
          </button>
        </div>
      </header>

      <SummaryPanel
        yieldEstimate={result.yieldEstimate}
        half={view.half}
        low={result.ic90_inferior}
        high={result.ic90_superior}
        score={view.score}
        rows={[{ label: "Superficie", value: `${formatHa(ran.ha)} ha` }]}
      />

      {/* Semáforo a todo el ancho (la imagen sobresale hacia arriba: el relleno superior le da su aire) */}
      <div className="pt-6">
        <Semaphore score={view.score} sober horizontal />
      </div>

      {/* Contribución de cada variable */}
      <section>
        <Label>Contribución de las variables</Label>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Valores SHAP de esta parcela, ordenados por magnitud: cuánto suma o resta cada variable a la estimación.
        </p>
        <Contributions data={result.shap} />
      </section>

      {/* Variables calculadas */}
      <section>
        <Label>Variables calculadas desde satélite</Label>
        <p className="mb-3 mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Para cada escena se promedia el índice dentro del polígono y, entre las escenas de la ventana, se toma la mediana.
        </p>
        <FeaturesTable features={view.features} />
      </section>
    </div>
  );
}
