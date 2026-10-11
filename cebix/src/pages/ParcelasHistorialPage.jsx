import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Minus, Pencil, Search, Trash2, X } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination from "../components/ui/Pagination";
import ParcelFormModal from "../components/dashboard/ParcelFormModal";
import usePagination from "../hooks/usePagination";
import useParcelActions from "../hooks/useParcelActions";
import { useParcels } from "../context/ParcelsContext";
import { RISK_COLORS } from "../utils/riskColors";

const REGION_FILTERS = ["Todas", "Hidalgo", "Tlaxcala", "Puebla"];

// Misma rejilla en todas las filas. En pantallas chicas solo caben casilla, parcela y acciones
// (el rendimiento y la elegibilidad pasan a la segunda línea de la parcela).
const ROW_GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 lg:grid-cols-[auto_minmax(0,2fr)_110px_150px_70px_minmax(0,1.2fr)_auto]";

/** Nivel de elegibilidad sobrio: punto plano del color del semáforo y texto neutro. */
function RiskLabel({ label, color }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      <span className="h-2 w-2 shrink-0" style={{ backgroundColor: RISK_COLORS[color] ?? "#9ca3af" }} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Casilla propia (no depende de plugins de formularios). `indeterminate` = selección parcial. */
function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={[
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500",
        on
          ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
          : "border-gray-300 bg-white hover:border-gray-500 dark:border-gray-600 dark:bg-black dark:hover:border-gray-400",
      ].join(" ")}
    >
      {indeterminate ? <Minus size={13} strokeWidth={3} /> : checked ? <Check size={13} strokeWidth={3} /> : null}
    </button>
  );
}

