import { Link } from "react-router-dom";
import { Download, FlaskConical, Loader2, Plus, Upload } from "lucide-react";
import TopBar from "../layout/TopBar";
import { useParcels } from "../../context/ParcelsContext";
import { useModelRunner, EXAMPLE_CSV_URL } from "../../hooks/useModelRunner";

/**
 * Las pantallas de resultados no traen datos precargados: se llenan con lo que el
 * modelo calcula. Si todavía no se ha ejecutado, aquí se ofrece correrlo con el
 * archivo de ejemplo (un clic) o subir un CSV propio en la pantalla Modelo.
 */
export function EmptyAnalysis({ title, subtitle, onAdd }) {
  const { runExample, loading } = useModelRunner();

  return (
    <>
      {title && <TopBar title={title} subtitle={subtitle} />}
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
          <FlaskConical size={22} />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
          Aún no hay resultados del modelo
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Esta pantalla se llena con las predicciones que calcula el modelo en el momento. Carga el archivo de
          ejemplo del backend o sube tu propio CSV con las variables del modelo.
        </p>

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row">
          <button
            type="button"
            onClick={runExample}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
            {loading ? "Ejecutando modelo…" : "Ejecutar con archivo de ejemplo"}
          </button>
          <Link
            to="/modelo?tab=ejecutar"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Upload size={16} className="text-accent-600 dark:text-accent-400" />
            Subir mi CSV
          </Link>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Plus size={16} className="text-accent-600 dark:text-accent-400" />
              Agregar parcela manualmente
            </button>
          )}
        </div>

        <a
          href={EXAMPLE_CSV_URL}
          download
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
        >
          <Download size={13} />
          Descargar el archivo de ejemplo
        </a>
        {loading && (
          <p className="mt-3 text-xs text-gray-400">
            Si el backend está en plan gratuito puede tardar ~30 s en despertar la primera vez.
          </p>
        )}
      </div>
    </>
  );
}

/** Envuelve el contenido de una pantalla: muestra el estado vacío hasta que haya resultados. */
export default function RequireAnalysis({ title, subtitle, children }) {
  const { parcels } = useParcels();
  if (parcels.length === 0) return <EmptyAnalysis title={title} subtitle={subtitle} />;
  return children;
}
