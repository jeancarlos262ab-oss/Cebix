import { useState } from "react";
import LocationPin from "./LocationPin";
import { buildStaticSatelliteUrl } from "../../utils/staticMap";
import { openInGoogleMaps } from "../../utils/googleMaps";

/**
 * Vista satelital como imagen ESTÁTICA (screenshot), no como mapa
 * interactivo: mucho más ligera (un solo PNG) que cargar MapLibre/Leaflet,
 * pensada para lugares donde solo se necesita una referencia visual rápida
 * de la ubicación (p. ej. el panel de Predicciones).
 *
 * @param {{
 *   lat: number,
 *   lng: number,
 *   zoom?: number,
 *   height?: number,
 *   bordered?: boolean,
 *   className?: string,
 * }} props
 */
export default function StaticMapImage({
  lat,
  lng,
  zoom = 15,
  height = 130,
  bordered = true,
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  // Se pide la imagen ya en proporción rectangular (más ancha que alta) al
  // servidor, así no hay que recortarla ni deformarla en el cliente.
  const requestWidth = Math.round(height * 2.3);
  const src = buildStaticSatelliteUrl({ lat, lng, zoom, width: requestWidth, height });

  return (
    <button
      type="button"
      onClick={() => openInGoogleMaps(lat, lng, { zoom })}
      title="Abrir ubicación en Google Maps"
      className={[
        "group relative block w-full cursor-pointer overflow-hidden bg-gray-100 text-left dark:bg-gray-900",
        bordered ? "border border-gray-200 dark:border-gray-800" : "",
        className,
      ].join(" ")}
      style={{ height: `${height}px` }}
    >
      {!errored ? (
        <img
          src={src}
          alt="Vista satelital de la parcela"
          loading="lazy"
          decoding="async"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitUserDrag: "none", userSelect: "none" }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-90 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          Vista no disponible
        </div>
      )}

      {!loaded && !errored && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          Cargando vista…
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[95%]">
        <LocationPin size={26} />
      </div>
    </button>
  );
}
