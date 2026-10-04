import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polygon, Polyline, Marker, GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { Check, Eraser, MousePointer2, Pencil, Undo2 } from "lucide-react";
import { usePageActive } from "../../context/PageActiveContext";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { estadoBounds } from "../../utils/polygon";
import { ESTADOS } from "../../data/earthEngine";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "leaflet/dist/leaflet.css";

const SATELLITE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics",
};
// Encuadre inicial: Hidalgo, Tlaxcala y Puebla.
const START_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];

const vertexIcon = (color, closeTarget) =>
  L.divIcon({
    className: "",
    iconSize: closeTarget ? [20, 20] : [14, 14],
    iconAnchor: closeTarget ? [10, 10] : [7, 7],
    html: `<span style="display:block;width:100%;height:100%;border-radius:9999px;background:${
      closeTarget ? "#fff" : color
    };border:2px solid ${closeTarget ? color : "#fff"};box-shadow:0 0 0 1px rgba(0,0,0,.45)"></span>`,
  });

/** Clics del mapa: solo agregan vértices mientras se dibuja (y se evita el zoom por doble clic). */
function DrawEvents({ drawing, onAdd }) {
  const map = useMap();
  useEffect(() => {
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
    return () => {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    };
  }, [drawing, map]);
  useMapEvents({ click: (e) => drawing && onAdd([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Re-mide el mapa al volver a la pantalla (keep-alive) y encuadra el polígono cuando `fitKey` cambia. */
function MapSync({ fitKey, points }) {
  const map = useMap();
  const active = usePageActive();
  useEffect(() => {
    if (active) {
      const id = setTimeout(() => map.invalidateSize(), 50);
      return () => clearTimeout(id);
    }
  }, [active, map]);
  // Cubre también la pestaña oculta (display:none) y el cambio de tamaño de la ventana.
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    if (fitKey && points.length >= 3) map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 17 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const TOOL_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY = `${TOOL_BTN} bg-accent-500 text-accent-contrast hover:bg-accent-600`;
const GHOST = `${TOOL_BTN} text-gray-200 hover:bg-white/10`;

/**
 * Mapa satelital con dibujo de polígono (Leaflet, sin plugins).
 * Controlado por el padre: `points` ([lat,lng][]), `closed` y `drawing`.
 */
export default function GeometryMap({
  points,
  closed,
  drawing,
  locked,
  fitKey,
  onChange,
  onStartDrawing,
  onFinish,
  onClear,
  onUndo,
}) {
  const [map, setMap] = useState(null);
  const { accent, resolvedTheme } = useTheme();
  const color = getAccentHex(accent, resolvedTheme === "dark" ? "dark" : "light");
  const ready = points.length >= 3;
  const stateStyle = useMemo(() => ({ color: "#ffffff", weight: 1.2, opacity: 0.55, dashArray: "4 5", fillOpacity: 0 }), []);

  const status = locked
    ? "Calculando índices… la parcela queda bloqueada"
    : drawing
      ? ready
        ? "Sigue marcando vértices · toca el punto blanco o «Terminar» para cerrar"
        : `Haz clic en el mapa para marcar los vértices (${points.length}/3 mínimo)`
      : closed
        ? "Arrastra los vértices para ajustar el contorno"
        : "Pulsa «Dibujar parcela» y marca el contorno sobre la imagen";

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      <MapContainer
        ref={setMap}
        bounds={START_BOUNDS}
        zoomControl={false}
        maxZoom={19}
        className="absolute inset-0 bg-gray-100 dark:bg-gray-900"
      >
        <TileLayer {...SATELLITE} maxNativeZoom={17} maxZoom={19} />
        <GeoJSON data={estadosBoundaries} style={() => stateStyle} interactive={false} />

        {points.length >= 2 && !closed && (
          <Polyline positions={points} pathOptions={{ color, weight: 3 }} interactive={false} />
        )}
        {closed && ready && (
          <Polygon
            positions={points}
            pathOptions={{ color, weight: 3, fillColor: color, fillOpacity: 0.22 }}
            interactive={false}
          />
        )}

        {points.map((p, i) => {
          const closeTarget = drawing && ready && i === 0;
          return (
            <Marker
              key={`${i}-${closeTarget}`}
              position={p}
              draggable={!locked && !drawing}
              icon={vertexIcon(color, closeTarget)}
              eventHandlers={{
                click: () => closeTarget && onFinish(),
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onChange(points.map((q, k) => (k === i ? [lat, lng] : q)));
                },
              }}
            />
          );
        })}

        <DrawEvents drawing={drawing && !locked} onAdd={(p) => onChange([...points, p])} />
        <MapSync fitKey={fitKey} points={points} />
      </MapContainer>

      {/* Herramientas de dibujo */}
      <div className="pointer-events-none absolute left-3 top-3 z-1000">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/85 p-1 shadow-lg backdrop-blur">
          {drawing ? (
            <button type="button" onClick={onFinish} disabled={!ready || locked} className={PRIMARY}>
              <Check size={14} /> Terminar
            </button>
          ) : (
            <button type="button" onClick={onStartDrawing} disabled={locked} className={PRIMARY}>
              {closed ? <MousePointer2 size={14} /> : <Pencil size={14} />}
              {closed ? "Redibujar" : "Dibujar parcela"}
            </button>
          )}
          <button type="button" onClick={onUndo} disabled={!drawing || !points.length || locked} className={GHOST}>
            <Undo2 size={14} /> Deshacer
          </button>
          <button type="button" onClick={onClear} disabled={!points.length || locked} className={GHOST}>
            <Eraser size={14} /> Borrar
          </button>
        </div>
      </div>

      {/* Zoom y saltos a cada estado */}
      <div className="pointer-events-none absolute right-3 top-3 z-1000 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-lg">
          <button type="button" aria-label="Acercar" onClick={() => map?.zoomIn()} className="flex h-9 w-9 items-center justify-center text-lg leading-none text-gray-200 hover:bg-white/10">
            +
          </button>
          <button type="button" aria-label="Alejar" onClick={() => map?.zoomOut()} className="flex h-9 w-9 items-center justify-center border-t border-white/10 text-lg leading-none text-gray-200 hover:bg-white/10">
            −
          </button>
        </div>
        <div className="pointer-events-auto flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-lg">
          {ESTADOS.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => map?.flyToBounds(estadoBounds(name), { duration: 0.8 })}
              className={`px-3 py-1.5 text-left text-[11px] font-medium text-gray-200 hover:bg-white/10 ${i ? "border-t border-white/10" : ""}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-14 z-1000">
        <p className="inline-block max-w-full rounded-full border border-white/10 bg-black/85 px-3 py-1.5 text-xs text-gray-200 shadow-lg backdrop-blur">
          {status}
        </p>
      </div>
    </div>
  );
}
