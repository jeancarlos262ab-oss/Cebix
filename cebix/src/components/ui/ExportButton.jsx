import { Download } from "lucide-react";
import { BTN_OUTLINE } from "./buttonStyles";
import { exportParcelsCSV } from "../../utils/csv";

export default function ExportButton({ parcels, filename }) {
  return (
    <button
      type="button"
      onClick={() => exportParcelsCSV(parcels, filename)}
      className={BTN_OUTLINE}
    >
      <Download size={15} strokeWidth={1.75} className="text-gray-400" />
      Exportar
    </button>
  );
}