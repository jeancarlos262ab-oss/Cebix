import { useEffect, useState } from "react";
import { RefreshCw, ServerCrash, X } from "lucide-react";
import { PageBodySkeleton, RouteSkeleton } from "./PageSkeleton";
import SlowHint from "./SlowHint";
import { useModelInfo } from "../../context/ModelInfoContext";

const BTN =
  "inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

export default function RequireModelInfo({ children, skeleton = "modeloTab", withBar = false }) {
  const { info, loading, error, reload, cancel } = useModelInfo();
  if (info) return children;

  if (loading) {
    return (
      <>
        {withBar ? <RouteSkeleton page={skeleton} /> : <PageBodySkeleton page={skeleton} />}
        <LoadingActions onCancel={cancel} />
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <ServerCrash size={24} className="text-gray-400" />
      <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
      <button type="button" onClick={reload} className={BTN}>
        <RefreshCw size={14} /> Reintentar
      </button>
    </div>
  );
}

// Botón de cancelar + aviso, fijos abajo mientras se carga (el servidor puede estar despertando).
function LoadingActions({ onCancel }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-lg dark:border-gray-800 dark:bg-black">
        <button type="button" onClick={onCancel} className={BTN}>
          <X size={14} /> Cancelar cálculo
        </button>
        {slow && <SlowHint className="text-left" />}
      </div>
    </div>
  );
}
