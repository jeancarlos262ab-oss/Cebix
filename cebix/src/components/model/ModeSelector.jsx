import { useId, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { useModelInfo } from "../../context/ModelInfoContext";
import { usePredictionMode } from "../../services/predictionMode";
import { formatNumber } from "../../utils/intl";
import Modal from "../ui/Modal";
import { MODE_NOTICE } from "../../utils/reportMode";

const fmt = (v, d = 2) => (typeof v === "number" ? formatNumber(v, { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");

const BASE = {
  lluvia: { title: "Solo lluvia", tag: "Recomendado", short: "Lluvia de abril–mayo" },
  "10var": { title: "10 variables", tag: "Completo", short: "Lluvia + índices satelitales" },
  ciclo: { title: "Ciclo completo", tag: "Abr–oct", short: "Lluvia de las 3 etapas" },
  "10var_ciclo": { title: "10 variables + ciclo completo", tag: "Completo · abr–oct", short: "Lluvia de las 3 etapas + índices satelitales" },
};

const MODE_KEYS = ["lluvia", "10var", "ciclo", "10var_ciclo"];

// Los modos con índices Sentinel-2/Landsat no sirven con el CSV PRO (Planet).
const USES_INDICES = (key) => key === "10var" || key === "10var_ciclo";

const INFO_BTN =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-500 dark:hover:text-accent-400";

function InfoBody({ topic, modes, byRegion }) {
  const rows = [
    ["Variables que usa", (m) => (m ? `${m.nFeatures}` : "—")],
    ["Desviación (RMSE)", (m) => (m ? `${fmt(m.rmse)} t/ha` : "—")],
    ["R² (qué parte de la variación explica)", (m) => fmt(m?.r2)],
    ["En un estado sin parcelas de entrenamiento", (m) => (m ? `${fmt(m.newStateRmse)} t/ha` : "—")],
  ];

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="text-gray-400 dark:text-gray-500">
            <th className="py-1 pr-3 font-medium" />
            <th className="py-1 pr-3 font-medium">Solo lluvia</th>
            <th className="py-1 pr-3 font-medium">10 variables</th>
            <th className="py-1 pr-3 font-medium">Ciclo completo</th>
            <th className="py-1 font-medium">10 var. + ciclo</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map(([label, get]) => (
            <tr key={label}>
              <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400">{label}</td>
              <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{modes ? get(modes.lluvia) : "—"}</td>
              <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{modes ? get(modes["10var"]) : "—"}</td>
              <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{modes ? get(modes.ciclo) : "—"}</td>
              <td className="py-1.5 text-gray-900 dark:text-gray-100">{modes ? get(modes["10var_ciclo"]) : "—"}</td>
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

  if (topic === "ciclo") {
    return (
      <div className="space-y-4">
        {table}
        <ul className={list}>
          {item(
            "Qué usa",
            "la lluvia CHIRPS de las tres etapas del ciclo abril–octubre por separado: emergencia-macollamiento (abr–may), encañado (jun–jul) y espigado-llenado (ago–sep). No usa índices satelitales.",
          )}
          {item(
            "Por qué por separado",
            "acumular toda la lluvia del ciclo en un solo número empeora mucho el resultado (error de 0.90 t/ha, peor que predecir el promedio del estado). Separada por etapas el modelo recupera casi la precisión de abril–mayo.",
          )}
          {item(
            "Precisión",
            "queda un poco por debajo de “Solo lluvia”: la lluvia de abril–mayo concentra casi todo el peso y las otras dos etapas aportan muy poco. Úsalo para contrastar o para parcelas donde importe el ciclo completo, no como sustituto.",
          )}
          {item(
            "Qué necesita",
            "el CSV Básico u oficial y las parcelas dibujadas. Un CSV propio debe traer las tres columnas de lluvia por etapa; si falta alguna, no se estima. Con parcelas dibujadas la lectura de CHIRPS tarda más (abril a septiembre).",
          )}
          {item("Explicación (SHAP)", "se reparte entre las tres etapas, con abril–mayo muy por encima de las otras.")}
        </ul>
      </div>
    );
  }

  if (topic === "10var_ciclo") {
    return (
      <div className="space-y-4">
        {table}
        <ul className={list}>
          {item(
            "Qué usa",
            "combina los dos anteriores: la lluvia CHIRPS de las tres etapas del ciclo abril–octubre por separado (abr–may, jun–jul y ago–sep) más los 9 índices de Sentinel-2/Landsat (LAI, NDVI, NDTI, STI, NDWI, EVI, nº de imágenes). En total son 12 columnas: las 10 variables, con la lluvia repartida en las tres etapas.",
          )}
          {item(
            "Qué necesita",
            "sirve con el CSV Básico u oficial y con parcelas dibujadas, pero no con el CSV PRO (Planet no trae los índices). Un CSV propio debe traer las tres columnas de lluvia por etapa y los índices; si falta algún índice por nubes, se rellena con la mediana de entrenamiento y se avisa. Con parcelas dibujadas es el modo más lento, porque lee imágenes y la lluvia de abril a septiembre.",
          )}
          {item(
            "Precisión",
            "queda en el mismo nivel que “10 variables”: con solo 138 parcelas de entrenamiento, ni los índices satelitales ni la lluvia de las etapas tardías mejoran lo que ya explica la lluvia de abril–mayo. Úsalo para contrastar o cuando importe tener el ciclo completo y los índices en la misma estimación.",
          )}
          {item("Explicación (SHAP)", "la lluvia de abril–mayo concentra casi todo el peso; los índices aportan poco y la lluvia de encañado y espigado-llenado casi nada.")}
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
          <p className="font-medium text-gray-700 dark:text-gray-300">Desviación por estado</p>
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
          "“Solo lluvia” funciona con cualquier CSV (Básico, PRO o propio) y con parcelas dibujadas. “10 variables” además necesita los índices Sentinel-2/Landsat: no sirve con el CSV PRO (Planet no trae esos índices). “Ciclo completo” necesita la lluvia de las tres etapas: sirve con los CSV oficiales y con parcelas dibujadas. “10 variables + ciclo completo” necesita las dos cosas (índices y lluvia de las tres etapas): sirve con el CSV Básico y con parcelas dibujadas, no con el CSV PRO.",
        )}
        {item("Por qué abril–mayo", "el ciclo va de abril a octubre, pero solo la lluvia de abril–mayo distingue bien entre parcelas. Probamos acumularla por más meses y el error sube: abril–junio 0.60, abril–septiembre 0.80 y abril–octubre 0.84 t/ha, contra 0.53 con abril–mayo. Por eso el modo “Ciclo completo” usa la lluvia de cada etapa por separado y no el total.")}
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
  const selectId = useId();
  const modes = info?.modelModes;
  const active = disable10 && USES_INDICES(mode) ? "lluvia" : mode;

  const titles = {
    compare: "¿Qué cambia entre uno y otro?",
    lluvia: BASE.lluvia.title,
    "10var": BASE["10var"].title,
    ciclo: BASE.ciclo.title,
    "10var_ciclo": BASE["10var_ciclo"].title,
  };

  return (
    <div className={`@container ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={selectId} className={`font-medium text-gray-900 dark:text-gray-100 ${stacked ? "text-xs" : "text-sm"}`}>¿Cómo quieres estimar el rendimiento?</label>
        <button type="button" onClick={() => setTopic("compare")} aria-label="Comparar los modos" className={INFO_BTN}>
          <Info size={16} />
        </button>
      </div>

      <div className="relative mt-2">
        <select
          id={selectId}
          value={active}
          onChange={(e) => setMode(e.target.value)}
          aria-describedby={`${selectId}-desc`}
          className={`w-full appearance-none border border-gray-200 bg-white pr-10 font-medium text-gray-900 transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-100 dark:hover:bg-gray-900 ${
            stacked ? "rounded-lg px-3 py-2 text-xs" : "rounded-xl px-4 py-3 text-sm"
          }`}
        >
          {MODE_KEYS.map((key) => {
            const { title, tag } = BASE[key];
            const disabled = USES_INDICES(key) && disable10;
            return (
              <option key={key} value={key} disabled={disabled}>
                {`${title} · ${tag}${disabled ? " (no disponible con este archivo)" : ""}`}
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />
      </div>

      <div id={`${selectId}-desc`} className="mt-2 flex items-start justify-between gap-2">
        <div className={`min-w-0 ${stacked ? "text-[11px] leading-snug" : "text-xs"} text-gray-500 dark:text-gray-400`}>
          <p>
            {BASE[active].short}
            {modes?.[active] && <span className="tabular-nums"> · Desviación {fmt(modes[active].rmse)} t/ha</span>}
          </p>
          {MODE_NOTICE[active] && <p className="mt-1 text-amber-600 dark:text-amber-400">{MODE_NOTICE[active]}</p>}
          {disable10 && <p className="mt-1 text-amber-600 dark:text-amber-400">Modos con 10 variables: {disable10Reason}</p>}
        </div>
        <button
          type="button"
          onClick={() => setTopic(active)}
          aria-label={`Información: ${BASE[active].title}`}
          className={INFO_BTN}
        >
          <Info size={16} />
        </button>
      </div>

      {topic && (
        <Modal title={titles[topic]} size="sm" onClose={() => setTopic(null)}>
          <InfoBody topic={topic} modes={modes} byRegion={info?.rmseByRegion} />
        </Modal>
      )}
    </div>
  );
}