import { memo } from "react";
import { RISK_COLORS } from "../../utils/riskColors";
import { useNavigate } from "react-router-dom";
import { Pencil, ChevronRight } from "lucide-react";
import CategoryTag from "../ui/CategoryTag";

// Rango de la barra de NDVI (el dataset real va de ≈ 0.4 a ≈ 0.85).
const NDVI_MIN = 0.4;
const NDVI_MAX = 0.85;

// Mismos tonos del semáforo de elegibilidad (Semaphore.jsx), reutilizados
// aquí para la barra de score de cada fila.
const RISK_HEX = { ...RISK_COLORS, gray: "#9CA3AF" };

/**
 * @param {{parcel: import("../../context/ParcelsContext").buildAnalysisParcel, onEdit?: (parcel: object) => void}} props
 */
function ParcelRow({ parcel, onEdit }) {
  const navigate = useNavigate();
  const scorePct = Math.max(0, Math.min(100, parcel.score));
  const ndviPct = Math.max(
    0,
    Math.min(100, ((parcel.ndvi - NDVI_MIN) / (NDVI_MAX - NDVI_MIN)) * 100)
  );

  return (
    <tr
      onClick={() => navigate(`/parcelas/${parcel.id}`)}
      className="group cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
    >
      <td className="py-4 pl-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{parcel.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span>{parcel.area}</span>
              {parcel.polygonId && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className="font-mono">{parcel.polygonId}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </td>

      <td className="py-4 pr-4">
        <div>
          <div>
            <p className="font-display text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">
              {parcel.yieldEstimate.toFixed(1)} <span className="text-xs font-medium text-gray-500 dark:text-gray-400">ton/ha</span>
            </p>
            {typeof parcel.confidence === "number" && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">± {parcel.confidence.toFixed(2)}</p>
            )}
          </div>
        </div>
      </td>

      <td className="py-4 pr-4">
        <div className="flex items-center justify-between gap-2">
          <CategoryTag label={parcel.risk} color={parcel.riskColor} />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{parcel.score}</span>
        </div>
        <div className="mt-1.5 h-1 w-24 overflow-hidden bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full transition-all"
            style={{ width: `${scorePct}%`, backgroundColor: RISK_HEX[parcel.riskColor] }}
          />
        </div>
      </td>

      <td className="py-4 pr-4">
        <span className="text-sm font-medium tabular-nums text-gray-800 dark:text-gray-200">{parcel.ndvi.toFixed(2)}</span>
        <div className="mt-1.5 h-1 w-16 overflow-hidden bg-gray-100 dark:bg-gray-800">
          <div className="h-full bg-gray-500 dark:bg-gray-400" style={{ width: `${ndviPct}%` }} />
        </div>
      </td>

      <td className="py-4 pr-4">
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {parcel.regionCode}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{parcel.municipio}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{parcel.region}</p>
          </div>
        </div>
      </td>

      <td className="w-16 py-4 pr-3 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            aria-label={`Editar ${parcel.name}`}
            disabled={!onEdit}
            title="Editar parcela"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(parcel);
            }}
            className={[
              "rounded-md p-1.5",
              onEdit
                ? "text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                : "cursor-not-allowed text-gray-200 dark:text-gray-800",
            ].join(" ")}
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <ChevronRight size={15} strokeWidth={1.75} className="text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
        </div>
      </td>
    </tr>
  );
}

export default memo(ParcelRow);
