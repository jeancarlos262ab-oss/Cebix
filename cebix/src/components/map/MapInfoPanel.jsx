import { memo, useMemo, useState } from "react";
import { Check, Copy, Crosshair, ExternalLink, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { openInGoogleMaps } from "../../utils/googleMaps";
import {
  formatDecimal,
  formatDistance,
  formatDMS,
  formatUTM,
  haversine,
  niceScale,
  wrapLng,
} from "../../utils/geo";

/**
 * Panel de información del mapa satelital (compartido por los motores GL y Lite).
 *
 * Muestra: coordenadas del cursor (o del punto marcado con un clic, o del
 * centro si no hay cursor, p. ej. en móvil), en decimal/DMS, UTM, zoom,
 * escala, centro de la vista, parcela más cercana y mapa base. Permite
 * copiar las coordenadas y abrirlas en Google Maps.
 *
 * @param {{
 *   info: {cursor: {lat:number,lng:number}|null, center: {lat:number,lng:number}, zoom: number, mpp: number},
 *   pinned: {lat:number,lng:number}|null,
 *   onClearPinned: () => void,
 *   parcels?: Array,
 *   basemapLabel?: string,
 * }} props
 */
function Stat({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-gray-100">{children}</dd>
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-accent-400 transition-colors hover:bg-white/10"
    >
      <Icon size={14} />
    </button>
  );
}

function MapInfoPanel({ info, pinned, onClearPinned, parcels, basemapLabel }) {
  const [dms, setDms] = useState(false);
  const [copied, setCopied] = useState(false);

  const { cursor, center, zoom, mpp } = info;
  const point = pinned ?? cursor ?? center;
  const pointLabel = pinned ? "Punto marcado" : cursor ? "Cursor" : "Centro";
  const PointIcon = pinned ? MapPin : Crosshair;

  const scale = useMemo(() => niceScale(mpp), [mpp]);

  const nearest = useMemo(() => {
    if (!parcels?.length) return null;
    let best = null;
    let bestDist = Infinity;
    for (const p of parcels) {
      const d = haversine(point.lat, point.lng, p.lat, p.lng);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best ? { parcel: best, distance: bestDist } : null;
  }, [parcels, point.lat, point.lng]);

  const coordText = dms ? formatDMS(point.lat, point.lng) : formatDecimal(point.lat, point.lng);

  async function handleCopy() {
    const text = `${point.lat.toFixed(6)}, ${wrapLng(point.lng).toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Coordenadas copiadas.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudieron copiar las coordenadas.");
    }
  }

  return (
    <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/10 bg-black/85 px-3 py-2 text-gray-100 shadow-lg">
      <div className="flex items-center gap-2">
        <PointIcon size={14} className="shrink-0 text-accent-400" aria-hidden="true" />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {pointLabel}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold tabular-nums text-gray-100" aria-live="off">
          {coordText}
        </span>
        <button
          type="button"
          onClick={() => setDms((v) => !v)}
          title="Cambiar formato de coordenadas"
          className="shrink-0 rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 hover:bg-white/10"
        >
          {dms ? "DMS" : "DEC"}
        </button>
        <IconButton icon={copied ? Check : Copy} label="Copiar coordenadas" onClick={handleCopy} />
        <IconButton
          icon={ExternalLink}
          label="Abrir en Google Maps"
          onClick={() => openInGoogleMaps(point.lat, point.lng, { zoom })}
        />
        {pinned && <IconButton icon={X} label="Quitar punto marcado" onClick={onClearPinned} />}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 pt-2 sm:grid-cols-4">
        <Stat label="UTM">{formatUTM(point.lat, point.lng)}</Stat>
        <Stat label="Zoom">{zoom.toFixed(1)}</Stat>
        <Stat label="Escala">
          {scale.px > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 border-x-2 border-b-2 border-gray-100"
                style={{ width: `${Math.round(scale.px)}px` }}
                aria-hidden="true"
              />
              {scale.label}
            </span>
          )}
        </Stat>
        <Stat label="Resolución">{mpp >= 10 ? mpp.toFixed(0) : mpp.toFixed(1)} m/px</Stat>
        <Stat label="Centro">{formatDecimal(center.lat, center.lng, 3)}</Stat>
        <Stat label="Mapa base">{basemapLabel ?? "—"}</Stat>
        <div className="col-span-2 min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Parcela más cercana
          </dt>
          <dd className="mt-0.5 truncate text-[11px] text-gray-100">
            {nearest ? (
              <>
                <span className="font-medium">{nearest.parcel.name}</span>
                <span className="font-mono tabular-nums text-gray-400">
                  {" "}· {formatDistance(nearest.distance)}
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {!pinned && (
        <p className="mt-1.5 text-[10px] text-gray-500">
          Haz clic en el mapa para marcar un punto.
        </p>
      )}
    </div>
  );
}

export default memo(MapInfoPanel);
