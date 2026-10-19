import { RangeNotice } from "../ui/RangeBadge";
import { Link } from "react-router-dom";
import { Check, Download, Loader2, RotateCcw, Save } from "lucide-react";
import FeaturesTable from "./FeaturesTable";
import DownloadedPolygon from "./DownloadedPolygon";
import Semaphore from "../ui/Semaphore";
import { Contributions, Label, SummaryPanel } from "../results/ReportParts";
import { formatHa } from "../../utils/polygon";
import { MODE_DESC, MODE_LABEL, MODE_NOTICE } from "../../utils/reportMode";
import { BTN_OUTLINE_SM } from "../ui/buttonStyles";

const BTN = BTN_OUTLINE_SM;

const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black";

export default function ParcelResult({ result, view, ran, stale, save, downloaded, onDownload, onReset }) {
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
          {save?.savedId ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                <Check size={13} strokeWidth={2.25} /> Guardada
              </span>
              <Link to={`/parcelas/${save.savedId}`} className={BTN}>
                Ver parcela
              </Link>
            </>
          ) : (
            <>
              <button type="button" onClick={save?.onSave} disabled={stale || save?.saving} className={BTN_PRIMARY}>
                {save?.saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.75} />}
                {save?.saving ? "Guardando…" : save?.replaces ? "Reemplazar parcela guardada" : "Guardar parcela"}
              </button>
              {save?.replaces && (
                <button type="button" onClick={save?.onSaveNew} disabled={stale || save?.saving} className={BTN}>
                  Guardar como parcela nueva
                </button>
              )}
            </>
          )}
          <button type="button" onClick={() => onDownload(downloaded)} className={BTN}>
            <Download size={13} strokeWidth={1.75} /> Descargar variables
          </button>
          <button type="button" onClick={onReset} className={BTN}>
            <RotateCcw size={13} strokeWidth={1.75} /> Nueva parcela
          </button>
        </div>
      </header>

      <RangeNotice warnings={result.avisos ?? []} />

      <SummaryPanel
        yieldEstimate={result.yieldEstimate}
        half={view.half}
        low={result.ic90_inferior}
        high={result.ic90_superior}
        score={view.score}
        rows={[{ label: "Superficie", value: `${formatHa(ran.ha)} ha` }]}
      />

      {}
      <div className="pt-6">
        <Semaphore score={view.score} sober horizontal />
      </div>

      {}
      <section>
        <Label>Contribución de las variables</Label>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Valores SHAP de esta parcela, ordenados por magnitud: cuánto suma o resta cada variable a la estimación.
        </p>
        <Contributions data={result.shap} />
      </section>

      {}
      <DownloadedPolygon data={downloaded} />

      {}
      <section>
        <Label>{result.modo === "10var" ? "Las 10 variables calculadas desde satélite" : result.modo === "10var_ciclo" ? "Las 10 variables con la lluvia de las 3 etapas, calculadas desde satélite" : "Variables calculadas desde satélite"}</Label>
        <p className="mb-3 mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {result.modo ? `Modo ${MODE_LABEL[result.modo]}: ${MODE_DESC[result.modo]}. ` : ""}
          {MODE_NOTICE[result.modo] ?? ""}{" "}
          {result.modo === "lluvia" || result.modo === "ciclo"
            ? "La lluvia se suma día por día dentro del polígono (CHIRPS); este modo no usa índices de vegetación."
            : "Para cada escena se promedia el índice dentro del polígono y, entre las escenas de la ventana, se toma la mediana."}
        </p>
        <FeaturesTable features={view.features} modo={result.modo ?? null} />
      </section>
    </div>
  );
}