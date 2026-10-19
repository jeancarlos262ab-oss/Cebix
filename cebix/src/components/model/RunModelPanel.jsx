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
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { animateScroll } from "react-scroll";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Link } from "react-router-dom";
import LiquidOrbLoader from "./LiquidOrbLoader";
import Dropzone from "../ui/Dropzone";
import DocumentPeek from "../ui/DocumentPeek";
import ModeSelector from "./ModeSelector";
import { useModelInfo } from "../../context/ModelInfoContext";
import { useParcels } from "../../context/ParcelsContext";
import { EXAMPLE_TODOS_URL, fetchSubmissionCsv, friendlyError, predictCsv } from "../../services/modelApi";
import { formatNumber } from "../../utils/intl";
import { detectKind } from "../../utils/csvKind";

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

  async function runWith(f) {
    if (!f) return;
    const hadAnalysis = hasAnalysis;
    setLoading(true);
    setResults(null);
    setModelUsed(null);
    setModeUsed(null);

    try {
      
      
      const k = await detectKind(f);
      const official = k !== "otro";
      const [data, csvText] = await Promise.all([
        predictCsv(f),
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
      toast.error(friendlyError(err));
    } finally {
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
    toast.success("Resultados borrados. El dashboard quedó vacío.");
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
              className="relative z-10 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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

            <button
              type="submit"
              disabled={!file || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black sm:w-auto"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} strokeWidth={1.75} />}
              {loading ? "Ejecutando modelo..." : "Ejecutar modelo"}
            </button>
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  Borrar resultados
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
          description="Un CSV con el rendimiento estimado de cada parcela del conjunto de predicción (59 parcelas)."
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
      toast.success(`Archivo ${filename} descargado (59 parcelas).`);
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