const HistoryRow = memo(function HistoryRow({ parcel, selected, onToggle, onEdit, onDelete }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/parcelas/${parcel.id}`)}
      className={[
        ROW_GRID,
        "group cursor-pointer border-b border-gray-100 px-4 py-3.5 transition-colors last:border-0 dark:border-gray-800/70",
        selected
          ? "bg-gray-50 dark:bg-gray-900/60"
          : "hover:bg-gray-50 dark:hover:bg-gray-900/40",
      ].join(" ")}
    >
      <Checkbox
        checked={selected}
        onChange={() => onToggle(parcel.id)}
        label={`${selected ? "Quitar de la selección" : "Seleccionar"} ${parcel.name}`}
      />

      <div className="flex min-w-0 items-center">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{parcel.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{parcel.area}</span>
            {parcel.polygonId && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="font-mono">{parcel.polygonId}</span>
              </>
            )}
            {/* Solo en pantallas chicas: aquí no hay columnas para estos datos. */}
            <span className="text-gray-300 dark:text-gray-700 lg:hidden">·</span>
            <span className="lg:hidden">{parcel.yieldEstimate.toFixed(1)} ton/ha</span>
            <span className="text-gray-300 dark:text-gray-700 lg:hidden">·</span>
            <span className="lg:hidden">
              <RiskLabel label={parcel.risk} color={parcel.riskColor} />
            </span>
          </p>
        </div>
      </div>

      <p className="hidden text-sm tabular-nums text-gray-900 dark:text-gray-100 lg:block">
        {parcel.yieldEstimate.toFixed(1)}{" "}
        <span className="text-xs text-gray-500 dark:text-gray-400">ton/ha</span>
      </p>

      <div className="hidden items-center justify-between gap-2 pr-4 lg:flex">
        <RiskLabel label={parcel.risk} color={parcel.riskColor} />
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{parcel.score}</span>
      </div>

      <span className="hidden text-sm tabular-nums text-gray-900 dark:text-gray-100 lg:block">{parcel.ndvi.toFixed(2)}</span>

      <div className="hidden min-w-0 lg:block">
        <p className="truncate text-sm text-gray-900 dark:text-gray-100">{parcel.municipio}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{parcel.region}</p>
      </div>

      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          title="Editar parcela"
          aria-label={`Editar ${parcel.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(parcel);
          }}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          title="Eliminar parcela"
          aria-label={`Eliminar ${parcel.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(parcel);
          }}
          className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
        <ChevronRight
          size={15}
          className="text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600"
        />
      </div>
    </div>
  );
});

function ParcelasHistorialContent() {
  const { parcels, customParcelsLoading } = useParcels();
  const { saveParcel, deleteParcel, deleteParcels } = useParcelActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const regionParam = searchParams.get("region");
  const region = REGION_FILTERS.includes(regionParam) ? regionParam : "Todas";

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // parcela que se edita
  const [confirm, setConfirm] = useState(null); // { parcels: [...] } a eliminar

  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter((p) => {
      if (region !== "Todas" && p.region !== region) return false;
      if (!q) return true;
      return [p.name, p.municipio, p.region, p.polygonId, p.area].some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [parcels, region, query]);

  const { pageItems, reset: resetPage, paginationProps } = usePagination(filtered, {
    pageSize: 25,
    scrollRef: listRef,
  });

  const regionCounts = useMemo(
    () =>
      Object.fromEntries(
        REGION_FILTERS.map((r) => [r, r === "Todas" ? parcels.length : parcels.filter((p) => p.region === r).length])
      ),
    [parcels]
  );

  // Solo cuenta (y borra) lo que se está viendo con el filtro actual: así nunca se elimina
  // algo seleccionado antes que ya no aparece en pantalla.
  const selectedParcels = useMemo(() => filtered.filter((p) => selected.has(p.id)), [filtered, selected]);
  const allSelected = filtered.length > 0 && selectedParcels.length === filtered.length;
  const someSelected = selectedParcels.length > 0 && !allSelected;

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  }, [allSelected, filtered]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const forgetDeleted = useCallback((list) => {
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((p) => next.delete(p.id));
      return next;
    });
  }, []);

  const handleRegion = (r) => {
    setSearchParams(r === "Todas" ? {} : { region: r }, { replace: true });
    resetPage();
  };

  const askDeleteOne = useCallback((parcel) => setConfirm({ parcels: [parcel] }), []);

  if (parcels.length === 0) {
    if (customParcelsLoading) {
      return (
        <>
          <TopBar title="Todas las parcelas" hideSearch />
          <p className="px-4 py-20 text-center text-sm text-gray-500 dark:text-gray-400">Cargando tus datos…</p>
        </>
      );
    }
    return (
      <>
        <TopBar title="Todas las parcelas" hideSearch />
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Ya no queda ninguna parcela en tu cuenta.</p>
          <Link to="/parcelas" className="mt-3 text-sm font-medium text-accent-600 hover:underline dark:text-accent-400">
            Volver a Parcelas
          </Link>
        </div>
      </>
    );
  }

  const count = selectedParcels.length;
  const toDelete = confirm?.parcels ?? [];
  const customCount = toDelete.filter((p) => p.isCustom).length;
  const modelCount = toDelete.length - customCount;

  let description;
  if (toDelete.length === 1) {
    description = toDelete[0].isCustom
      ? "Se borra de tu cuenta de forma permanente."
      : "Se quita de la corrida actual del modelo. Para recuperarla, vuelve a ejecutar el modelo.";
  } else {
    const parts = [];
    if (customCount) parts.push(`${customCount} capturada${customCount === 1 ? "" : "s"} por ti se borran de tu cuenta de forma permanente`);
    if (modelCount) parts.push(`${modelCount} de la corrida del modelo se quitan de la corrida actual (para recuperarlas, vuelve a ejecutar el modelo)`);
    description = `${parts.join("; ")}.`;
  }

  return (
    <>
      <TopBar
        title="Todas las parcelas"
        subtitle={`${filtered.length} de ${parcels.length} parcela${parcels.length === 1 ? "" : "s"}`}
        hideSearch
        actions={
          <Link
            to="/parcelas"
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={15} className="text-gray-500 dark:text-gray-400" />
            Volver a Parcelas
          </Link>
        }
      />

      <div className="mt-6" aria-hidden="true" />

      <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* Búsqueda y filtro por región */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative my-3 w-full sm:my-0 sm:min-w-[220px] sm:flex-1 sm:w-auto">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-800 dark:text-gray-200"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
              placeholder="Buscar por nombre, municipio o código"
              className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-500 focus:outline-hidden focus:ring-1 focus:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-200"
            />
          </label>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Región">
            {REGION_FILTERS.map((r) => {
              const active = region === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleRegion(r)}
                  className={[
                    "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500",
                    active
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100",
                  ].join(" ")}
                >
                  {r}
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      active ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {regionCounts[r]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Barra de selección */}
        <div
          className={[
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors",
            count > 0
              ? "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60"
              : "border-gray-200 dark:border-gray-800",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
              label={allSelected ? "Quitar toda la selección" : "Seleccionar todas las parcelas"}
            />
            <button
              type="button"
              onClick={toggleAll}
              disabled={filtered.length === 0}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 dark:text-gray-200 dark:hover:text-white"
            >
              {allSelected ? "Quitar selección" : `Seleccionar todo (${filtered.length})`}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-300" aria-live="polite">
              {count === 0 ? "Ninguna seleccionada" : `${count} seleccionada${count === 1 ? "" : "s"}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {count > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-300 dark:hover:bg-gray-900"
              >
                <X size={15} className="text-gray-400 dark:text-gray-500" />
                Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={count === 0}
              onClick={() => setConfirm({ parcels: selectedParcels })}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-red-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-600 dark:focus-visible:ring-offset-black"
            >
              <Trash2 size={15} />
              {count > 0 ? `Eliminar (${count})` : "Eliminar"}
            </button>
          </div>
        </div>

        {/* Lista */}
        <div ref={listRef}>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800">
            <div
              className={[
                ROW_GRID,
                "hidden border-b border-gray-200 px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500 lg:grid",
              ].join(" ")}
            >
              <span className="w-5" aria-hidden="true" />
              <span>Parcela</span>
              <span>Rendimiento</span>
              <span>Elegibilidad</span>
              <span>NDVI</span>
              <span>Municipio</span>
              <span className="w-[88px]" aria-hidden="true" />
            </div>

            {filtered.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Ninguna parcela coincide con la búsqueda.
              </p>
            ) : (
              pageItems.map((parcel) => (
                <HistoryRow
                  key={parcel.id}
                  parcel={parcel}
                  selected={selected.has(parcel.id)}
                  onToggle={toggleOne}
                  onEdit={setEditing}
                  onDelete={askDeleteOne}
                />
              ))
            )}
          </div>
          <Pagination {...paginationProps} className="mt-4" />
        </div>
      </div>

      {editing && (
        <ParcelFormModal
          parcel={editing}
          onClose={() => setEditing(null)}
          onSubmit={(fields) => saveParcel(editing, fields)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            toDelete.length === 1 ? `¿Eliminar ${toDelete[0].name}?` : `¿Eliminar ${toDelete.length} parcelas?`
          }
          description={description}
          confirmLabel={toDelete.length === 1 ? "Eliminar" : `Eliminar ${toDelete.length}`}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const result =
              toDelete.length === 1 ? await deleteParcel(toDelete[0]) : await deleteParcels(toDelete);
            if (!result?.error) forgetDeleted(toDelete);
            return result;
          }}
        />
      )}
    </>
  );
}

export default ParcelasHistorialContent;
