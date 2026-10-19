import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Minus, Plus } from "lucide-react";
import { PANEL } from "../geomap/mapUi";
import { locationPinHtml, PIN_SIZE, PIN_TIP_OFFSET } from "./LocationPin";
import "leaflet/dist/leaflet.css";
import { formatFixed } from "../../utils/intl";

const DEFAULT_CENTER = [19.9, -98.1]; 
const DEFAULT_ZOOM = 8;
const POINT_ZOOM = 15;
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

const pinIcon = L.divIcon({
  className: "",
  html: locationPinHtml(),
  iconSize: [PIN_SIZE, PIN_SIZE],
  iconAnchor: [PIN_SIZE / 2, PIN_SIZE - PIN_TIP_OFFSET],
});

const round = (n) => Number(n.toFixed(6));

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(round(e.latlng.lat), round(e.latlng.lng));
    },
  });
  return null;
}

function Recenter({ position }) {
  const map = useMap();
  const lat = position?.[0];
  const lng = position?.[1];
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), POINT_ZOOM));
    }
  }, [lat, lng, map]);
  
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function ZoomButtons() {
  const map = useMap();
  const ref = useRef(null);
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md text-gray-200 transition-colors hover:bg-white/10 active:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Zoom del mapa"
      className={`absolute right-2.5 top-2.5 z-1000 flex flex-col items-center gap-0.5 p-1 ${PANEL}`}
    >
      <button type="button" className={btn} aria-label="Acercar" title="Acercar" disabled={zoom >= MAX_ZOOM} onClick={() => map.zoomIn()}>
        <Plus size={16} strokeWidth={1.75} />
      </button>
      <div className="h-px w-5 bg-white/15" aria-hidden="true" />
      <button type="button" className={btn} aria-label="Alejar" title="Alejar" disabled={zoom <= MIN_ZOOM} onClick={() => map.zoomOut()}>
        <Minus size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export default function LocationPickerMap({ lat, lng, onChange, height = 260, bare = false }) {
  const latN = lat === "" || lat == null ? NaN : Number(lat);
  const lngN = lng === "" || lng == null ? NaN : Number(lng);
  const hasPoint = Number.isFinite(latN) && Number.isFinite(lngN);
  const position = hasPoint ? [latN, lngN] : null;

  const initial = useMemo(
    () => ({ center: position ?? DEFAULT_CENTER, zoom: position ? POINT_ZOOM : DEFAULT_ZOOM }),
    
    
    []
  );

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 dark:bg-gray-900 ${bare ? "" : "rounded-xl border border-gray-300 dark:border-gray-700"}`}
      style={{ height }}
    >
      <MapContainer
        center={initial.center}
        zoom={initial.zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", cursor: "crosshair", background: "transparent" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={17}
          maxZoom={MAX_ZOOM}
        />
        <ClickHandler onPick={onChange} />
        <Recenter position={position} />
        <ZoomButtons />
        {position && (
          <Marker
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend(e) {
                const p = e.target.getLatLng();
                onChange(round(p.lat), round(p.lng));
              },
            }}
          />
        )}
      </MapContainer>

      {}
      <div className={`pointer-events-none absolute bottom-2.5 left-2.5 z-1000 max-w-[calc(100%-1.25rem)] px-3 py-1.5 text-xs text-gray-200 ${PANEL}`}>
        {hasPoint ? (
          <>
            <span className="font-mono tabular-nums">
              {formatFixed(latN, 5)}, {formatFixed(lngN, 5)}
            </span>
            <span className="hidden text-gray-400 sm:inline"> · arrastra el pin o toca otro lugar</span>
          </>
        ) : (
          "Toca el mapa para marcar dónde está la parcela"
        )}
      </div>
    </div>
  );
}