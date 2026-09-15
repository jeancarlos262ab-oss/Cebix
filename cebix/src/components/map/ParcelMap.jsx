import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  ScaleControl,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import {
  Gauge,
  Leaf,
  Maximize,
  Milestone,
  Minimize,
  Mountain,
  Moon,
  Satellite as SatelliteIcon,
  Sun,
  Tags,
} from "lucide-react";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "leaflet/dist/leaflet.css";

const RISK_HEX = {
  green: "#16A34A",
  yellow: "#D97706",
  red: "#DC2626",
};

// Tiles servidos por Stadia Maps (https://docs.stadiamaps.com/tutorials/getting-started-with-react-leaflet/).
// En localhost/127.0.0.1 las peticiones funcionan sin API key; fuera de ahí hace
// falta autenticación por dominio o por api_key (VITE_STADIA_API_KEY en .env).
const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a>, ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

const STADIA_API_KEY = import.meta.env.VITE_STADIA_API_KEY;

function stadiaTileUrl(style) {
  const base = `https://tiles.stadiamaps.com/tiles/${style}/{z}/{x}/{y}{r}.png`;
  return STADIA_API_KEY ? `${base}?api_key=${STADIA_API_KEY}` : base;
}

// Imagen satelital real (Esri World Imagery) resuelve hasta ~zoom 19-20 en
// zonas agrícolas de México; por encima Leaflet reescala el último nivel.
const BASEMAPS = {
  satellite: {
    label: "Satelital",
    icon: SatelliteIcon,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 19,
  },
  satelliteLabels: {
    label: "Satelital + etiquetas",
    icon: Tags,
    url: stadiaTileUrl("alidade_satellite"),
    attribution: STADIA_ATTRIBUTION,
    maxNativeZoom: 20,
  },
  claro: {
    label: "Claro",
    icon: Sun,
    url: stadiaTileUrl("alidade_smooth"),
    attribution: STADIA_ATTRIBUTION,
    maxNativeZoom: 20,
  },
  oscuro: {
    label: "Oscuro",
    icon: Moon,
    url: stadiaTileUrl("alidade_smooth_dark"),
    attribution: STADIA_ATTRIBUTION,
    maxNativeZoom: 20,
  },
  terreno: {
    label: "Terreno",
    icon: Mountain,
    url: stadiaTileUrl("outdoors"),
    attribution: STADIA_ATTRIBUTION,
    maxNativeZoom: 20,
  },
};

export { BASEMAPS };

const LAYERS = [
  { key: "risk", label: "Semáforo de elegibilidad", icon: Gauge },
  { key: "ndvi", label: "Vigor NDVI", icon: Leaf },
];

const RISK_LEGEND = [
  { color: "#16A34A", label: "Elegible" },
  { color: "#D97706", label: "Revisión manual" },
  { color: "#DC2626", label: "Alto riesgo" },
];

const NDVI_LEGEND = [
  { color: "#3B7A4E", label: "NDVI ≥ 0.68 (vigor alto)" },
  { color: "#7CC192", label: "NDVI 0.55–0.68" },
  { color: "#D9A544", label: "NDVI 0.50–0.55" },
  { color: "#C0362E", label: "NDVI < 0.50 (estrés)" },
];

const GROUND_LEVEL_ZOOM = 18;

function ndviToColor(ndvi) {
  if (ndvi >= 0.68) return "#3B7A4E";
  if (ndvi >= 0.55) return "#7CC192";
  if (ndvi >= 0.5) return "#D9A544";
  return "#C0362E";
}

/** Reacciona a cambios de foco (selección o "ver el terreno real") con un vuelo suave. */
function FlyTo({ target, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 1.1 });
  }, [target, zoom, map]);
  return null;
}

/** Contorno de Puebla, Tlaxcala e Hidalgo con el nombre del estado centrado. */
const StateBoundaries = memo(function StateBoundaries({ visible }) {
  if (!visible) return null;
  return (
    <GeoJSON
      data={estadosBoundaries}
      style={{
        color: "#F5D949",
        weight: 1.5,
        opacity: 0.85,
        fill: false,
        dashArray: "5 4",
      }}
      onEachFeature={(feature, layer) => {
        layer.bindTooltip(feature.properties.name, {
          permanent: true,
          direction: "center",
          className:
            "!border-0 !bg-transparent !shadow-none !px-0 !py-0 !font-semibold !text-[11px] !tracking-wide !text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]",
        });
      }}
    />
  );
});

/** Botón flotante de pantalla completa sobre el contenedor del mapa. */
function FullscreenButton({ containerRef }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
      className="flex h-8 w-8 items-center justify-center border border-white/10 bg-black/70 text-gray-200 shadow-card backdrop-blur hover:bg-black/85"
    >
      {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
    </button>
  );
}

/** Botón individual de la barra vertical: ícono + tooltip nativo + estado activo. */
const ToolbarIconButton = memo(function ToolbarIconButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        "flex h-8 w-8 items-center justify-center transition-colors",
        active ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      <Icon size={15} />
    </button>
  );
});

