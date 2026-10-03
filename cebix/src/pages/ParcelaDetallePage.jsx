import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Pencil, Trash2 } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import Semaphore from "../components/ui/Semaphore";
import StatCard from "../components/ui/StatCard";
import ConfidenceRange from "../components/charts/ConfidenceRange";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { useModelInfo } from "../context/ModelInfoContext";
import { generateCreditReportPDF } from "../utils/creditReport";
import { Droplets, Leaf, Sun } from "lucide-react";
import RequireAnalysis from "../components/ui/RequireAnalysis";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ParcelFormModal from "../components/dashboard/ParcelFormModal";
import useParcelActions from "../hooks/useParcelActions";

// Los valores del modelo/CSV pueden traer muchos decimales (p. ej. 512.34567891):
// se redondean para que quepan en el recuadro y se separan los miles.
function formatNumber(value, maxDecimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-MX", { maximumFractionDigits: maxDecimals });
}

function ParcelaDetallePageContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { parcels, submissions } = useParcels();
  const { info } = useModelInfo();
  const { saveParcel, deleteParcel } = useParcelActions();
  const [dialog, setDialog] = useState(null); // null | "edit" | "delete"
  const deletingRef = useRef(false); // evita el aviso "no se encontró" mientras se elimina y se navega
  const parcel = parcels.find((p) => String(p.id) === id);

  if (!parcel) {
    if (deletingRef.current) return null;
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">No se encontró esa parcela.</p>
        <Link to="/parcelas" className="mt-2 inline-block text-sm font-medium text-accent-600">
          Volver a Parcelas
        </Link>
      </div>
    );
  }

  const submittedAt = submissions[parcel.id];

  return (
    <>
      <TopBar
        title={parcel.name}
        subtitle={`${parcel.municipio}, ${parcel.region} · ${parcel.area}`}
        hideSearch
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/parcelas"
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={15} className="text-accent-600 dark:text-accent-400" />
              Todas las parcelas
            </Link>
            <button
              type="button"
              onClick={() => setDialog("edit")}
              className="flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-accent-contrast shadow-xs transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            >
              <Pencil size={15} />
              Editar
            </button>
            <button
              type="button"
              onClick={() => setDialog("delete")}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-red-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            >
              <Trash2 size={15} />
              Eliminar
            </button>
          </div>
        }
      />

      <div className="mt-6" aria-hidden="true" />

      <div className="space-y-10 px-4 py-6 sm:px-6 lg:px-8">
        {/* Fila superior: mapa | indicadores | score. En pantalla ancha los tres miden lo mismo
            que el recuadro del score de elegibilidad (el más alto): el mapa va en posición
            absoluta para no aportar altura y los indicadores se reparten el alto disponible. */}
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_230px_360px]">
          <div className="relative h-72 min-w-0 xl:h-auto">
            <div className="absolute inset-0">
              {hasCoords(parcel) ? (
                <ParcelMap
                  parcels={[parcel]}
                  height="100%"
                  center={[parcel.lat, parcel.lng]}
                  zoom={17}
                  basemap="satellite"
                  showLegend={false}
                  showBoundariesByDefault={false}
                  rounded
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 px-4 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                  Este CSV no incluye coordenadas (lat, lng): la parcela no se puede ubicar en el mapa.
                </div>
              )}
            </div>
          </div>

          {/* Mismo diseño que las métricas de Predicciones: celdas unidas por una línea, con el
              icono grande en la esquina inferior derecha (StatCard cornerIcon). */}
          <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
            {[
              { label: "NDVI pico", value: parcel.ndvi.toFixed(2), hint: "Máximo del ciclo", icon: Leaf },
              { label: "Precipitación", value: `${formatNumber(parcel.precip)} mm`, hint: "Acumulada en el ciclo", icon: Droplets },
              { label: "GDD acumulados", value: formatNumber(parcel.gdd), hint: "Grados-día del ciclo", icon: Sun },
            ].map((stat) => (
              <div
                key={stat.label}
                className="relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden border-b border-gray-200 p-5 last:border-b-0 dark:border-gray-800"
              >
                <StatCard {...stat} tone="navy" cornerIcon />
              </div>
            ))}
          </section>

          <Semaphore score={parcel.score} />
        </div>

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Columna principal */}
          <div className="min-w-0 space-y-10">
            <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
                Rendimiento estimado
              </h2>
              <div className="mt-4">
                <ConfidenceRange estimate={parcel.yieldEstimate} confidence={parcel.confidence} />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
                Por qué el modelo predijo esto (SHAP local)
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Contribución de cada variable al rendimiento estimado de esta parcela.
              </p>
              <div className="mt-4">
                <FeatureImportanceChart data={parcel.shap} height={200} />
              </div>
            </section>
          </div>

          {/* Columna lateral */}
          <aside className="min-w-0 space-y-10">
            <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
                Ficha de la parcela
              </h2>
              <dl className="mt-4 space-y-3.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Superficie</dt>
                  <dd className="font-display font-bold text-gray-900 dark:text-gray-100">{parcel.area}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Municipio</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.municipio}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Región</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.region}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">EVI</dt>
                  <dd className="font-display font-bold text-gray-900 dark:text-gray-100">{parcel.evi.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Coordenadas</dt>
                  <dd className="font-display font-bold text-gray-900 dark:text-gray-100">
                    {hasCoords(parcel) ? `${parcel.lat.toFixed(3)}, ${parcel.lng.toFixed(3)}` : "—"}
                  </dd>
                </div>
                {submittedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Enviado a comité</dt>
                    <dd className="font-medium text-ndvi-600 dark:text-ndvi-400">
                      {new Date(submittedAt).toLocaleDateString("es-MX")}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <button
              type="button"
              onClick={() => {
                generateCreditReportPDF(parcel, { submitted: Boolean(submittedAt), modelSummary: info?.modelSummary });
                toast.success("Reporte PDF generado.");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-xs transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            >
              <FileDown size={15} />
              Generar reporte de crédito
            </button>
          </aside>
        </div>
      </div>

      {dialog === "edit" && (
        <ParcelFormModal
          parcel={parcel}
          onClose={() => setDialog(null)}
          onSubmit={(fields) => saveParcel(parcel, fields)}
        />
      )}

      {dialog === "delete" && (
        <ConfirmDialog
          title={`¿Eliminar ${parcel.name}?`}
          description={
            parcel.isCustom
              ? "Se borra de tu cuenta de forma permanente."
              : "Se quita de la corrida actual del modelo. Para recuperarla, vuelve a ejecutar el modelo."
          }
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            deletingRef.current = true;
            const result = await deleteParcel(parcel);
            if (result?.error) deletingRef.current = false;
            else navigate("/parcelas", { replace: true });
            return result;
          }}
        />
      )}
    </>
  );
}

export default function ParcelaDetallePage() {
  return (
    <RequireAnalysis title="Detalle de parcela" >
      <ParcelaDetallePageContent />
    </RequireAnalysis>
  );
}
