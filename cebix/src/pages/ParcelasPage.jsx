import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import ParcelRow from "../components/dashboard/ParcelRow";
import UploadDropzone from "../components/dashboard/UploadDropzone";
import Pagination from "../components/ui/Pagination";
import FullscreenLink from "../components/ui/FullscreenLink";
import usePagination from "../hooks/usePagination";
import ParcelFormModal from "../components/dashboard/ParcelFormModal";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { exportParcelsCSV } from "../utils/csv";
import { RISK_COLORS } from "../utils/riskColors";
import { EmptyAnalysis } from "../components/ui/RequireAnalysis";
import useParcelActions from "../hooks/useParcelActions";

const COLUMNS = ["Parcela", "Rendimiento", "Elegibilidad", "NDVI", "Municipio", ""];
const REGION_FILTERS = ["Todas", "Hidalgo", "Tlaxcala", "Puebla"];

const RISK_SUMMARY = [
  { key: "green", color: RISK_COLORS.green, label: "Elegibles" },
  { key: "yellow", color: RISK_COLORS.yellow, label: "Revisión manual" },
  { key: "red", color: RISK_COLORS.red, label: "Alto riesgo" },
];

function ParcelasPageContent() {
  const { parcels } = useParcels();
  const { saveParcel, importParcels } = useParcelActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const regionParam = searchParams.get("region");
  const [region, setRegion] = useState(
    REGION_FILTERS.includes(regionParam) ? regionParam : "Todas"
  );
  const riskParam = searchParams.get("risk");
  const [risk, setRisk] = useState(RISK_SUMMARY.some((r) => r.key === riskParam) ? riskParam : "all");
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // null | "add" | parcel

  // Primero se filtra por región; los conteos de elegibilidad se calculan sobre esa lista para que
  // los botones de riesgo sigan mostrando cuántas hay en cada nivel aunque haya uno seleccionado.
  const regionFiltered = useMemo(
    () => (region === "Todas" ? parcels : parcels.filter((p) => p.region === region)),
    [region, parcels]
  );
  const filtered = useMemo(
    () => (risk === "all" ? regionFiltered : regionFiltered.filter((p) => p.riskColor === risk)),
    [risk, regionFiltered]
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
        count: regionFiltered.filter((p) => p.riskColor === r.key).length,
      })),
    [regionFiltered]
  );

  // Cuántas parcelas hay en cada región (sobre la lista completa, no la filtrada).
  const regionCounts = useMemo(
    () =>
      Object.fromEntries(
        REGION_FILTERS.map((r) => [r, r === "Todas" ? parcels.length : parcels.filter((p) => p.region === r).length])
      ),
    [parcels]
  );

  // La región y el nivel de riesgo viajan en la URL (?region=...&risk=...).
  const syncParams = useCallback(
    (nextRegion, nextRisk) => {
      const params = {};
      if (nextRegion !== "Todas") params.region = nextRegion;
      if (nextRisk !== "all") params.risk = nextRisk;
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const handleRegionChange = useCallback(
    (r) => {
      setRegion(r);
      resetPage();
      syncParams(r, risk);
    },
    [syncParams, resetPage, risk]
  );

  // Tocar el nivel que ya está activo vuelve a mostrar todos.
  const handleRiskChange = useCallback(
    (key) => {
      const next = key === risk ? "all" : key;
      setRisk(next);
      resetPage();
      syncParams(region, next);
    },
    [syncParams, resetPage, risk, region]
  );

  return (
    <>
      <TopBar
        title="Parcelas"
        subtitle={`${filtered.length} parcela${filtered.length === 1 ? "" : "s"} en tu cuenta.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportParcelsCSV(filtered, `cebix-parcelas-${region.toLowerCase()}${risk === "all" ? "" : `-${risk}`}.csv`)}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Download size={15} className="text-accent-600 dark:text-accent-400" />
              Exportar
            </button>
            <button
              type="button"
              onClick={() => setModal("add")}
              className="flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-accent-contrast shadow-xs transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            >
              <Plus size={15} />
              Agregar parcela
            </button>
          </div>
        }
      />

      <div className="mt-6" aria-hidden="true" />

      {parcels.length === 0 ? (
        <EmptyAnalysis onAdd={() => setModal("add")} />
      ) : (
      <div className="grid grid-cols-1 items-start gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        {/* En escritorio aside y contenido se "aplanan" (lg:contents) para que el mapa
            comparta fila con el recuadro de filtro y tenga exactamente su altura. */}
        <aside className="min-w-0 space-y-10 lg:contents lg:space-y-0">
          <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:col-start-1 lg:row-start-1">
            <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">Filtrar por región</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Muestra solo las parcelas de una región.
            </p>
            <div className="mt-4 flex flex-col gap-1.5" role="group" aria-label="Región">
              {REGION_FILTERS.map((r) => {
                const active = region === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleRegionChange(r)}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-full px-4 py-2 text-left text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500",
                      active
                        ? "bg-accent-500 text-accent-contrast shadow-xs"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    {r}
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        active ? "opacity-80" : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {regionCounts[r]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
          <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
                Elegibilidad
              </h3>
              {risk !== "all" && (
                <button
                  type="button"
                  onClick={() => handleRiskChange("all")}
                  className="rounded-sm text-xs font-medium text-accent-600 hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400"
                >
                  Quitar filtro
                </button>
              )}
            </div>

            {/* Distribución de un vistazo; al filtrar, los demás niveles se atenúan. */}
            <div className="mt-4 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
              {riskCounts.map((r) => (
                <div
                  key={r.key}
                  className="h-full transition-opacity"
                  style={{
                    flexGrow: r.count,
                    backgroundColor: r.color,
                    opacity: risk === "all" || risk === r.key ? 1 : 0.2,
                  }}
                />
              ))}
            </div>

            <div className="-mx-2 mt-3 flex flex-col" role="group" aria-label="Filtrar por elegibilidad">
              {riskCounts.map((r) => {
                const active = risk === r.key;
                const share = regionFiltered.length ? Math.round((r.count / regionFiltered.length) * 100) : 0;
                const empty = r.count === 0 && !active;
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={active}
                    disabled={empty}
                    onClick={() => handleRiskChange(r.key)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500",
                      active
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    <span
                      className={`flex-1 truncate ${
                        active
                          ? "font-semibold text-gray-900 dark:text-gray-100"
                          : "font-medium text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {r.label}
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500">{share}%</span>
                    <span className="w-7 text-right font-display text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {r.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
              Registrar nueva parcela
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Sube un CSV con NDVI, precipitación y GDD ya calculados, o captúralos a mano.
            </p>
            <div className="mt-3">
              <UploadDropzone onParsed={importParcels} />
            </div>
          </section>
          </div>
        </aside>

        {/* Contenido principal: mapa y tabla */}
        <div className="min-w-0 space-y-10 lg:contents lg:space-y-0">
          {/* Móvil: alto fijo. Escritorio: llena la fila y mide lo mismo que "Filtrar por región". */}
          <div className="relative h-72 min-w-0 lg:col-start-2 lg:row-start-1 lg:h-auto lg:self-stretch">
            {/* En escritorio el mapa va en posición absoluta: no aporta altura a la fila,
                así que mide exactamente lo mismo que "Filtrar por región". */}
            <div className="absolute inset-0">
              <ParcelMap
                parcels={filtered.filter(hasCoords)}
                selectedId={selectedId}
                onSelect={setSelectedId}
                height="100%"
                rounded
                controlsOrientation="horizontal"
              />
            </div>
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
                Listado de parcelas
              </h3>
              <FullscreenLink to={region === "Todas" ? "/parcelas/historial" : `/parcelas/historial?region=${region}`} />
            </div>
            <div ref={tableRef}>
              <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      {COLUMNS.map((col, i) => (
                        <th key={col || i} className={`py-3 pr-4 font-medium ${i === 0 ? "pl-3" : ""}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          Ninguna parcela coincide con los filtros elegidos.
                        </td>
                      </tr>
                    )}
                    {pageItems.map((parcel) => (
                      <ParcelRow
                        key={parcel.id}
                        parcel={parcel}
                        onEdit={() => setModal(parcel)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...paginationProps} className="mt-4" />
            </div>
          </div>
        </div>
      </div>
      )}

      {modal && (
        <ParcelFormModal
          parcel={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSubmit={(fields) => saveParcel(modal === "add" ? null : modal, fields)}
        />
      )}
    </>
  );
}

export default ParcelasPageContent;
