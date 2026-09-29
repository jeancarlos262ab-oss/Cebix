import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import ParcelRow from "../components/dashboard/ParcelRow";
import UploadDropzone from "../components/dashboard/UploadDropzone";
import Pagination from "../components/ui/Pagination";
import usePagination from "../hooks/usePagination";
import ParcelFormModal from "../components/dashboard/ParcelFormModal";
import { useParcels } from "../context/ParcelsContext";
import { exportParcelsCSV } from "../utils/csv";

const COLUMNS = ["Parcela", "Rendimiento", "Elegibilidad", "NDVI", "Municipio", ""];
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

  // Solo se pintan las filas de la página actual (el mapa y el resumen sí
  // siguen usando la lista completa filtrada).
  const tableRef = useRef(null);
  const { pageItems, reset: resetPage, paginationProps } = usePagination(filtered, {
    scrollRef: tableRef,
  });

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
      resetPage();
      setSearchParams(r === "Todas" ? {} : { region: r });
    },
    [setSearchParams, resetPage]
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
              className="flex items-center gap-1.5 border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Download size={15} />
              Exportar
            </button>
            <button
              type="button"
              onClick={() => setModal("add")}
              className="flex items-center gap-1.5 bg-accent-500 px-3 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filtrar por región</h2>
          <div className="mt-3 flex flex-col" role="group" aria-label="Región">
            {REGION_FILTERS.map((r) => {
              const active = region === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleRegionChange(r)}
                  className={[
                    "relative px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500",
                    active
                      ? "bg-gray-100 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                      : "font-medium text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-500" aria-hidden="true" />
                  )}
                  {r}
                </button>
              );
            })}
          </div>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-base font-semibold text-gray-900 dark:text-gray-100">
            Resumen de elegibilidad
          </h3>
          <dl className="mt-4 space-y-3.5 text-sm">
            {riskCounts.map((r) => {
              const share = filtered.length ? (r.count / filtered.length) * 100 : 0;
              return (
                <div key={r.key}>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </dt>
                    <dd className="font-sora text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {r.count}
                    </dd>
                  </div>
                  <div className="mt-1.5 h-1 w-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
                    <div className="h-full" style={{ width: `${share}%`, backgroundColor: r.color }} />
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-base font-semibold text-gray-900 dark:text-gray-100">
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

          <div ref={tableRef} className="px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8">
            <div className="overflow-x-auto border border-gray-200 shadow-card dark:border-gray-800">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
                    {COLUMNS.map((col, i) => (
                      <th key={col || i} className={`py-3 pr-4 font-medium ${i === 0 ? "pl-3" : ""}`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((parcel) => (
                    <ParcelRow
                      key={parcel.id}
                      parcel={parcel}
                      onEdit={parcel.isCustom ? () => setModal(parcel) : undefined}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...paginationProps} className="mt-4" />
          </div>
        </div>
      </div>

      {modal && (
        <ParcelFormModal
          parcel={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSubmit={(fields) => {
            if (modal === "add") {
              addParcel(fields);
              toast.success("Parcela agregada.");
            } else {
              updateParcel(modal.id, fields);
              toast.success("Parcela actualizada.");
            }
          }}
        />
      )}
    </>
  );
}
