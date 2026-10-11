import { Link } from "react-router-dom";
import { ArrowUpRight, Download, FileSpreadsheet, Loader2, Plus } from "lucide-react";
import TopBar from "../layout/TopBar";
import DocumentPeek from "./DocumentPeek";
import UploadDropzone from "../dashboard/UploadDropzone";
import useParcelActions from "../../hooks/useParcelActions";
import { useParcels } from "../../context/ParcelsContext";
import { EXAMPLE_CSV_URL } from "../../hooks/useModelRunner";

const ROW =
  "group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60";

function OptionRow({ icon: Icon, title, description, highlight = false, ...props }) {
  const content = (
    <>
      <Icon
        size={16}
        strokeWidth={1.75}
        className={`shrink-0 ${highlight ? "text-accent-600 dark:text-accent-400" : "text-gray-400 dark:text-gray-500"}`}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-medium ${
            highlight ? "text-accent-600 dark:text-accent-400" : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{description}</span>
      </span>
      <ArrowUpRight size={14} className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600" />
    </>
  );
  if (props.to) return <Link className={ROW} {...props}>{content}</Link>;
  if (props.href) return <a className={ROW} {...props}>{content}</a>;
  return <button type="button" className={ROW} {...props}>{content}</button>;
}

/**
 * Las pantallas de resultados no traen datos precargados: se llenan con lo que se importa o
 * calcula. Mientras no haya parcelas, aquí se ofrece importarlas (el mismo dropzone de la tabla de
 * parcelas), descargar el archivo de ejemplo o ejecutar el modelo con un CSV.
 */
export function EmptyAnalysis({ title, subtitle, onAdd }) {
  const { importParcels } = useParcelActions();
  const { customParcelsLoading } = useParcels();

  // Todavía se están trayendo tus datos de Supabase (p. ej. al entrar desde otra computadora):
  // no se muestra "sin datos" para no dar a entender que la cuenta está vacía.
  if (customParcelsLoading) {
    return (
      <div className="relative flex min-h-full flex-col">
        {title && <TopBar title={title} subtitle={subtitle} />}
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400 dark:text-gray-500" />
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Cargando tus datos…</span>
        </div>
      </div>
    );
  }

  return (
    // Centrado en el área de contenido (el sidebar ocupa su lugar, no flota). Los contenedores
    // van sin fondo y con el mismo borde y redondeo (rounded-2xl) que el resto de la app.
    // En móvil la barra superior ocupa su lugar (arriba) y el contenido se centra en el resto; en
    // escritorio la barra flota y el contenido se centra en toda el área.
    <div className="relative flex min-h-full flex-col lg:flex-row lg:items-center lg:justify-center">
      {title && (
        <div className="lg:absolute lg:inset-x-0 lg:top-0">
          <TopBar title={title} subtitle={subtitle} />
        </div>
      )}
      <div className="mx-auto my-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:py-24">
        <div className="text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Sin datos</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-gray-900 dark:text-gray-100">
            Aún no hay resultados del modelo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Esta sección se llena con las predicciones del modelo. Importa tus parcelas para comenzar: el rendimiento
            estimado, los índices de vegetación y el resto de los indicadores se calculan al importarlas.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <div className="h-full rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Importar parcelas</h3>
              <p className="mt-1 mb-4 text-xs text-gray-500 dark:text-gray-400">
                Con un shapefile, GeoJSON o KML se calcula cada parcela con imágenes de satélite. Con un CSV se usan las
                variables que ya traiga el archivo.
              </p>
              <UploadDropzone onParsed={importParcels} />
            </div>
          </section>

          <section className="relative mt-24 lg:mt-0 lg:col-span-2">
            {/* Documento que asoma por el borde superior del contenedor, a la derecha: solo se ve la
                mitad de arriba (el resto queda recortado a ras del borde). Al aparecer se desliza hacia arriba. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 right-5 h-20 w-24 overflow-hidden"
            >
              <DocumentPeek className="absolute left-0 top-0 h-28 w-24" />
            </div>
            <div className="h-full divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              <p className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Otras opciones
              </p>
              <OptionRow
                icon={Download}
                title="Descargar archivo de ejemplo"
                description="Formato de las variables del modelo."
                href={EXAMPLE_CSV_URL}
                download
                highlight
              />
              <OptionRow
                icon={FileSpreadsheet}
                title="Ejecutar el modelo con un CSV"
                description="Calcula predicciones a partir de las variables."
                to="/modelo?tab=ejecutar"
              />
              {onAdd ? (
                <OptionRow icon={Plus} title="Agregar una parcela" description="Captura los datos a mano." onClick={onAdd} />
              ) : (
                <OptionRow icon={Plus} title="Agregar una parcela" description="Captura los datos a mano en Parcelas." to="/parcelas" />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Envuelve el contenido de una pantalla: muestra el estado vacío hasta que haya resultados. */
export default function RequireAnalysis({ title, subtitle, children }) {
  const { parcels } = useParcels();
  if (parcels.length === 0) return <EmptyAnalysis title={title} subtitle={subtitle} />;
  return children;
}
