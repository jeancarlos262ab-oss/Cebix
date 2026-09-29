import { useState } from "react";
import { toast } from "sonner";
import { Download, Play, Upload } from "lucide-react";
import TopBar from "../components/layout/TopBar";

const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Ejecuta el modelo REAL (Random Forest, top-10 SHAP, sin Planet) en el backend de
 * inferencia (ver /backend). Sube un CSV con las 10 features y muestra la predicción
 * calculada en ese momento -- no son resultados guardados.
 */
export default function EjecutarModeloPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

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
    <>
      <TopBar
        title="Ejecutar modelo"
        subtitle="Corre el modelo real con un CSV de parcelas nuevas y obtén el rendimiento estimado en vivo."
        hideSearch
        actions={
          <a
            href="/ejemplo_features_predict.csv"
            download
            className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download size={16} />
            CSV de ejemplo
          </a>
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          El CSV necesita las columnas <code>ID_POLIGONO</code>, <code>Estado</code> (Hidalgo,
          Puebla o Tlaxcala) y las 10 features del modelo. Descarga el CSV de ejemplo para ver el
          formato exacto. El backend ejecuta el Random Forest entrenado en ese momento.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            <Upload size={16} />
            {file ? file.name : "Elegir archivo CSV"}
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
            className="inline-flex items-center gap-2 bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
          >
            <Play size={16} />
            {loading ? "Ejecutando modelo..." : "Ejecutar modelo"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {results && (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-6">Parcela</th>
                  <th className="py-2 pr-6">Estado</th>
                  <th className="py-2 pr-6">Rendimiento (t/ha)</th>
                  <th className="py-2 pr-6">IC 90%</th>
                  <th className="py-2 pr-6">± RMSE</th>
                  <th className="py-2 pr-6">Variable de mayor impacto</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.ID_POLIGONO}
                    className="border-t border-gray-100 text-gray-900 dark:border-gray-800 dark:text-gray-100"
                  >
                    <td className="py-2 pr-6 font-medium">{r.ID_POLIGONO}</td>
                    <td className="py-2 pr-6">{r.Estado}</td>
                    <td className="py-2 pr-6 font-sora font-bold">{r.yieldEstimate}</td>
                    <td className="py-2 pr-6 text-gray-500 dark:text-gray-400">
                      {r.ic90_inferior} – {r.ic90_superior}
                    </td>
                    <td className="py-2 pr-6 text-gray-500 dark:text-gray-400">{r.confidence}</td>
                    <td className="py-2 pr-6 text-gray-500 dark:text-gray-400">
                      {r.shap[0]?.feature} ({r.shap[0]?.direction})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {results.length} parcelas procesadas en vivo por el modelo.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
