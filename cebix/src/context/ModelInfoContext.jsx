import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchModelInfo, friendlyError } from "../services/modelApi";

const ModelInfoContext = createContext(null);

/**
 * Carga una sola vez, desde el backend (GET /model-info), todo lo que describe al modelo:
 * métricas de validación, comparación de algoritmos, importancia SHAP global, preguntas guía...
 * Si el backend está dormido (plan gratuito) reintenta con `reload`.
 */
export function ModelInfoProvider({ children }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await fetchModelInfo());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(() => ({ info, loading, error, reload: load }), [info, loading, error, load]);
  return <ModelInfoContext.Provider value={value}>{children}</ModelInfoContext.Provider>;
}

export function useModelInfo() {
  const ctx = useContext(ModelInfoContext);
  if (!ctx) throw new Error("useModelInfo debe usarse dentro de <ModelInfoProvider>");
  return ctx;
}
