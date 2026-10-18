import { AlertTriangle } from "lucide-react";
import { useModelInfo } from "../../context/ModelInfoContext";
import { parcelWarnings } from "../../utils/reliability";

export function useParcelWarnings(parcel) {
  const { info } = useModelInfo();
  return parcelWarnings(parcel, info?.dominio);
}

const TONES = {
  light: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  dark: "bg-amber-400/20 text-amber-200",
};

export default function RangeBadge({ parcel, warnings, tone = "light", compact = false, className = "" }) {
  const own = useParcelWarnings(warnings ? null : parcel);
  const list = warnings ?? own;
  if (!list.length) return null;
  const text = list.join(" ");
  return (
    <span
      title={text}
      aria-label={`Fuera de rango. ${text}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TONES[tone]} ${className}`}
    >
      <AlertTriangle size={10} aria-hidden="true" />
      {compact ? "Rango" : "Fuera de rango"}
    </span>
  );
}

export function RangeNotice({ parcel, warnings, className = "" }) {
  const own = useParcelWarnings(warnings ? null : parcel);
  const list = warnings ?? own;
  if (!list.length) return null;
  return (
    <div
      role="alert"
      className={`flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 ${className}`}
    >
      <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Fuera de lo que el modelo vio al entrenar</p>
        <ul className="mt-0.5 space-y-0.5">
          {list.map((t) => (
            <li key={t}>{t} La estimación es menos confiable.</li>
          ))}
        </ul>
      </div>
    </div>
  );
}