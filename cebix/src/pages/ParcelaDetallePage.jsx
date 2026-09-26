import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import Semaphore from "../components/ui/Semaphore";
import StatCard from "../components/ui/StatCard";
import ConfidenceRange from "../components/charts/ConfidenceRange";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import { useParcels } from "../context/ParcelsContext";
import { generateCreditReportPDF } from "../utils/creditReport";
import { Droplets, Leaf, Sun } from "lucide-react";

export default function ParcelaDetallePage() {
  const { id } = useParams();
  const { parcels, submissions } = useParcels();
  const parcel = parcels.find((p) => String(p.id) === id);

  if (!parcel) {
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
          <Link
            to="/parcelas"
            className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={15} />
            Todas las parcelas
          </Link>
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_360px]">
        <div className="min-w-0">
          <ParcelMap
            parcels={[parcel]}
            height={320}
            center={[parcel.lat, parcel.lng]}
            zoom={17}
            showLegend={false}
            showBoundariesByDefault={false}
            bordered={false}
          />

          <div className="h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <div className="px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8">
          <div className="grid grid-cols-1 divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-4 sm:pr-4">
              <StatCard label="NDVI pico" value={parcel.ndvi.toFixed(2)} icon={Leaf} tone="ndvi" />
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

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Rendimiento estimado</h2>
            <div className="mt-4">
              <ConfidenceRange estimate={parcel.yieldEstimate} confidence={parcel.confidence} />
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        <div className="border-t border-gray-200 px-4 py-6 dark:border-gray-800 sm:px-6 lg:border-t-0 lg:pl-8 lg:pr-8">
          <Semaphore score={parcel.score} />

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ficha de la parcela</h2>
            <div className="mt-3 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Superficie</dt>
                <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{parcel.area}</dd>
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
                <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{parcel.evi.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Coordenadas</dt>
                <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">
                  {parcel.lat.toFixed(3)}, {parcel.lng.toFixed(3)}
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
            onClick={() => generateCreditReportPDF(parcel, { submitted: Boolean(submittedAt) })}
            className="mt-6 flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-600"
          >
            <FileDown size={15} />
            Generar reporte de crédito
          </button>
        </div>
      </div>
    </>
  );
}
