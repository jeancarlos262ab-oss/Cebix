import { memo } from "react";
import { Compass, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { PANEL } from "./mapUi";

/**
 * Barra de controles del mapa: panel vertical plano y oscuro (mismo estilo que el resto de la botonera, ver mapUi.js).
 * Solo presentación: el padre decide qué hace cada botón.
 */
function MapControls({ onZoomIn, onZoomOut, onReset, isFullscreen, onToggleFullscreen, disabled = false }) {
  const sep = <div className="my-0.5 h-px w-5 bg-white/15" aria-hidden="true" />;
  return (
    <div
      className={`absolute bottom-3 right-3 z-1000 flex flex-col items-center gap-0.5 p-1 text-gray-100 ${PANEL}`}
      role="group"
      aria-label="Controles del mapa"
    >
      <Btn icon={Plus} label="Acercar" title="Acercar (Zoom In)" onClick={onZoomIn} disabled={disabled} />
      <Btn icon={Minus} label="Alejar" title="Alejar (Zoom Out)" onClick={onZoomOut} disabled={disabled} />
      {sep}
      <Btn icon={Compass} label="Restablecer" title="Restablecer vista" onClick={onReset} disabled={disabled} />
      {sep}
      <Btn
        icon={isFullscreen ? Minimize2 : Maximize2}
        label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        title={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
        onClick={onToggleFullscreen}
      />
    </div>
  );
}

const Btn = memo(function Btn({ icon: Icon, label, title, onClick, disabled = false }) {
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

export default memo(MapControls);
