import { useCallback, useRef, useEffect, useState, memo } from "react";
import { Plus, Minus, Compass, Maximize2, Minimize2 } from "lucide-react";

/**
 * Componente de controles personalizados para MapLibre GL JS.
 * 
 * Reemplaza los controles nativos con una UI personalizada usando:
 * - Lucide React para íconos
 * - Tailwind CSS para estilos
 * - Glassmorphism para diseño moderno
 * 
 * Acciones implementadas:
 * - Acercar (zoom in)
 * - Alejar (zoom out)
 * - Restablecer vista (reset)
 * - Pantalla completa
 * 
 * @param {{
 *   mapRef: RefObject,
 *   initialCenter: [number, number],
 *   initialZoom: number,
 *   position?: "top-right" | "bottom-right" | "bottom-left" | "top-left",
 *   containerRef?: RefObject,
 * }} props
 */
function CustomMapControls({
  mapRef,
  initialCenter,
  initialZoom,
  position = "bottom-right",
  containerRef,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  // Escuchar cambios en zoom para habilitar/deshabilitar botones
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const updateZoomState = () => {
      const currentZoom = map.getZoom();
      setCanZoomIn(currentZoom < map.getMaxZoom());
      setCanZoomOut(currentZoom > map.getMinZoom());
    };

    updateZoomState();

    // Escuchar eventos de zoom
    map.on("zoom", updateZoomState);
    map.on("zoomend", updateZoomState);

    return () => {
      map.off("zoom", updateZoomState);
      map.off("zoomend", updateZoomState);
    };
  }, [mapRef]);

  // Escuchar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Acercar (Zoom In)
  const handleZoomIn = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && canZoomIn) {
      map.zoomIn({ duration: 300 });
    }
  }, [mapRef, canZoomIn]);

  // Alejar (Zoom Out)
  const handleZoomOut = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && canZoomOut) {
      map.zoomOut({ duration: 300 });
    }
  }, [mapRef, canZoomOut]);

  // Restablecer vista (Reset)
  const handleResetView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !initialCenter) return;

    // Normalizar center a [lng, lat]
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

  // Alternar pantalla completa
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

  // Calcular posición del contenedor
  const positionClasses = {
    "top-right": "top-4 right-14",
    "bottom-right": "bottom-14 right-4",
    "bottom-left": "bottom-14 left-4",
    "top-left": "top-4 left-4",
  }[position] || "bottom-14 right-4";

  return (
    <div
      className={`absolute z-10 flex flex-col items-center gap-1 rounded border border-gray-200 bg-white/90 dark:border-white/10 dark:bg-black/70 p-1.5 text-gray-800 shadow-lg dark:text-gray-100 backdrop-blur ${positionClasses}`}
      role="group"
      aria-label="Controles del mapa"
    >
      {/* Botón Zoom In */}
      <ControlButton
        icon={Plus}
        label="Acercar"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        title="Acercar (Zoom In) - Presiona + para acercar"
      />

      {/* Botón Zoom Out */}
      <ControlButton
        icon={Minus}
        label="Alejar"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        title="Alejar (Zoom Out) - Presiona - para alejar"
      />

      {/* Separador */}
      <div className="my-1 h-px w-6 bg-gray-200 dark:bg-white/10" aria-hidden="true" />

      {/* Botón Reset */}
      <ControlButton
        icon={Compass}
        label="Restablecer"
        onClick={handleResetView}
        title="Restablecer vista - Volver a la posición inicial"
      />

      {/* Separador */}
      <div className="my-1 h-px w-6 bg-gray-200 dark:bg-white/10" aria-hidden="true" />

      {/* Botón Pantalla Completa */}
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

/**
 * Botón individual para los controles del mapa.
 * 
 * @param {{
 *   icon: React.ComponentType,
 *   label: string,
 *   onClick: () => void,
 *   disabled?: boolean,
 *   title?: string,
 * }} props
 */
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
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
        disabled
          ? "cursor-not-allowed text-gray-400 opacity-50 dark:text-gray-500"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/20"
      }`}
    >
      <Icon size={16} />
    </button>
  );
});

export default memo(CustomMapControls);
