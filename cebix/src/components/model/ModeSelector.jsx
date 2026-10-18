import { useState } from "react";
import { Info } from "lucide-react";
import { useModelInfo } from "../../context/ModelInfoContext";
import { usePredictionMode } from "../../services/predictionMode";
import { formatNumber } from "../../utils/intl";
import Modal from "../ui/Modal";

const fmt = (v, d = 2) => (typeof v === "number" ? formatNumber(v, { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");

const BASE = {
  lluvia: { title: "Solo lluvia", tag: "Recomendado", short: "Lluvia de abril–mayo" },
  "10var": { title: "10 variables", tag: "Completo", short: "Lluvia + índices satelitales" },
};

const INFO_BTN =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-500 dark:hover:text-accent-400";

const INFO_BTN_ON =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-accent-600 transition-colors hover:text-accent-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:text-accent-500";

function InfoBody({ topic, modes, byRegion }) {
  const rows = [
    ["Variables que usa", (m) => (m ? `${m.nFeatures}` : "—")],
    ["Error típico (RMSE)", (m) => (m ? `${fmt(m.rmse)} t/ha` : "—")],
    ["R² (qué parte de la variación explica)", (m) => fmt(m?.r2)],
    ["En un estado sin parcelas de entrenamiento", (m) => (m ? `${fmt(m.newStateRmse)} t/ha` : "—")],
  ];

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead>
          <tr className="text-gray-400 dark:text-gray-500">
            <th className="py-1 pr-3 font-medium" />
            <th className="py-1 pr-3 font-medium">Solo lluvia</th>
            <th className="py-1 font-medium">10 variables</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
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
  );

  const item = (title, text) => (
    <li>
      <strong className="text-gray-900 dark:text-gray-100">{title}:</strong> {text}
    </li>
  );

  const list = "list-disc space-y-2 pl-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400";

  if (topic === "lluvia") {
    return (
      <div className="space-y-4">
        {table}
        <ul className={list}>
          {item("Qué usa", "únicamente la lluvia de abril–mayo (CHIRPS). Es el más preciso y estable en la validación.")}
          {item("Por qué abril–mayo", "el ciclo va de abril a octubre, pero solo la lluvia de abril–mayo distingue bien entre parcelas. Probamos acumularla por más meses y el error sube: abril–junio 0.60, abril–septiembre 0.80 y abril–octubre 0.84 t/ha, contra 0.53 con abril–mayo.")}
          {item("Qué necesita", "funciona con cualquier CSV (Básico, PRO o propio) y con parcelas dibujadas.")}
          {item("Explicación (SHAP)", "toda la explicación es la lluvia.")}
        </ul>
      </div>
    );
  }

  if (topic === "10var") {
    return (
      <div className="space-y-4">
        {table}
        <ul className={list}>
          {item(
            "Qué usa",
            "suma 9 índices de Sentinel-2/Landsat (LAI, NDVI, NDTI, STI, NDWI, EVI, nº de imágenes) a la lluvia.",
          )}
          {item(
            "Qué necesita",
            "sirve con el CSV Básico y con parcelas dibujadas, pero no con el CSV PRO (Planet no trae esos índices). Si a una parcela le falta alguno por nubes, se rellena con la mediana de entrenamiento y se avisa.",
          )}
          {item(
            "Precisión",
            "con solo 138 parcelas de entrenamiento, los índices satelitales añaden ruido y no mejoran lo que ya explica la lluvia.",
          )}
          {item("Explicación (SHAP)", "se reparte entre la lluvia y los índices (la lluvia sigue pesando más).")}
        </ul>
      </div>
    );
  }

  const regiones = Array.isArray(byRegion) && byRegion.length ? byRegion : null;
  const limites = (
    <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Límites del modelo</p>
      <ul className={`mt-2 ${list}`}>
        {item(
          "Útil para",
          "ordenar y comparar parcelas dentro de esta zona y este ciclo. No es para predecir otro año ni otra región.",
        )}
        {item(
          "La lluvia y la ubicación van juntas",
          "la lluvia de abril–mayo se relaciona con el rendimiento (r = −0.68), pero dentro de cada estado la relación es mucho menor: Hidalgo −0.66, Puebla −0.24 y Tlaxcala 0.00. Parte de lo que el modelo capta es la diferencia entre estados, y con un solo año no se puede separar de la lluvia.",
        )}
        {item(
          "Un solo ciclo",
          "se entrenó solo con 2025: no ha visto un año seco, húmedo o con helada. Fuera de ese rango la estimación es una extrapolación.",
        )}
        {item(
          "Lo que no se sabe",
          "variedad, fecha de siembra, manejo y suelo no vienen en los datos y explican parte del rendimiento que el modelo no capta.",
        )}
      </ul>
      {regiones && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <p className="font-medium text-gray-700 dark:text-gray-300">Error típico por estado</p>
          <p className="mt-1 tabular-nums">
            {regiones.map((r) => `${r.region} ${fmt(r.rmse)} t/ha`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {table}
      <ul className={list}>
        {item(
          "Precisión",
          "las cifras son de validación por bloques espaciales (parcelas cercanas se dejan fuera juntas). Con las 10 variables el error es mayor: con solo 138 parcelas de entrenamiento, los índices satelitales añaden ruido y no mejoran lo que ya explica la lluvia.",
        )}
        {item(
          "Qué necesita",
          "“Solo lluvia” funciona con cualquier CSV (Básico, PRO o propio) y con parcelas dibujadas. “10 variables” además necesita los índices Sentinel-2/Landsat: no sirve con el CSV PRO (Planet no trae esos índices).",
        )}
        {item("Por qué abril–mayo", "el ciclo va de abril a octubre, pero solo la lluvia de abril–mayo distingue bien entre parcelas. Probamos acumularla por más meses y el error sube: abril–junio 0.60, abril–septiembre 0.80 y abril–octubre 0.84 t/ha, contra 0.53 con abril–mayo.")}
        {item(
          "Explicación (SHAP)",
          "con “solo lluvia” toda la explicación es la lluvia; con “10 variables” se reparte entre la lluvia y los índices.",
        )}
        {item(
          "Margen de error y score",
          "cada modo usa el error de validación de su propio modelo por estado, así que el intervalo del 90 % y el índice de rendimiento cambian con el modo (el de 10 variables es más ancho).",
        )}
        <li>Elegir uno u otro no borra resultados guardados: cada corrida se calcula con el modo que estaba seleccionado al ejecutarla.</li>
      </ul>
      {limites}
    </div>
  );
}

export default function ModeSelector({ disable10 = false, disable10Reason = "", stacked = false, className = "" }) {
  const [mode, setMode] = usePredictionMode();
  const { info } = useModelInfo();
  const [topic, setTopic] = useState(null);
  const modes = info?.modelModes;
  const active = disable10 && mode === "10var" ? "lluvia" : mode;

  const titles = {
    compare: "¿Qué cambia entre uno y otro?",
    lluvia: BASE.lluvia.title,
    "10var": BASE["10var"].title,
  };

  return (
    <div className={`@container ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-medium text-gray-900 dark:text-gray-100 ${stacked ? "text-xs" : "text-sm"}`}>¿Cómo quieres estimar el rendimiento?</p>
        <button type="button" onClick={() => setTopic("compare")} aria-label="Comparar los dos modos" className={INFO_BTN}>
          <Info size={16} />
        </button>
      </div>

      <div role="radiogroup" aria-label="Modo de predicción" className={`mt-2 grid grid-cols-1 ${stacked ? "gap-1.5 @md:grid-cols-2" : "gap-3 sm:grid-cols-2"}`}>
        {["lluvia", "10var"].map((key) => {
          const m = modes?.[key];
          const { title, tag, short } = BASE[key];
          const disabled = key === "10var" && disable10;
          const selected = active === key;
          return (
            <div key={key} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => setMode(key)}
                className={`flex w-full items-start text-left ${stacked ? "gap-2.5 rounded-lg p-2.5" : "gap-3 rounded-2xl p-4"} border transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-accent-500"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-accent-500" : "border-gray-400 dark:border-gray-600"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-accent-500" />}
                </span>
                <span className={`min-w-0 flex-1 ${stacked ? "pr-6" : "pr-7"}`}>
                  <span className="flex items-center gap-2">
                    <span className={`truncate font-semibold ${stacked ? "text-xs" : "text-sm"} ${selected ? "text-accent-600 dark:text-accent-400" : "text-gray-900 dark:text-gray-100"}`}>{title}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${selected ? "text-accent-600 dark:text-accent-400 opacity-80" : "text-gray-400 dark:text-gray-500"}`}>{tag}</span>
                  </span>
                  <span className={`mt-0.5 block ${stacked ? "text-[11px] leading-snug" : "text-xs"} ${selected ? "text-accent-600 dark:text-accent-400" : "text-gray-500 dark:text-gray-400"}`}>{short}</span>
                  <span className={`${stacked ? "mt-1 text-[11px]" : "mt-2 text-xs"} block tabular-nums ${selected ? "text-accent-600 dark:text-accent-400" : "text-gray-700 dark:text-gray-300"}`}>
                    Error típico {fmt(m?.rmse)} t/ha
                  </span>
                  {disabled && <span className={`mt-1 block text-xs text-amber-600 dark:text-amber-400`}>{disable10Reason}</span>}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTopic(key)}
                aria-label={`Información: ${title}`}
                className={`absolute ${stacked ? "right-2 top-2" : "right-3 top-3"} ${selected ? INFO_BTN_ON : INFO_BTN}`}
              >
                <Info size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {topic && (
        <Modal title={titles[topic]} size="sm" onClose={() => setTopic(null)}>
          <InfoBody topic={topic} modes={modes} byRegion={info?.rmseByRegion} />
        </Modal>
      )}
    </div>
  );
}