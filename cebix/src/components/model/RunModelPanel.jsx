import { useEffect, useRef, useState } from "react";
import { toast } from "../../services/toast";
import {
  AlertTriangle,
  Download,
  LayoutGrid,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Play,
  TrendingDown,
  X,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { animateScroll } from "react-scroll";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Link } from "react-router-dom";
import LiquidOrbLoader from "./LiquidOrbLoader";
import Dropzone from "../ui/Dropzone";
import SlowHint from "../ui/SlowHint";
import DocumentPeek from "../ui/DocumentPeek";
import ModeSelector from "./ModeSelector";
import { useModelInfo } from "../../context/ModelInfoContext";
import { useParcels } from "../../context/ParcelsContext";
import { EXAMPLE_TODOS_URL, PREDICTION_SET_SIZE, fetchSubmissionCsv, friendlyError, predictCsv } from "../../services/modelApi";
import { formatNumber, formatFixed } from "../../utils/intl";
import { detectKind } from "../../utils/csvKind";
import { BTN_OUTLINE, BTN_OUTLINE_SM } from "../ui/buttonStyles";

const MIN_THINKING_MS = 5000;

const SCROLL_CONTAINER_ID = "app-scroll"; 
const SCROLL_MARGIN = 32; 
const SCROLL_MIN_MS = 500;
const SCROLL_MAX_MS = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function RunModelPanel() {
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState(null); 
  const [modeUsed, setModeUsed] = useState(null); 
  const [modelUsed, setModelUsed] = useState(null); 
  const [runName, setRunName] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const { loadAnalysis, clearAnalysis, hasAnalysis, analysisMeta } = useParcels();
  const { info } = useModelInfo();
  
  function handleFiles(files) {
    const picked = files.find((f) => f.name.toLowerCase().endsWith(".csv"));
    if (picked) {
      setFile(picked);
      setRunName(picked.name);
      setKind(null);
      detectKind(picked).then((k) => {
        setKind(k);
        if (k === "planet") toast.success("Archivo de Planet detectado: se ejecuta el modelo de lluvia, porque con Planet la precisión no mejora. Los índices de Planet quedan como contexto.");
      });
    }
  }

  const abortRef = useRef(null);

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function runWith(f) {
    if (!f) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const hadAnalysis = hasAnalysis;
    setLoading(true);
    setResults(null);
    setModelUsed(null);
    setModeUsed(null);

    try {
      
      
      const k = await detectKind(f);
      const official = k !== "otro";
      const [data, csvText] = await Promise.all([
        predictCsv(f, undefined, controller.signal),
        official ? Promise.resolve("") : f.text(),
        sleep(MIN_THINKING_MS),
      ]).then(([d, text]) => [d, text]);
      setResults(data.predicciones);
      setModelUsed(data.modelo || "abierto");
      setModeUsed(data.modo || "lluvia");
      
      loadAnalysis(data.predicciones, csvText, runName.trim() || f.name);
      toast.success(
        `Modelo (${data.modo === "10var" ? "10 variables" : data.modo === "ciclo" ? "ciclo completo" : data.modo === "10var_ciclo" ? "10 variables + ciclo completo" : "solo lluvia"}) ejecutado: ${data.predicciones.length} parcela${data.predicciones.length === 1 ? "" : "s"} procesada${data.predicciones.length === 1 ? "" : "s"}. Pulsa "Guardar corrida" para conservarla${hadAnalysis ? "; reemplazará la corrida guardada anterior" : ""}.`
      );
    } catch (err) {
      if (controller.signal.aborted || err?.name === "AbortError") toast.success("Cálculo cancelado.");
      else toast.error(friendlyError(err));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runWith(file);
  }

  function handleClear() {
    clearAnalysis();
    setResults(null);
    setFile(null);
    setKind(null);
    setModelUsed(null);
    setModeUsed(null);
    setRunName("");
    toast.success("Resultados eliminados. El dashboard quedó vacío.");
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
      {}
      <aside className="order-first md:order-last">
        <div className="md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:overflow-y-auto scrollbar-none">
          <div className="flex justify-center py-2 md:py-4">
            <div className="w-36 lg:w-44">
              <LiquidOrbLoader
                size={176}
                running={loading}
                label={loading ? "Ejecutando modelo…" : "Modelo en espera"}
              />
            </div>
          </div>
          <ResultsGuide results={results} />
        </div>
      </aside>

      <div className="min-w-0 space-y-10">
        <Step
          n={1}
          title="Prepara tu archivo"
          description="Sube tu archivo de datos (Básico o PRO). El modelo estima el rendimiento con la lluvia de abril–mayo de cada parcela."
        >
          {}
          <div className="relative flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
            {

}
            <div aria-hidden="true" className="pointer-events-none absolute -top-10 bottom-0 left-4 hidden w-32 overflow-hidden sm:block">
              <DocumentPeek className="absolute left-0 top-0 h-[149px] w-32" />
            </div>
            <div aria-hidden="true" className="hidden w-28 shrink-0 sm:block" />
            <div className="relative z-10 min-w-0 sm:flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Archivo de datos (CSV)</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Estima el rendimiento de las parcelas del archivo. También sirve tu propio CSV con una fila por parcela.
              </p>
            </div>
            <a
              href={EXAMPLE_TODOS_URL}
              download
              className={`relative z-10 shrink-0 ${BTN_OUTLINE}`}
            >
              <Download size={16} strokeWidth={1.75} className="text-gray-400" />
              Descargar archivos de ejemplo
            </a>
          </div>
        </Step>

        <Step
          n={2}
          title="Sube y ejecuta"
          description="El modelo se ejecuta en este momento con tu archivo; no son resultados guardados."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Dropzone accept=".csv" active={Boolean(file)} onFiles={handleFiles}>
              {file ? (
                <FileSpreadsheet size={24} strokeWidth={1.5} className="text-gray-500 dark:text-gray-400" />
              ) : (
                <UploadCloud size={24} strokeWidth={1.5} className="text-gray-400 dark:text-gray-500" />
              )}
              <span className="max-w-full truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {file ? file.name : "Elegir archivo CSV"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {file ? `${formatSize(file.size)} · haz clic para cambiarlo` : "o arrástralo aquí"}
              </span>
            </Dropzone>

            <ModeSelector
              disable10={kind === "planet"}
              disable10Reason="El archivo PRO (Planet) no trae los índices Sentinel-2/Landsat que usa este modo."
            />

            {kind === "planet" && file && (
              <p className="rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                Archivo de Planet detectado: se ejecuta el modelo de lluvia (con Planet la precisión no mejora); sus índices quedan como contexto.
              </p>
            )}

            {file && (
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0">Nombre del archivo</span>
                <input
                  type="text"
                  value={runName}
                  maxLength={80}
                  disabled={loading}
                  onChange={(e) => setRunName(e.target.value)}
                  onBlur={() => setRunName((v) => v.trim() || file.name)}
                  className="min-w-0 flex-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-accent-500 disabled:opacity-60 dark:bg-gray-900/60 dark:text-gray-100 dark:hover:bg-gray-900 dark:focus:bg-black"
                />
              </label>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={!file || loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black sm:w-auto"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} strokeWidth={1.75} />}
                {loading ? "Ejecutando modelo…" : "Ejecutar modelo"}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`w-full sm:w-auto ${BTN_OUTLINE} px-5 py-2.5`}
                >
                  <X size={16} strokeWidth={1.75} />
                  Cancelar cálculo
                </button>
              )}
            </div>
            {loading && <SlowHint />}
          </form>

        </Step>

        <Step
          n={3}
          title="Resultados"
          description={
            loading
              ? "Se está calculando el rendimiento de tus parcelas…"
              : results
              ? `${results.length} parcelas procesadas en vivo por el modelo.`
              : "Aquí aparecerán las predicciones cuando ejecutes el modelo."
          }
        >
          {hasAnalysis && analysisMeta && (
            <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-gray-200 p-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                El dashboard muestra los resultados de <strong>{analysisMeta.fileName || "la última corrida"}</strong>{" "}
                ({analysisMeta.count} parcelas).
              </span>
              <span className="flex gap-2">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 font-medium text-accent-contrast hover:bg-accent-600"
                >
                  <LayoutGrid size={13} strokeWidth={1.75} />
                  Ver en el dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleClear}
                  className={BTN_OUTLINE_SM}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  Eliminar resultados
                </button>
              </span>
            </div>
          )}
          {results && modelUsed && (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Modelo usado:{" "}
              <strong className="text-gray-800 dark:text-gray-200">
                {modeUsed === "10var" ? "10 variables" : modeUsed === "ciclo" ? "ciclo completo, lluvia de 3 etapas (CHIRPS)" : modeUsed === "10var_ciclo" ? "10 variables + ciclo completo (lluvia de 3 etapas e índices Sentinel-2/Landsat)" : "solo lluvia temprana (CHIRPS)"}
              </strong>
              {(modeUsed === "10var" || modeUsed === "ciclo" || modeUsed === "10var_ciclo") && " · Desviación mayor que con solo lluvia; ver Modelo → Resumen."}
            </p>
          )}
          {results && <ReliabilityNotice results={results} />}
          {results ? (
            <ResultsTable results={results} />
          ) : (
            <ResultsPlaceholder loading={loading} />
          )}
        </Step>

        <Step
          n={4}
          title="Descarga un resumen"
          last
          description={`Un CSV con el rendimiento estimado de cada parcela del conjunto de predicción (${PREDICTION_SET_SIZE} parcelas).`}
        >
          <SubmissionDownload />
        </Step>
      </div>
    </div>
  );
}

