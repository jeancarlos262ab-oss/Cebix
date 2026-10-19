import { useState } from "react";
import LocationPin from "./LocationPin";
import { buildStaticSatelliteUrl } from "../../utils/staticMap";
import { openInGoogleMaps } from "../../utils/googleMaps";

export default function StaticMapImage({
  lat,
  lng,
  zoom = 15,
  height = 130,
  rounded = false,
  fill = false,
  bottomFade = false,
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  
  
  const requestWidth = Math.round(height * 2.3);
  const src = buildStaticSatelliteUrl({ lat, lng, zoom, width: requestWidth, height });

  return (
    <button
      type="button"
      onClick={() => openInGoogleMaps(lat, lng, { zoom })}
      title="Abrir ubicación en Google Maps"
      className={[
        "group relative block w-full cursor-pointer overflow-hidden bg-black text-left",
        rounded ? "rounded-2xl" : "",
        className,
      ].join(" ")}
      style={{ height: fill ? "100%" : `${height}px` }}
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

      {bottomFade && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      )}

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[-95%]">
        <LocationPin size={26} />
      </div>
    </button>
  );
}