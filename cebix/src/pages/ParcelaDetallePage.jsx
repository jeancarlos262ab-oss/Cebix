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
              className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={15} className="text-accent-600 dark:text-accent-400" />
              Todas las parcelas
            </Link>
            <button
              type="button"
              onClick={() => setDialog("edit")}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Pencil size={15} className="text-accent-600 dark:text-accent-400" />
              Editar
            </button>
            <button
              type="button"
              onClick={() => setDialog("delete")}
              className="flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 dark:border-red-500/30 dark:bg-black dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 size={15} />
              Eliminar
            </button>
          </div>
        }
      />

      <div className="mt-6" aria-hidden="true" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_360px]">
        <div className="min-w-0">
          {hasCoords(parcel) ? (
            <ParcelMap
              parcels={[parcel]}
              height={320}
              center={[parcel.lat, parcel.lng]}
              zoom={17}
              showLegend={false}
              showBoundariesByDefault={false}
            />
          ) : (
            <div className="flex h-40 items-center justify-center bg-gray-50 px-4 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              Este CSV no incluye coordenadas (lat, lng): la parcela no se puede ubicar en el mapa.
            </div>
          )}

          <div className="px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8">
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className="py-4 sm:pr-4">
              <StatCard label="NDVI pico" value={parcel.ndvi.toFixed(2)} icon={Leaf} tone="brand" />
            </div>
            <div className="py-4 sm:px-4">
              <StatCard
                label="Precipitación"
                value={`${parcel.precip} mm`}
                icon={Droplets}
                tone="navy"
              />
            </div>
            <div className="py-4 sm:pl-4">
              <StatCard label="GDD acumulados" value={parcel.gdd} icon={Sun} tone="brand" />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Rendimiento estimado</h2>
            <div className="mt-4">
              <ConfidenceRange estimate={parcel.yieldEstimate} confidence={parcel.confidence} />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">
              Por qué el modelo predijo esto (SHAP local)
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Contribución de cada variable al rendimiento estimado de esta parcela.
            </p>
            <div className="mt-4">
              <FeatureImportanceChart data={parcel.shap} height={200} />
            </div>
          </div>
          </div>
        </div>

        <div className="hidden lg:block" aria-hidden="true" />

        <div className="px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8">
          <Semaphore score={parcel.score} />

          <div className="mt-6">
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Ficha de la parcela</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Superficie</dt>
                <dd className="font-display font-bold text-gray-900 dark:text-gray-100">{parcel.area}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Municipio</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.municipio}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Región</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.region}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">EVI</dt>
                <dd className="font-display font-bold text-gray-900 dark:text-gray-100">{parcel.evi.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Coordenadas</dt>
                <dd className="font-display font-bold text-gray-900 dark:text-gray-100">
                  {hasCoords(parcel) ? `${parcel.lat.toFixed(3)}, ${parcel.lng.toFixed(3)}` : "—"}
                </dd>
              </div>
              {submittedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Enviado a comité</dt>
                  <dd className="font-medium text-ndvi-600 dark:text-ndvi-400">
                    {new Date(submittedAt).toLocaleDateString("es-MX")}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <button
            type="button"
            onClick={() => {
              generateCreditReportPDF(parcel, { submitted: Boolean(submittedAt), modelSummary: info?.modelSummary });
              toast.success("Reporte PDF generado.");
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-600"
          >
            <FileDown size={15} />
            Generar reporte de crédito
          </button>
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
