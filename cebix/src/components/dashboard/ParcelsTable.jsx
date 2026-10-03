import { useRef, useState } from "react";
import { Download, Plus } from "lucide-react";
import UploadDropzone from "./UploadDropzone";
import ParcelRow from "./ParcelRow";
import ParcelFormModal from "./ParcelFormModal";
import Pagination from "../ui/Pagination";
import FullscreenLink from "../ui/FullscreenLink";
import usePagination from "../../hooks/usePagination";
import { useParcels } from "../../context/ParcelsContext";
import useParcelActions from "../../hooks/useParcelActions";
import { exportParcelsCSV } from "../../utils/csv";

const COLUMNS = ["Parcela", "Rendimiento", "Elegibilidad", "NDVI", "Municipio", ""];

export default function ParcelsTable() {
  const { parcels } = useParcels();
  const { saveParcel, importParcels } = useParcelActions();
  const [modal, setModal] = useState(null); // null | "add" | parcel object being edited
  const tableRef = useRef(null);
  const { pageItems, paginationProps } = usePagination(parcels, { scrollRef: tableRef });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">Parcelas evaluadas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportParcelsCSV(parcels)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download size={15} className="text-accent-600 dark:text-accent-400" />
            Exportar reporte
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
      </div>

      <div className="mt-4">
        <UploadDropzone onParsed={importParcels} />
      </div>

      {/* Justo encima de la tabla, alineado a la derecha. */}
      <div className="mt-4 flex justify-end">
        <FullscreenLink />
      </div>

      <div ref={tableRef} className="mt-1 overflow-x-auto overflow-y-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
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
            {pageItems.map((parcel) => (
              <ParcelRow
                key={parcel.id}
                parcel={parcel}
                onEdit={setModal}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination {...paginationProps} className="mt-4" />

      {modal && (
        <ParcelFormModal
          parcel={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSubmit={(fields) => saveParcel(modal === "add" ? null : modal, fields)}
        />
      )}
    </section>
  );
}
