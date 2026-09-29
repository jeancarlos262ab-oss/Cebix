import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Gauge, Leaf, ChevronRight, LandPlot } from "lucide-react";
import CategoryTag from "../ui/CategoryTag";

const REGION_BADGE_COLOR = {
  HGO: "bg-gray-700",
  TLX: "bg-brand-500",
  PUE: "bg-ndvi-600",
};

// Umbrales de vigor vegetal (NDVI pico del ciclo) calibrados sobre la
// distribución real del dataset AgroCebada (p25 ≈ 0.61, p75 ≈ 0.71).
const NDVI_TIERS = [
  { test: (v) => v >= 0.72, color: "#3b7a4e", track: "bg-ndvi-600" },
  { test: (v) => v >= 0.6, color: "#7cc192", track: "bg-ndvi-400" },
  { test: () => true, color: "#9ca3af", track: "bg-gray-400" },
];
const NDVI_MIN = 0.4;
const NDVI_MAX = 0.85;

// Mismos tonos del semáforo de elegibilidad (Semaphore.jsx), reutilizados
// aquí para la barra de score de cada fila.
const RISK_HEX = { red: "#DC2626", yellow: "#D97706", green: "#16A34A", gray: "#9CA3AF" };

/**
 * @param {{parcel: import("../../data/parcels").parcels[number], onEdit?: (parcel: object) => void}} props
 */
function ParcelRow({ parcel, onEdit }) {
  const navigate = useNavigate();
  const scorePct = Math.max(0, Math.min(100, parcel.score));
  const ndviTier = NDVI_TIERS.find((t) => t.test(parcel.ndvi)) ?? NDVI_TIERS[2];
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-gray-100 dark:bg-gray-800">
            <LandPlot size={17} className="text-gray-500 dark:text-gray-400" />
          </span>
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
        <div className="flex items-center gap-2">
          <Gauge size={13} className="shrink-0 text-gray-300 dark:text-gray-600" />
          <div>
            <p className="font-sora text-sm font-bold text-gray-800 dark:text-gray-200">
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
        <div className="flex items-center gap-1.5">
          <Leaf size={13} className="shrink-0" style={{ color: ndviTier.color }} />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{parcel.ndvi.toFixed(2)}</span>
        </div>
        <div className="mt-1.5 h-1 w-16 overflow-hidden bg-gray-100 dark:bg-gray-800">
          <div className={`h-full ${ndviTier.track}`} style={{ width: `${ndviPct}%` }} />
        </div>
      </td>

      <td className="py-4 pr-4">
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
            title={onEdit ? "Editar parcela" : "Las parcelas del dataset del reto son de solo lectura"}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(parcel);
            }}
            className={[
              "p-1.5",
              onEdit
                ? "text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                : "cursor-not-allowed text-gray-200 dark:text-gray-800",
            ].join(" ")}
          >
            <Pencil size={14} />
          </button>
          <ChevronRight
            size={15}
            className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
          />
        </div>
      </td>
    </tr>
  );
}

export default memo(ParcelRow);