function SubmissionDownload() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDownload(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { blob, filename } = await fetchSubmissionCsv(name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Archivo ${filename} descargado (${PREDICTION_SET_SIZE} parcelas).`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleDownload} className="space-y-3">
      <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0">Nombre del archivo</span>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder="ej. mi_proyecto"
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-accent-500 disabled:opacity-60 dark:bg-gray-900/60 dark:text-gray-100 dark:hover:bg-gray-900 dark:focus:bg-black"
        />
      </label>
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black sm:w-auto"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={1.75} />}
        {busy ? "Generando…" : "Descargar resumen (CSV)"}
      </button>
      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        Columnas: ID_POLIGONO, AREA_HA, RENDIMIENTO_T_HA y CONJUNTO. Se calcula siempre con «Solo lluvia», el modelo con mejor validación
        (desviación de unos 0.53 t/ha), sin importar el modo elegido arriba. Es una referencia de riesgo, no una cifra exacta de cosecha. Se descarga
        como &lt;nombre&gt;_prediccion.csv.
      </p>
    </form>
  );
}

const GUIDE_ITEMS = [
  {
    term: "Rendimiento (t/ha)",
    text: "Cuánta cebada se espera cosechar en cada hectárea. 1 tonelada (t) son 1,000 kg.",
  },
  {
    term: "IC 90%",
    text: "El rango más probable. Hay un 90 % de probabilidad de que la cosecha real quede entre esos dos números.",
  },
  {
    term: "± RMSE",
    text: "Cuánto suele equivocarse el modelo, en t/ha. Mientras más pequeño, más confiable es la estimación.",
  },
  {
    term: "Variable de mayor impacto",
    text: "El factor que más pesó en la estimación. Flecha verde ↑: la subió. Flecha roja ↓: la bajó.",
  },
];

const FALLBACK_LIMITS = [
  "Un solo ciclo de entrenamiento (2025) y una sola variable: la lluvia de abril–mayo.",
  "Desviación de ±0.54 t/ha: sirve para comparar y priorizar parcelas, no para fijar una cifra exacta.",
];

function ReliabilityNotice({ results }) {
  const { info } = useModelInfo();
  const limits = info?.limitaciones?.length ? info.limitaciones : FALLBACK_LIMITS;
  const outside = results.filter((r) => r.fuera_de_rango);
  return (
    <div className="mb-3 space-y-2 text-xs">
      {outside.length > 0 && (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {outside.length === 1 ? "1 parcela queda" : `${outside.length} parcelas quedan`} fuera de lo que el modelo vio al entrenar
            </p>
            <p className="mt-0.5">
              Su estimación es una extrapolación y menos confiable ({outside.slice(0, 5).map((r) => r.ID_POLIGONO).join(", ")}
              {outside.length > 5 ? "…" : ""}). Pasa el cursor sobre la etiqueta &quot;Fuera de rango&quot; para ver el motivo.
            </p>
          </div>
        </div>
      )}
      <details className="rounded-2xl border border-gray-200 p-3 text-gray-600 dark:border-gray-800 dark:text-gray-400">
        <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
          Cómo interpretar estas estimaciones
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {limits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ResultsGuide({ results }) {
  if (!results?.length) return null; 
  const first = results[0];
  const top = first?.shap?.[0];
  const kg = first ? Math.round(Number(first.yieldEstimate) * 1000) : NaN;

  return (
    <div className="mt-2 rounded-2xl border border-gray-200 p-4 text-xs dark:border-gray-800 md:mt-4">
      <h3 className="font-display text-xs font-semibold text-gray-900 dark:text-gray-100">
        ¿Cómo leer la tabla?
      </h3>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        Cada fila es una parcela y el modelo estima cuánta cebada dará.
      </p>

      <dl className="mt-3 space-y-2.5">
        {GUIDE_ITEMS.map((item) => (
          <div key={item.term}>
            <dt className="font-medium text-gray-900 dark:text-gray-100">{item.term}</dt>
            <dd className="mt-0.5 text-gray-500 dark:text-gray-400">{item.text}</dd>
          </div>
        ))}
      </dl>

      {Number.isFinite(kg) && (
        <p className="mt-3 pt-3 text-gray-700 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-gray-100">Ejemplo: </span>
          la parcela {first.ID_POLIGONO} ({first.Estado}) daría cerca de {first.yieldEstimate} t/ha
          (unos {formatNumber(kg)} kg por hectárea), y, con unos 90 % de probabilidad, entre{" "}
          {first.ic90_inferior} y {first.ic90_superior} (es un rango probable, no una garantía).
          {top && (
            <>
              {" "}
              Lo que más influyó fue &quot;{top.feature}&quot;, que{" "}
              {top.direction === "positivo" ? "subió" : "bajó"} la estimación.
            </>
          )}
        </p>
      )}
    </div>
  );
}

function ResultsTable({ results }) {
  const wrapRef = useRef(null);

  
  
  useEffect(() => {
    const el = wrapRef.current;
    const container = document.getElementById(SCROLL_CONTAINER_ID);
    if (!el || !container) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const distance = el.getBoundingClientRect().bottom + SCROLL_MARGIN - container.getBoundingClientRect().bottom;
    if (distance <= 0) return; 

    
    const duration = Math.min(SCROLL_MAX_MS, Math.max(SCROLL_MIN_MS, distance * 1.2));
    animateScroll.scrollMore(distance, {
      containerId: SCROLL_CONTAINER_ID,
      smooth: "easeInOutQuad",
      duration,
    });
  }, [results]);

  return (
    <div
      ref={wrapRef}
      className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <th className="px-4 py-3 font-medium">Parcela</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 text-right font-medium">Rendimiento (t/ha)</th>
            <th className="px-4 py-3 font-medium">IC 90%</th>
            <th className="px-4 py-3 font-medium">± RMSE</th>
            <th className="px-4 py-3 font-medium">Variable de mayor impacto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {results.map((r) => {
            const top = r.shap[0];
            const positive = top?.direction === "positivo";
            const DirIcon = positive ? TrendingUp : TrendingDown;
            return (
              <tr
                key={r.ID_POLIGONO}
                className="text-gray-900 transition-colors hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium">{r.ID_POLIGONO}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">
                  {r.Estado}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-display text-base font-semibold tabular-nums">
                  {r.yieldEstimate}
                  {Number.isFinite(r.ic90_inferior) && Number.isFinite(r.ic90_superior) && (
                    <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                      ± {formatFixed(((r.ic90_superior - r.ic90_inferior) / 2), 1)}
                    </span>
                  )}
                  {r.fuera_de_rango && (
                    <span
                      title={(r.avisos ?? []).join(" ")}
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 align-middle font-sans text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                    >
                      <AlertTriangle size={10} aria-hidden="true" />
                      Fuera de rango
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400">
                  {r.ic90_inferior} – {r.ic90_superior}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400">
                  {r.confidence}
                </td>
                <td className="min-w-[16rem] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <DirIcon
                      size={15}
                      aria-hidden="true"
                      className={`mt-0.5 shrink-0 ${
                        positive
                          ? "text-ndvi-600 dark:text-ndvi-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {top?.feature}
                      <span className="ml-1 text-gray-400 dark:text-gray-500">({top?.direction})</span>
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultsPlaceholder({ loading }) {
  const bar = {
    height: 10,
    borderRadius: 2,
    enableAnimation: loading,
  };

  return (
    <div
      aria-hidden="true"
      className="results-skeleton overflow-hidden rounded-2xl border border-dashed border-gray-300 dark:border-gray-700"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-3.5 ${
            ""
          }`}
        >
          <Skeleton {...bar} containerClassName="block w-16" />
          <Skeleton {...bar} containerClassName="block w-14" />
          <Skeleton {...bar} containerClassName="block w-12 strong" />
          <Skeleton {...bar} containerClassName="hidden w-24 sm:block" />
          <Skeleton {...bar} containerClassName="hidden flex-1 md:block" />
        </div>
      ))}
    </div>
  );
}

function Step({ n, title, description, last = false, children }) {
  return (
    <section className="relative flex gap-4">
      {}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-3.5 top-9 -bottom-10 w-px -translate-x-1/2 bg-gray-200 dark:bg-gray-800"
        />
      )}
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-xs font-medium tabular-nums text-gray-600 dark:border-gray-700 dark:bg-black dark:text-gray-300">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}