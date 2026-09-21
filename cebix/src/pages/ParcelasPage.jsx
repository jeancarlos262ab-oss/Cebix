import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import ParcelRow from "../components/dashboard/ParcelRow";
import UploadDropzone from "../components/dashboard/UploadDropzone";
import ParcelFormModal from "../components/dashboard/ParcelFormModal";
import { useParcels } from "../context/ParcelsContext";
import { exportParcelsCSV } from "../utils/csv";

const COLUMNS = ["Parcela", "Rendimiento", "Elegibilidad", "Municipio", ""];
const REGION_FILTERS = ["Todas", "Hidalgo", "Tlaxcala", "Puebla"];

const RISK_SUMMARY = [
  { key: "green", color: "#16A34A", label: "Elegibles" },
  { key: "yellow", color: "#D97706", label: "Revisión manual" },
  { key: "red", color: "#DC2626", label: "Alto riesgo" },
];

export default function ParcelasPage() {
  const { parcels, addParcel, updateParcel } = useParcels();
  const [searchParams, setSearchParams] = useSearchParams();
  const regionParam = searchParams.get("region");
  const [region, setRegion] = useState(
    REGION_FILTERS.includes(regionParam) ? regionParam : "Todas"
  );
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // null | "add" | parcel

  const filtered = useMemo(
    () => (region === "Todas" ? parcels : parcels.filter((p) => p.region === region)),
    [region, parcels]
  );

  const riskCounts = useMemo(
    () =>
      RISK_SUMMARY.map((r) => ({
        ...r,
        count: filtered.filter((p) => p.riskColor === r.key).length,
      })),
    [filtered]
  );

  const handleRegionChange = useCallback(
    (r) => {
      setRegion(r);
      setSearchParams(r === "Todas" ? {} : { region: r });
    },
    [setSearchParams]
  );

  return (
    <>
      <TopBar
        title="Parcelas"
        subtitle={`${filtered.length} parcelas registradas en el reto AgroCebada.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportParcelsCSV(filtered, `cebix-parcelas-${region.toLowerCase()}.csv`)}
              className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Download size={15} />
              Exportar
            </button>
            <button
              type="button"
              onClick={() => setModal("add")}
              className="flex items-center gap-1.5 bg-accent-500 px-3 py-2 text-sm font-medium text-accent-contrast shadow-sm hover:bg-accent-600"
            >
              <Plus size={15} />
              Agregar parcela
            </button>
          </div>
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1px_1fr]">
        {/* Rail izquierdo: filtros, resumen de riesgo y alta de parcelas */}
        <aside className="bg-white px-4 py-6 dark:bg-black sm:px-6 lg:pl-8 lg:pr-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filtrar por región</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {REGION_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRegionChange(r)}
                className={[
                  " px-3 py-2 text-left text-sm font-medium transition-colors",
                  region === r
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Resumen de elegibilidad
          </h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            {riskCounts.map((r) => (
              <div key={r.key} className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
                  {r.label}
                </dt>
                <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{r.count}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Registrar nueva parcela
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Sube un CSV con NDVI, precipitación y GDD ya calculados, o captúralos a mano.
          </p>
          <div className="mt-3">
            <UploadDropzone onParsed={(records) => records.forEach((r) => addParcel(r))} />
          </div>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Contenido principal: mapa pegado a las líneas y a la ventana + tabla */}
        <div className="min-w-0">
          <ParcelMap
            parcels={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            height={380}
            bordered={false}
          />

          <div className="h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <div className="overflow-x-auto px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-400 dark:text-gray-500">
                  {COLUMNS.map((col) => (
                    <th key={col} className="pb-2 pr-4 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((parcel) => (
                  <ParcelRow
                    key={parcel.id}
                    parcel={parcel}
                    onEdit={parcel.isCustom ? () => setModal(parcel) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <ParcelFormModal
          parcel={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSubmit={(fields) => (modal === "add" ? addParcel(fields) : updateParcel(modal.id, fields))}
        />
      )}
    </>
  );
}
