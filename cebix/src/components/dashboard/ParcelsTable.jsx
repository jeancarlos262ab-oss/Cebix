import { useState } from "react";
import { Download, Plus } from "lucide-react";
import UploadDropzone from "./UploadDropzone";
import ParcelRow from "./ParcelRow";
import ParcelFormModal from "./ParcelFormModal";
import { useParcels } from "../../context/ParcelsContext";
import { exportParcelsCSV } from "../../utils/csv";

const COLUMNS = ["Parcela", "Rendimiento", "Elegibilidad", "Municipio", ""];

export default function ParcelsTable() {
  const { parcels, addParcel, updateParcel } = useParcels();
  const [modal, setModal] = useState(null); // null | "add" | parcel object being edited

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Parcelas evaluadas</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportParcelsCSV(parcels)}
            className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download size={15} />
            Exportar reporte
          </button>
          <button
            type="button"
            onClick={() => setModal("add")}
            className="flex items-center gap-1.5 bg-accent-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-600"
          >
            <Plus size={15} />
            Agregar parcela
          </button>
        </div>
      </div>

      <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="mt-4">
        <UploadDropzone onParsed={(records) => records.forEach((r) => addParcel(r))} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-400 dark:text-gray-500">
              {COLUMNS.map((col) => (
                <th key={col} className="pb-2 pr-4 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parcels.map((parcel) => (
              <ParcelRow
                key={parcel.id}
                parcel={parcel}
                onEdit={parcel.isCustom ? () => setModal(parcel) : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ParcelFormModal
          parcel={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSubmit={(fields) => (modal === "add" ? addParcel(fields) : updateParcel(modal.id, fields))}
        />
      )}
    </section>
  );
}
