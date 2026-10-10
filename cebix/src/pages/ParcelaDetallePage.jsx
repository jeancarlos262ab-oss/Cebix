import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Pencil, Trash2 } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import Semaphore from "../components/ui/Semaphore";
import { Contributions, Label, RangeBar, Row } from "../components/results/ReportParts";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { useModelInfo } from "../context/ModelInfoContext";
import { generateCreditReportPDF } from "../utils/creditReport";
import RequireAnalysis from "../components/ui/RequireAnalysis";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ParcelFormModal from "../components/dashboard/ParcelFormModal";
import useParcelActions from "../hooks/useParcelActions";
import { formatDate, formatNumber as intlNumber } from "../utils/intl";

// Los valores del modelo/CSV pueden traer muchos decimales (p. ej. 512.34567891):
// se redondean para que quepan en el recuadro y se separan los miles.
function formatNumber(value, maxDecimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return intlNumber(n, { maximumFractionDigits: maxDecimals });
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

          {/* Indicadores del ciclo: celdas unidas por una línea fina, sin iconos ni énfasis de color. */}
          <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
            {[
              { label: "NDVI pico", value: parcel.ndvi.toFixed(2), hint: "Máximo del ciclo" },
              { label: "Precipitación", value: `${formatNumber(parcel.precip)} mm`, hint: "Acumulada en el ciclo" },
              { label: "GDD acumulados", value: formatNumber(parcel.gdd), hint: "Grados-día del ciclo" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex min-w-0 flex-1 flex-col justify-center border-b border-gray-200 p-5 last:border-b-0 dark:border-gray-800"
              >
                <Label>{stat.label}</Label>
                <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{stat.hint}</p>
              </div>
            ))}
          </section>

          <Semaphore score={parcel.score} sober />
        </div>

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Columna principal */}
          <div className="min-w-0 space-y-10">
            <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <Label>Rendimiento estimado</Label>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-4xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {parcel.yieldEstimate.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">ton/ha</span>
                <span className="ml-1 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  ± {parcel.confidence.toFixed(1)} (90 % de confianza)
                </span>
              </p>
              <RangeBar estimate={parcel.yieldEstimate} half={parcel.confidence} />
            </section>

            <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <Label>Por qué el modelo predijo esto (SHAP local)</Label>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Contribución de cada variable al rendimiento estimado de esta parcela.
              </p>
              <Contributions data={parcel.shap} />
            </section>
          </div>

          {/* Columna lateral */}
          <aside className="min-w-0 space-y-10">
            <section>
              <Label>Ficha de la parcela</Label>
              <dl className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800/70 dark:border-gray-800">
                <Row label="Superficie">{parcel.area}</Row>
                <Row label="Municipio">{parcel.municipio}</Row>
                <Row label="Región">{parcel.region}</Row>
                <Row label="EVI">{parcel.evi.toFixed(2)}</Row>
                <Row label="Coordenadas">
                  {hasCoords(parcel) ? `${parcel.lat.toFixed(3)}, ${parcel.lng.toFixed(3)}` : "—"}
                </Row>
                {submittedAt && (
                  <Row label="Enviado a comité">
                    <span className="text-ndvi-600 dark:text-ndvi-400">
                      {formatDate(submittedAt)}
                    </span>
                  </Row>
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
