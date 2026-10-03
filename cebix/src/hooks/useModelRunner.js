import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useParcels } from "../context/ParcelsContext";

export const API_URL = (import.meta.env.VITE_MODEL_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const EXAMPLE_CSV_URL = "/ejemplo_features_predict.csv";

/** Llama al backend REAL (/predict-csv). Devuelve { predicciones }. */
export async function predictCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/predict-csv`, { method: "POST", body: formData });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === "string" ? detail.detail : `El backend respondió ${res.status}`);
  }
  return res.json();
}

/** Descarga el CSV de ejemplo (59 parcelas de evaluación) como un File listo para enviar. */
export async function fetchExampleFile() {
  const res = await fetch(EXAMPLE_CSV_URL);
  if (!res.ok) throw new Error("No se pudo cargar el archivo de ejemplo.");
  const blob = await res.blob();
  return new File([blob], "ejemplo_features_predict.csv", { type: "text/csv" });
}

export function friendlyError(err) {
  return err.message === "Failed to fetch"
    ? "No se pudo conectar al backend. Si está en Render/Railway con plan gratuito puede tardar ~30 s en despertar; intenta de nuevo."
    : err.message;
}

/**
 * Ejecuta el modelo sobre un File y guarda el resultado en el contexto, de modo que
 * Resumen, Parcelas, Mapa, Predicciones y SHAP muestren lo que el modelo acaba de calcular.
 */
export function useModelRunner() {
  const { loadAnalysis } = useParcels();
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (file, { minMs = 0 } = {}) => {
      setLoading(true);
      try {
        const sleep = new Promise((r) => setTimeout(r, minMs));
        const [data, csvText] = await Promise.all([predictCsv(file), file.text(), sleep]).then(
          ([d, text]) => [d, text]
        );
        loadAnalysis(data.predicciones, csvText, file.name);
        toast.success(
          `Modelo ejecutado: ${data.predicciones.length} parcela${data.predicciones.length === 1 ? "" : "s"} procesada${data.predicciones.length === 1 ? "" : "s"}.`
        );
        return data.predicciones;
      } catch (err) {
        toast.error(friendlyError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadAnalysis]
  );

  const runExample = useCallback(async () => {
    try {
      const file = await fetchExampleFile();
      return run(file);
    } catch (err) {
      toast.error(friendlyError(err));
      return null;
    }
  }, [run]);

  return { run, runExample, loading };
}
