import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchModelInfo, friendlyError } from "../services/modelApi";

const ModelInfoContext = createContext(null);

export function ModelInfoProvider({ children }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ctlRef = useRef(null);

  // Cada llamada cancela la anterior: si Render estaba dormido y la petición se
  // quedó colgada, "reintentar" empieza una nueva en vez de esperar a la vieja.
  const load = useCallback(async () => {
    ctlRef.current?.abort();
    const controller = new AbortController();
    ctlRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModelInfo(controller.signal);
      if (controller.signal.aborted) return;
      setInfo(data);
    } catch (err) {
      if (controller.signal.aborted || err?.name === "AbortError") return;
      setError(friendlyError(err));
    } finally {
      if (ctlRef.current === controller) {
        ctlRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    const controller = ctlRef.current;
    if (!controller) return;
    controller.abort();
    ctlRef.current = null;
    setLoading(false);
    setError("Cancelaste la carga. Pulsa «Reintentar» para volver a pedirla.");
  }, []);

  useEffect(() => {
    load();
    return () => ctlRef.current?.abort();
  }, [load]);

  const value = useMemo(() => ({ info, loading, error, reload: load, cancel }), [info, loading, error, load, cancel]);
  return <ModelInfoContext.Provider value={value}>{children}</ModelInfoContext.Provider>;
}

export function useModelInfo() {
  const ctx = useContext(ModelInfoContext);
  if (!ctx) throw new Error("useModelInfo debe usarse dentro de <ModelInfoProvider>");
  return ctx;
}