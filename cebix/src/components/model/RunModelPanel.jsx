import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FlaskConical,
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
import { useModelInfo } from "../../context/ModelInfoContext";
import { useParcels } from "../../context/ParcelsContext";
import { EXAMPLE_CSV_URL, fetchExampleFile, friendlyError, predictCsv } from "../../hooks/useModelRunner";

const STATES = ["Hidalgo", "Puebla", "Tlaxcala"];

// Tiempo mínimo que el orbe "piensa", aunque el backend responda antes.
const MIN_THINKING_MS = 5000;

// Scroll hacia el final de la tabla al mostrar los resultados (react-scroll).
const SCROLL_CONTAINER_ID = "app-scroll"; // <main> en App.jsx
const SCROLL_MARGIN = 32; // px de aire bajo la tabla
const SCROLL_MIN_MS = 500;
const SCROLL_MAX_MS = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Ejecuta el modelo REAL (Random Forest, top-10 SHAP, sin Planet) en el backend de
 * inferencia (ver /backend). Sube un CSV con las 10 features y muestra la predicción
 * calculada en ese momento -- no son resultados guardados.
 */
export default function RunModelPanel() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const { loadAnalysis, clearAnalysis, hasAnalysis, analysisMeta } = useParcels();
  const { info } = useModelInfo();
  const requiredColumns = [
    "ID_POLIGONO",
    "Estado",
    info ? `${info.modelSummary.nFeatures} features del modelo` : "Features del modelo",
    "lat / lng (para el mapa)",
  ];

  function pickFile(f) {
    if (f) setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.toLowerCase().endsWith(".csv")) pickFile(dropped);
  }

  async function runWith(f) {
    if (!f) return;
    setLoading(true);
    setResults(null);

    try {
      // La petición real y el mínimo de 5 s corren en paralelo: si el modelo termina antes,
      // se espera lo que falte; si tarda más, no se añade tiempo extra.
      const [data, csvText] = await Promise.all([
        predictCsv(f),
        f.text(),
        sleep(MIN_THINKING_MS),
      ]).then(([d, text]) => [d, text]);
      setResults(data.predicciones);
      // Los resultados reales alimentan Resumen, Parcelas, Mapa, Predicciones y SHAP.
      loadAnalysis(data.predicciones, csvText, f.name);
      toast.success(
        `Modelo ejecutado: ${data.predicciones.length} parcela${data.predicciones.length === 1 ? "" : "s"} procesada${data.predicciones.length === 1 ? "" : "s"}.`
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

  // Un clic: baja el CSV de ejemplo desde el backend y ejecuta el modelo con él.
  async function handleExample() {
    try {
      const example = await fetchExampleFile();
      setFile(example);
      await runWith(example);
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  function handleClear() {
    clearAnalysis();
    setResults(null);
    setFile(null);
    toast.success("Resultados borrados. El dashboard quedó vacío.");
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
      {/* Orb: columna lateral fija al hacer scroll (en móvil va arriba). */}
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
          description="El CSV necesita estas columnas; el de ejemplo trae el formato exacto."
        >
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative z-10 min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {requiredColumns.map((c) => (
                  <span
                    key={c}
                    className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Estado: {STATES.join(", ")}. Opcionales: Municipio, area_ha, lat y lng (para el mapa y las tablas).
              </p>
            </div>
            <a
              href={EXAMPLE_CSV_URL}
              download
              className="relative z-10 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Download size={16} strokeWidth={1.75} className="text-gray-400" />
              Descargar CSV de ejemplo
            </a>
          </div>
        </Step>

        <Step
          n={2}
          title="Sube y ejecuta"
          description="El backend corre el Random Forest entrenado en ese momento; no son resultados guardados."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-accent-500 ${
                dragging
                  ? "border-accent-500 bg-gray-50 dark:bg-gray-900"
                  : file
                  ? "border-gray-400 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/60"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
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
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>

            <button
              type="submit"
              disabled={!file || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black sm:w-auto"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} strokeWidth={1.75} />}
              {loading ? "Ejecutando modelo..." : "Ejecutar modelo"}
            </button>
            <button
              type="button"
              onClick={handleExample}
              disabled={loading}
              className="ml-0 mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 sm:ml-3 sm:mt-0 sm:w-auto"
            >
              <FlaskConical size={16} strokeWidth={1.75} className="text-gray-400" />
              Probar con el archivo de ejemplo
            </button>
          </form>

        </Step>

        <Step
          n={3}
          title="Resultados"
          last
          description={
            loading
              ? "El backend está corriendo el Random Forest sobre tu CSV…"
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
          {results ? (
            <ResultsTable results={results} />
          ) : (
            <ResultsPlaceholder loading={loading} />
          )}
        </Step>
      </div>
    </div>
  );
}

// Guía en lenguaje sencillo bajo el orbe: qué significa cada columna de la tabla.
// Solo aparece cuando ya hay resultados; incluye un ejemplo leído con la primera parcela.
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

function ResultsGuide({ results }) {
  if (!results?.length) return null; // solo se muestra cuando ya hay tabla
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
          (unos {kg.toLocaleString("es-MX")} kg por hectárea), y casi seguro entre{" "}
          {first.ic90_inferior} y {first.ic90_superior}.
          {top && (
            <>
              {" "}
              Lo que más influyó fue «{top.feature}», que{" "}
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

  // Al mostrarse los resultados baja suavemente hasta el final de la tabla.
  // react-scroll cancela la animación si el usuario usa la rueda, el touch o el teclado.
  useEffect(() => {
    const el = wrapRef.current;
    const container = document.getElementById(SCROLL_CONTAINER_ID);
    if (!el || !container) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const distance = el.getBoundingClientRect().bottom + SCROLL_MARGIN - container.getBoundingClientRect().bottom;
    if (distance <= 0) return; // la tabla ya cabe en pantalla

    // Más distancia, un poco más de tiempo (con tope).
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
          {results.map((r, i) => {
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

// Filas fantasma con la forma de la tabla; el shimmer corre solo mientras el modelo se ejecuta.
// Los colores se definen en index.css (.results-skeleton) para respetar el modo oscuro.
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
      {/* Línea que une un paso con el siguiente */}
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