/** Barra vertical de íconos para elegir capa temática, mapa base y contorno de estados. */
function MapControls({
  layer,
  onLayerChange,
  basemap,
  onBasemapChange,
  showBoundaries,
  onToggleBoundaries,
}) {
  return (
    <div className="flex flex-col items-center gap-1 border border-white/10 bg-black/70 p-1.5 text-gray-100 shadow-card backdrop-blur">
      {LAYERS.map((l) => (
        <ToolbarIconButton
          key={l.key}
          icon={l.icon}
          label={l.label}
          active={layer === l.key}
          onClick={() => onLayerChange(l.key)}
        />
      ))}

      <div className="my-1 h-px w-6 bg-white/10" aria-hidden="true" />

      {Object.entries(BASEMAPS).map(([key, value]) => (
        <ToolbarIconButton
          key={key}
          icon={value.icon}
          label={value.label}
          active={basemap === key}
          onClick={() => onBasemapChange(key)}
        />
      ))}

      <div className="my-1 h-px w-6 bg-white/10" aria-hidden="true" />

      <ToolbarIconButton
        icon={Milestone}
        label="Límites estatales"
        active={showBoundaries}
        onClick={() => onToggleBoundaries(!showBoundaries)}
      />
    </div>
  );
}

/** Leyenda flotante que refleja la capa activa. */
const MapLegend = memo(function MapLegend({ layer }) {
  const items = layer === "ndvi" ? NDVI_LEGEND : RISK_LEGEND;
  return (
    <div className=" border border-white/10 bg-black/70 px-3 py-2.5 text-gray-100 shadow-card backdrop-blur">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11px] text-gray-200">
            <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * @param {{
 *   parcels: import("../../data/parcels").parcels,
 *   basemap?: "satellite" | "satelliteLabels" | "claro" | "oscuro" | "terreno",
 *   ndviOverlay?: boolean,
 *   selectedId?: number,
 *   onSelect?: (id: number) => void,
 *   height?: number | string,
 *   center?: [number, number],
 *   zoom?: number,
 *   allowGroundView?: boolean,
 *   showLayerControl?: boolean,
 *   showBoundariesByDefault?: boolean,
 * }} props
 */
function ParcelMap({
  parcels,
  basemap: initialBasemap = "oscuro",
  ndviOverlay: initialNdviOverlay = false,
  selectedId,
  onSelect,
  height = 420,
  center = [19.9, -98.1],
  zoom = 8,
  allowGroundView = true,
  showLayerControl = true,
  showBoundariesByDefault = true,
}) {
  const containerRef = useRef(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [flyZoom, setFlyZoom] = useState(zoom);

  const [basemap, setBasemap] = useState(initialBasemap);
  const [layer, setLayer] = useState(initialNdviOverlay ? "ndvi" : "risk");
  const [showBoundaries, setShowBoundaries] = useState(showBoundariesByDefault);

  const base = useMemo(() => BASEMAPS[basemap] ?? BASEMAPS.satellite, [basemap]);
  const ndviOverlay = layer === "ndvi";

  const goToGround = useCallback(
    (parcel) => {
      setFlyTarget([parcel.lat, parcel.lng]);
      setFlyZoom(GROUND_LEVEL_ZOOM);
      onSelect?.(parcel.id);
    },
    [onSelect]
  );

  const markers = useMemo(
    () =>
      parcels.map((parcel) => (
        <CircleMarker
          key={parcel.id}
          center={[parcel.lat, parcel.lng]}
          radius={selectedId === parcel.id ? 12 : 9}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: ndviOverlay ? ndviToColor(parcel.ndvi) : RISK_HEX[parcel.riskColor],
            fillOpacity: 0.9,
          }}
          eventHandlers={onSelect ? { click: () => onSelect(parcel.id) } : undefined}
        >
          <Popup>
            <div className="min-w-[170px] font-sans">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{parcel.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {parcel.municipio}, {parcel.region}
              </p>
              <div className="mt-1.5 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                <p>Rendimiento: {parcel.yieldEstimate.toFixed(1)} ton/ha</p>
                <p>NDVI: {parcel.ndvi.toFixed(2)}</p>
                <p>Elegibilidad: {parcel.risk}</p>
              </div>
              {allowGroundView && (
                <button
                  type="button"
                  onClick={() => goToGround(parcel)}
                  className="mt-2 flex items-center gap-1.5 bg-gray-900 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  <SatelliteIcon size={12} />
                  Ver el terreno real
                </button>
              )}
            </div>
          </Popup>
        </CircleMarker>
      )),
    [parcels, selectedId, ndviOverlay, onSelect, allowGroundView, goToGround]
  );

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="relative w-full overflow-hidden border border-gray-200 dark:border-gray-800 bg-black [&_.leaflet-control-attribution]:text-[10px] [&:fullscreen]:h-screen"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={5}
        maxZoom={20}
        zoomSnap={0.25}
        zoomDelta={0.75}
        wheelPxPerZoomLevel={90}
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        boxZoom
        keyboard
        dragging
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          key={basemap}
          url={base.url}
          attribution={base.attribution}
          maxZoom={20}
          maxNativeZoom={base.maxNativeZoom}
        />
        <StateBoundaries visible={showBoundaries} />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomright" imperial={false} />
        <FlyTo target={flyTarget} zoom={flyZoom} />

        {parcels.length > 0 && markers}
      </MapContainer>

      {showLayerControl && (
        <div className="absolute left-2.5 top-2.5 z-[1000] flex flex-col items-start gap-2">
          <MapControls
            layer={layer}
            onLayerChange={setLayer}
            basemap={basemap}
            onBasemapChange={setBasemap}
            showBoundaries={showBoundaries}
            onToggleBoundaries={setShowBoundaries}
          />
        </div>
      )}

      <div className="absolute right-2.5 top-2.5 z-[1000] flex flex-col items-end gap-2">
        {showLayerControl && <MapLegend layer={layer} />}
      </div>

      <div className="absolute bottom-2.5 left-2.5 z-[1000]">
        <FullscreenButton containerRef={containerRef} />
      </div>
    </div>
  );
}

export default memo(ParcelMap);
