import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useModelInfo } from "../../context/ModelInfoContext";
import { usePredictionMode } from "../../services/predictionMode";
import { formatNumber } from "../../utils/intl";

const fmt = (v, d = 2) => (typeof v === "number" ? formatNumber(v, { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");

// Textos de respaldo si /model-info aún no carga; las cifras siempre salen del backend.
const BASE = {
  lluvia: {
    title: "Solo lluvia",
    tag: "Recomendado",
    short: "Usa únicamente la lluvia de abril–mayo (CHIRPS). El más preciso y estable en la validación.",
  },
  "10var": {
    title: "10 variables (Plan B)",
    tag: "Plan B",
    short: "Suma 9 índices de Sentinel-2/Landsat (LAI, NDVI, NDTI, STI, NDWI, EVI, nº de imágenes) a la lluvia.",
  },
};

/**
 * Elige cómo se estima el rendimiento: solo lluvia o las 10 variables (Plan B), y explica qué cambia.
 * La elección se guarda en este dispositivo (services/predictionMode) y la usan todas las ejecuciones.
 * `disable10` + `disable10Reason`: para archivos que no traen las 10 variables (p. ej. el CSV PRO de Planet).
 */
export default function ModeSelector({ disable10 = false, disable10Reason = "", stacked = false, className = "" }) {
  const [mode, setMode] = usePredictionMode();
  const { info } = useModelInfo();
  const [open, setOpen] = useState(false);
  const modes = info?.modelModes;
  const active = disable10 && mode === "10var" ? "lluvia" : mode;

  const rows = [
    ["Variables que usa", (m) => (m ? `${m.nFeatures}` : "—")],
    ["Error típico (RMSE)", (m) => (m ? `${fmt(m.rmse)} t/ha` : "—")],
    ["R² (qué parte de la variación explica)", (m) => fmt(m?.r2)],
    ["En un estado sin parcelas de entrenamiento", (m) => (m ? `${fmt(m.newStateRmse)} t/ha` : "—")],
  ];

  return (
    <div className={`rounded-2xl border border-gray-200 p-4 dark:border-gray-800 ${className}`}>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">¿Cómo quieres estimar el rendimiento?</p>
      <div role="radiogroup" aria-label="Modo de predicción" className={`mt-3 grid grid-cols-1 gap-3 ${stacked ? "" : "sm:grid-cols-2"}`}>
        {["lluvia", "10var"].map((key) => {
          const m = modes?.[key];
          const disabled = key === "10var" && disable10;
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => setMode(key)}
              className={`rounded-xl border p-3 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{BASE[key].title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    key === "lluvia"
                      ? "bg-accent-500 text-accent-contrast"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {BASE[key].tag}
                </span>
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{BASE[key].short}</span>
              {m && (
                <span className="mt-2 block text-xs tabular-nums text-gray-700 dark:text-gray-300">
                  Error típico {fmt(m.rmse)} t/ha · R² {fmt(m.r2)}
                </span>
              )}
              {disabled && <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">{disable10Reason}</span>}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
      >
        ¿Qué cambia entre uno y otro?
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <thead>
                <tr className="text-gray-400 dark:text-gray-500">
                  <th className="py-1 pr-3 font-medium" />
                  <th className="py-1 pr-3 font-medium">Solo lluvia</th>
                  <th className="py-1 font-medium">10 variables</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-gray-800">
                {rows.map(([label, get]) => (
                  <tr key={label}>
                    <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400">{label}</td>
                    <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{modes ? get(modes.lluvia) : "—"}</td>
                    <td className="py-1.5 text-gray-900 dark:text-gray-100">{modes ? get(modes["10var"]) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1.5 pl-4">
            <li>
              <strong>Precisión:</strong> las cifras son de validación por bloques espaciales (parcelas cercanas se dejan fuera juntas). Con las
              10 variables el error es mayor: con solo 138 parcelas de entrenamiento, los índices satelitales añaden ruido y no mejoran lo que ya explica la lluvia.
            </li>
            <li>
              <strong>Qué necesita:</strong> “Solo lluvia” requiere únicamente la lluvia de abril–mayo y funciona con cualquier CSV (Básico, PRO
              o propio) y con parcelas dibujadas. “10 variables” además necesita los índices Sentinel-2/Landsat: sirve con el CSV Básico y con parcelas
              dibujadas, pero no con el CSV PRO (Planet no trae esos índices). Si a una parcela le falta alguno por nubes, se rellena con la mediana de entrenamiento y se avisa.
            </li>
            <li>
              <strong>Explicación (SHAP):</strong> con “solo lluvia” toda la explicación es la lluvia; con “10 variables” se reparte entre la lluvia y los
              índices (la lluvia sigue pesando más).
            </li>
            <li>
              <strong>Margen de error y score:</strong> cada modo usa el error de validación de su propio modelo por estado, así que el intervalo
              del 90 % y el score de elegibilidad cambian con el modo (el de 10 variables es más ancho).
            </li>
            <li>
              Elegir uno u otro no borra resultados guardados: cada corrida se calcula con el modo que estaba seleccionado al ejecutarla.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
