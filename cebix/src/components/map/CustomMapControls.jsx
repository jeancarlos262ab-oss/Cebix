import { useCallback, useEffect, useState, memo } from "react";
import { Plus, Minus, Compass, Maximize2, Minimize2 } from "lucide-react";

function CustomMapControls({
  mapRef,
  initialCenter,
  initialZoom,
  position = "bottom-right",
  orientation = "vertical",
  containerRef,
  className = "",
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  
  useEffect(() => {
    const map = mapRef.current?.getMap();
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
    const map = mapRef.current?.getMap();
    if (map && canZoomIn) {
      map.zoomIn({ duration: 300 });
    }
  }, [mapRef, canZoomIn]);

  
  const handleZoomOut = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && canZoomOut) {
      map.zoomOut({ duration: 300 });
    }
  }, [mapRef, canZoomOut]);

  
  const handleResetView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !initialCenter) return;

    
    let lng, lat;
    if (Array.isArray(initialCenter)) {
      [lng, lat] = initialCenter;
    } else if (initialCenter.longitude !== undefined) {
      lng = initialCenter.longitude;
      lat = initialCenter.latitude;
    } else {
      return;
    }

    map.flyTo({
      center: [lng, lat],
      zoom: initialZoom,
      duration: 1000,
      essential: true,
    });
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
      className={`absolute z-10 flex ${horizontal ? "flex-row" : "flex-col"} items-center gap-0.5 rounded-lg border border-white/15 bg-black/90 p-1 text-gray-100 ${positionClasses} ${className}`}
      role="group"
      aria-label="Controles del mapa"
    >
      {}
      <ControlButton
        icon={Plus}
        label="Acercar"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        title="Acercar (Zoom In) - Presiona + para acercar"
      />

      {}
      <ControlButton
        icon={Minus}
        label="Alejar"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        title="Alejar (Zoom Out) - Presiona - para alejar"
      />

      {}
      <div className={separatorClass} aria-hidden="true" />

      {}
      <ControlButton
        icon={Compass}
        label="Restablecer"
        onClick={handleResetView}
        title="Restablecer vista - Volver a la posición inicial"
      />

      {}
      <div className={separatorClass} aria-hidden="true" />

      {}
      <ControlButton
        icon={isFullscreen ? Minimize2 : Maximize2}
        label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        onClick={handleToggleFullscreen}
        title={
          isFullscreen
            ? "Salir de pantalla completa - Presiona ESC para salir"
            : "Ver en pantalla completa - Presiona F para pantalla completa"
        }
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

export default memo(CustomMapControls);