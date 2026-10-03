import { Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { useModelInfo } from "../../context/ModelInfoContext";

/**
 * Muestra su contenido cuando el backend ya entregó la información del modelo
 * (GET /model-info); mientras tanto, un indicador de carga, y si falla, el error con reintento.
 */
export default function RequireModelInfo({ children }) {
  const { info, loading, error, reload } = useModelInfo();
  if (info) return children;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center text-sm text-gray-500 dark:text-gray-400">
        <Loader2 size={22} className="animate-spin text-accent-500" />
        Cargando información del modelo desde el backend…
        <span className="text-xs text-gray-400">Si está en plan gratuito puede tardar ~30 s en despertar.</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <ServerCrash size={24} className="text-gray-400" />
      <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
      <button
        type="button"
        onClick={reload}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <RefreshCw size={14} /> Reintentar
      </button>
    </div>
  );
}
