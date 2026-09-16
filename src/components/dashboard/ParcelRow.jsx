import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import CategoryTag from "../ui/CategoryTag";

const REGION_BADGE_COLOR = {
  HGO: "bg-gray-700",
  TLX: "bg-brand-500",
  PUE: "bg-ndvi-600",
};

/**
 * Pin de ubicación de relleno con el hueco central "recortado" con el color
 * de fondo del contenedor, para que no se vea macizo.
 */
function FilledMapPin() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      className="text-red-600 dark:text-red-400"
    >
      <path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        fill="currentColor"
      />
      <circle cx="12" cy="10" r="3" className="fill-gray-100 dark:fill-gray-800" />
    </svg>
  );
}

/**
 * @param {{parcel: import("../../data/parcels").parcels[number], onEdit?: (parcel: object) => void}} props
 */
function ParcelRow({ parcel, onEdit }) {
  const navigate = useNavigate();

  return (
    <tr
      onClick={() => navigate(`/parcelas/${parcel.id}`)}
      className="cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-gray-100 dark:bg-gray-800">
            <FilledMapPin />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{parcel.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{parcel.area}</p>
          </div>
        </div>
      </td>
      <td className="font-sora py-3 pr-4 text-sm font-bold text-gray-700 dark:text-gray-300">
        {parcel.yieldEstimate.toFixed(1)} ton/ha
      </td>
      <td className="py-3 pr-4">
        <CategoryTag label={parcel.risk} color={parcel.riskColor} />
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-9 items-center justify-center text-[10px] font-bold text-white ${
              REGION_BADGE_COLOR[parcel.regionCode] ?? "bg-gray-400"
            }`}
          >
            {parcel.regionCode}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{parcel.municipio}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{parcel.region}</p>
          </div>
        </div>
      </td>
      <td className="w-9 py-3 text-right">
        <button
          type="button"
          aria-label={`Editar ${parcel.name}`}
          disabled={!onEdit}
          title={onEdit ? "Editar parcela" : "Las parcelas del dataset del reto son de solo lectura"}
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(parcel);
          }}
          className={[
            "p-1.5",
            onEdit
              ? "text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-500 dark:hover:text-gray-400"
              : "cursor-not-allowed text-gray-200 dark:text-gray-800",
          ].join(" ")}
        >
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  );
}

export default memo(ParcelRow);
