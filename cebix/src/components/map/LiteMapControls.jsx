import { useCallback, useEffect, useState, memo } from "react";
import { Plus, Minus, Compass, Maximize2, Minimize2 } from "lucide-react";

/**
 * Controles personalizados para el motor ligero (Leaflet).
 *
 * Misma interfaz visual que CustomMapControls (motor GL), pero hablando
 * directamente con la API imperativa de Leaflet en vez de MapLibre.
 *
 * @param {{
 *   mapRef: RefObject,          // ref.current = instancia L.Map (no .getMap())
 *   initialCenter: [number, number], // [lat, lng]
 *   initialZoom: number,
 *   position?: "top-right" | "bottom-right" | "bottom-left" | "top-left",
 *   orientation?: "vertical" | "horizontal",   // dirección de la barra (por defecto vertical)
 *   containerRef?: RefObject,
 * }} props
 */
function LiteMapControls({
  mapRef,
  initialCenter,
  initialZoom,
  position = "bottom-right",
  orientation = "vertical",
  containerRef,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateZoomState = () => {
      const currentZoom = map.getZoom();
      setCanZoomIn(currentZoom < map.getMaxZoom());
      setCanZoomOut(currentZoom > map.getMinZoom());
    };

    updateZoomState();
    map.on("zoom", updateZoomState);
    map.on("zoomend", updateZoomState);

    return () => {
      map.off("zoom", updateZoomState);
      map.off("zoomend", updateZoomState);
    };
  }, [mapRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current;
    if (map && canZoomIn) {
      map.zoomIn();
    }
  }, [mapRef, canZoomIn]);

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (map && canZoomOut) {
      map.zoomOut();
    }
  }, [mapRef, canZoomOut]);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !initialCenter) return;

    let lat, lng;
    if (Array.isArray(initialCenter)) {
      [lat, lng] = initialCenter;
    } else if (initialCenter.latitude !== undefined) {
      lat = initialCenter.latitude;
      lng = initialCenter.longitude;
    } else {
      return;
    }

    map.setView([lat, lng], initialZoom, { animate: true });
  }, [mapRef, initialCenter, initialZoom]);

  const handleToggleFullscreen = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch((err) => {
        console.warn("Error al activar pantalla completa:", err);
      });
    } else {
      document.exitFullscreen?.().catch((err) => {
        console.warn("Error al salir de pantalla completa:", err);
      });
    }
  }, [containerRef]);

  const positionClasses = {
    "top-right": "top-3 right-3",
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "top-left": "top-3 left-3",
  }[position] || "bottom-3 right-3";

  const horizontal = orientation === "horizontal";
  const separatorClass = horizontal ? "mx-0.5 h-6 w-px bg-white/15" : "my-0.5 h-px w-6 bg-white/15";

  return (
    <div
      className={`absolute z-1000 flex ${horizontal ? "flex-row" : "flex-col"} items-center gap-0.5 rounded-lg border border-white/15 bg-black/90 p-1 text-gray-100 ${positionClasses}`}
      role="group"
      aria-label="Controles del mapa"
    >
      <ControlButton
        icon={Plus}
        label="Acercar"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        title="Acercar (Zoom In)"
      />
      <ControlButton
        icon={Minus}
        label="Alejar"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        title="Alejar (Zoom Out)"
      />
      <div className={separatorClass} aria-hidden="true" />
      <ControlButton
        icon={Compass}
        label="Restablecer"
        onClick={handleResetView}
        title="Restablecer vista"
      />
      <div className={separatorClass} aria-hidden="true" />
      <ControlButton
        icon={isFullscreen ? Minimize2 : Maximize2}
        label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        onClick={handleToggleFullscreen}
        title={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
      />
    </div>
  );
}

const ControlButton = memo(function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        disabled
          ? "cursor-not-allowed text-gray-500 opacity-50"
          : "text-gray-200 hover:bg-white/10 active:bg-white/20"
      }`}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
});

export default memo(LiteMapControls);
