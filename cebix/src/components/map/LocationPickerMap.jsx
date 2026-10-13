/**
 * LocationPickerMap — mapa pequeño para elegir un punto (lat/lng) con un clic.
 *
 * Se usa dentro del formulario de parcelas: el usuario toca el lugar exacto y
 * aparece el pin de ubicación (el mismo de los demás mapas). El pin también se
 * puede arrastrar. Si cambian `lat`/`lng` desde los campos de texto, el pin y
 * la vista se mueven con ellos.
 */
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { locationPinHtml, PIN_SIZE, PIN_TIP_OFFSET } from "./LocationPin";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [19.9, -98.1]; // Hidalgo / Tlaxcala / Puebla
const DEFAULT_ZOOM = 8;
const POINT_ZOOM = 15;

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

/** Mantiene la vista centrada en el punto cuando cambia desde fuera (campos de texto). */
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
  // El mapa nace dentro de un modal con animación/scroll: se recalcula su tamaño.
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

/**
 * @param {{ lat: string|number, lng: string|number, onChange: (lat:number, lng:number) => void, height?: number }} props
 */
export default function LocationPickerMap({ lat, lng, onChange, height = 240 }) {
  const latN = lat === "" || lat == null ? NaN : Number(lat);
  const lngN = lng === "" || lng == null ? NaN : Number(lng);
  const hasPoint = Number.isFinite(latN) && Number.isFinite(lngN);
  const position = hasPoint ? [latN, lngN] : null;

  const initial = useMemo(
    () => ({ center: position ?? DEFAULT_CENTER, zoom: position ? POINT_ZOOM : DEFAULT_ZOOM }),
    // Solo el estado inicial: después la vista la maneja el usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div>
      <div
        className="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"
        style={{ height }}
      >
        <MapContainer
          center={initial.center}
          zoom={initial.zoom}
          minZoom={4}
          maxZoom={18}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", cursor: "crosshair" }}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxNativeZoom={17}
            maxZoom={18}
          />
          <ClickHandler onPick={onChange} />
          <Recenter position={position} />
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
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {hasPoint
          ? `Ubicación: ${latN.toFixed(5)}, ${lngN.toFixed(5)} · arrastra el pin o toca otro lugar para moverlo.`
          : "Toca el mapa para marcar dónde está la parcela."}
      </p>
    </div>
  );
}
