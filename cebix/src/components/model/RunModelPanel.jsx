import { useState } from "react";
import { Download, Play, Upload } from "lucide-react";
import LiquidOrbLoader from "./LiquidOrbLoader";

const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Ejecuta el modelo REAL (Random Forest, top-10 SHAP, sin Planet) en el backend de
 * inferencia (ver /backend). Sube un CSV con las 10 features y muestra la predicción
 * calculada en ese momento -- no son resultados guardados.
 */
export default function RunModelPanel() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
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
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "No se pudo conectar al backend. Si está en Render/Railway con plan gratuito puede tardar ~30 s en despertar; intenta de nuevo."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    // Espaciado reservado para el orb flotante: a la derecha en pantallas
    // medianas+ (pr) y abajo en móvil (pb), así nunca tapa la tabla ni los pasos.
    <div className="pb-64 md:pb-8 md:pr-56">
      {/* Orb fijo en la esquina inferior derecha; no captura clics. */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-30 w-44">
        <LiquidOrbLoader
          size={176}
          running={loading}
          label={loading ? "Ejecutando modelo…" : "Modelo en espera"}
        />
      </div>

      <div className="max-w-4xl space-y-8">
        <Step n={1} title="Prepara tu archivo" description="El CSV necesita las columnas ID_POLIGONO, Estado (Hidalgo, Puebla o Tlaxcala) y las 10 features del modelo.">
          <a
            href="/ejemplo_features_predict.csv"
            download
            className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download size={16} />
            Descargar CSV de ejemplo
          </a>
        </Step>

        <Step n={2} title="Sube y ejecuta" description="El backend corre el Random Forest entrenado en ese momento; no son resultados guardados.">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-w-0 max-w-full cursor-pointer items-center gap-2 border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              <Upload size={16} className="shrink-0" />
              <span className="truncate">{file ? file.name : "Elegir archivo CSV"}</span>
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              disabled={!file || loading}
              className="inline-flex items-center gap-2 bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-600 disabled:opacity-40"
            >
              <Play size={16} />
              {loading ? "Ejecutando modelo..." : "Ejecutar modelo"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Step>

        <Step
          n={3}
          title="Resultados"
          description={
            loading
              ? "El backend está corriendo el Random Forest sobre tu CSV…"
              : results
              ? `${results.length} parcelas procesadas en vivo por el modelo.`
              : "Aquí aparecerán las predicciones cuando ejecutes el modelo."
          }
        >
          {results && (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-800">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    <th className="px-4 py-2 font-medium">Parcela</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Rendimiento (t/ha)</th>
                    <th className="px-4 py-2 font-medium">IC 90%</th>
                    <th className="px-4 py-2 font-medium">± RMSE</th>
                    <th className="px-4 py-2 font-medium">Variable de mayor impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.ID_POLIGONO}
                      className="border-t border-gray-100 text-gray-900 dark:border-gray-800 dark:text-gray-100"
                    >
                      <td className="px-4 py-2 font-medium">{r.ID_POLIGONO}</td>
                      <td className="px-4 py-2">{r.Estado}</td>
                      <td className="px-4 py-2 font-sora font-bold">{r.yieldEstimate}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                        {r.ic90_inferior} – {r.ic90_superior}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.confidence}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                        {r.shap[0]?.feature} ({r.shap[0]?.direction})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Step>
      </div>
    </div>
  );
}

function Step({ n, title, description, children }) {
  return (
    <section className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-accent-500 text-sm font-semibold text-accent-contrast">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}
