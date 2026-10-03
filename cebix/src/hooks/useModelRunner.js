import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useParcels } from "../context/ParcelsContext";

import { API_URL, EXAMPLE_CSV_URL, fetchExampleFile, friendlyError, predictCsv } from "../services/modelApi";

// Re-exportados para los componentes que ya los importaban desde aquí.
export { API_URL, EXAMPLE_CSV_URL, fetchExampleFile, friendlyError, predictCsv };

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
