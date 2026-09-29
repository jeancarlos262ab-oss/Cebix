import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import LiquidOrbLoader from "./LiquidOrbLoader";

const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");

const REQUIRED_COLUMNS = ["ID_POLIGONO", "Estado", "10 features del modelo"];
const STATES = ["Hidalgo", "Puebla", "Tlaxcala"];

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

  function pickFile(f) {
    if (f) setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.toLowerCase().endsWith(".csv")) pickFile(dropped);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/predict-csv`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(
          typeof detail.detail === "string" ? detail.detail : `El backend respondió ${res.status}`
        );
      }
      const data = await res.json();
      setResults(data.predicciones);
      toast.success(
        `Modelo ejecutado: ${data.predicciones.length} parcela${data.predicciones.length === 1 ? "" : "s"} procesada${data.predicciones.length === 1 ? "" : "s"}.`
      );
    } catch (err) {
      toast.error(
        err.message === "Failed to fetch"
          ? "No se pudo conectar al backend. Si está en Render/Railway con plan gratuito puede tardar ~30 s en despertar; intenta de nuevo."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
      {/* Orb: columna lateral fija al hacer scroll (en móvil va arriba). */}
      <aside className="order-first md:order-last">
        <div className="md:sticky md:top-6">
          <div className="flex justify-center py-2 md:py-4">
            <div className="w-36 lg:w-44">
              <LiquidOrbLoader
                size={176}
                running={loading}
                label={loading ? "Ejecutando modelo…" : "Modelo en espera"}
              />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-10">
        <Step
          n={1}
          title="Prepara tu archivo"
          description="El CSV necesita estas columnas; el de ejemplo trae el formato exacto."
        >
          <div className="flex flex-col gap-4 border border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                <FileSpreadsheet size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {REQUIRED_COLUMNS.map((c) => (
                    <span
                      key={c}
                      className="bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Estado: {STATES.join(", ")}.
                </p>
              </div>
            </div>
            <a
              href="/ejemplo_features_predict.csv"
              download
              className="inline-flex shrink-0 items-center justify-center gap-2 border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Download size={16} />
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
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-accent-500 ${
                dragging
                  ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10"
                  : file
                  ? "border-accent-500/60 bg-accent-50/50 dark:bg-accent-500/5"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              {file ? (
                <FileSpreadsheet size={26} className="text-accent-600 dark:text-accent-400" />
              ) : (
                <UploadCloud size={26} className="text-gray-400 dark:text-gray-500" />
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
              className="inline-flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm transition-colors hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black sm:w-auto"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {loading ? "Ejecutando modelo..." : "Ejecutar modelo"}
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

function ResultsTable({ results }) {
  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800">
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
                <td className="whitespace-nowrap px-4 py-3 text-right font-sora text-base font-bold tabular-nums">
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
    borderRadius: 0,
    enableAnimation: loading,
  };

  return (
    <div
      aria-hidden="true"
      className="results-skeleton border border-dashed border-gray-300 dark:border-gray-700"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-3.5 ${
            i > 0 ? "border-t border-dashed border-gray-200 dark:border-gray-800" : ""
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
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center bg-accent-500 text-sm font-semibold text-accent-contrast">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}
