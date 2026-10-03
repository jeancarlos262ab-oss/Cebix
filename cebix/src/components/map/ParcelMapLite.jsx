/**
 * ParcelMapLite — motor de mapas "ligero" (Leaflet).
 *
 * Alternativa a ParcelMapGL para equipos de bajos recursos: Leaflet dibuja
 * tiles como <img> normales sobre el DOM y no necesita WebGL, por lo que
 * consume muchísima menos GPU/CPU que MapLibre GL. Replica la misma API de
 * props y, en la medida de lo posible, la misma UI (capas, basemaps,
 * límites estatales, popup, controles) para que el cambio de motor sea
 * transparente para quien usa la app.
 *
 * No se renderiza directamente desde las páginas: lo selecciona
 * automáticamente ParcelMap.jsx según el dispositivo.
 */
import { LEFT_FADE_LENGTH, softFadeGradient } from "./edgeFade";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, GeoJSON } from "react-leaflet";
import { locationPinHtml, PIN_SIZE, PIN_TIP_OFFSET } from "./LocationPin";
import cebadaMapIcon from "../../assets/cebada_map.webp";
import LiteMapControls from "./LiteMapControls";
import { ExternalLink, Gauge, Leaf, Map as MapIcon, Milestone, Mountain, Satellite as SatelliteIcon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { openInGoogleMaps } from "../../utils/googleMaps";
import { getAccentHex } from "../../utils/accentColors";
import { lazySingleton } from "../../utils/singleton";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import RiskTrafficLight from "./RiskTrafficLight";
import "leaflet/dist/leaflet.css";
import { RISK_COLORS } from "../../utils/riskColors";

const RISK_HEX = RISK_COLORS;

/**
 * Mapas base del motor ligero. Los 4 son tiles raster PNG de Esri (misma
 * familia que Satelital/Terreno) — ninguno requiere API key. "Claro" y
 * "Oscuro" usaban antes CartoDB, pero CARTO empezó a exigir API key en
 * 2026, así que se reemplazaron por el equivalente gratuito de Esri
 * (Canvas/World_Light_Gray_Base y Canvas/World_Dark_Gray_Base).
 *
 * "Claro"/"Oscuro" ya NO se eligen a mano: el mapa base sigue el tema
 * general de la app (claro/oscuro/sistema definido en Ajustes). Sólo
 * "Satelital" y "Terreno" quedan como opciones manuales en la barra.
 */
/**
 * maxNativeZoom: nivel máximo en el que Esri tiene tiles reales. Más allá,
 * Leaflet escala el último nivel disponible en vez de pedir tiles que no
 * existen (que mostraban "Map data not yet available").
 */
const ESRI_ATTRIBUTION = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin";

const BASEMAPS_LITE = {
  satellite: {
    label: "Satelital",
    icon: SatelliteIcon,
    maxNativeZoom: 17,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics",
  },
  terreno: {
    label: "Terreno",
    icon: Mountain,
    maxNativeZoom: 16,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  claro: {
    label: "Mapa (claro)",
    maxNativeZoom: 16,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: ESRI_ATTRIBUTION,
  },
  oscuro: {
    label: "Mapa (oscuro)",
    maxNativeZoom: 16,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: ESRI_ATTRIBUTION,
  },
};

/** Botones manuales en la barra de basemaps. "Mapa" resuelve a claro/oscuro según el tema. */
const BASEMAP_BUTTONS = [
  { key: "satellite", label: "Satelital", icon: SatelliteIcon },
  { key: "terreno", label: "Terreno", icon: Mountain },
  { key: "theme", label: "Mapa (según tema)", icon: MapIcon },
];

export { BASEMAPS_LITE };

const LAYERS = [
  { key: "risk", label: "Semáforo de elegibilidad", icon: Gauge },
  { key: "ndvi", label: "Vigor NDVI", icon: Leaf },
];

const NDVI_LEGEND = [
  { color: "#3B7A4E", label: "NDVI ≥ 0.68 (vigor alto)" },
  { color: "#7CC192", label: "NDVI 0.55–0.68" },
  { color: "#D9A544", label: "NDVI 0.50–0.55" },
  { color: "#C0362E", label: "NDVI < 0.50 (estrés)" },
];

// Un único ícono de pin compartido por todos los mapas de todas las pantallas
// (antes se creaba uno nuevo en cada montaje).
const getPinIcon = lazySingleton(() =>
  L.divIcon({
    className: "",
    html: locationPinHtml(),
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE - PIN_TIP_OFFSET],
  })
);

const GROUND_LEVEL_ZOOM = 18;
const BASE_RADIUS = 9;

const HOVER_RADIUS = 11;
const SELECTED_RADIUS = 14;

function ndviToColor(ndvi) {
  if (ndvi >= 0.68) return "#3B7A4E";
  if (ndvi >= 0.55) return "#7CC192";
  if (ndvi >= 0.5) return "#D9A544";
  return "#C0362E";
}

function colorForParcel(parcel, colorMode) {
  if (colorMode === "ndvi") return ndviToColor(parcel.ndvi);
  if (parcel.riskColor && RISK_HEX[parcel.riskColor]) return RISK_HEX[parcel.riskColor];
  return RISK_COLORS.green;
}

/** Normaliza center a [lat, lng], aceptando array o {latitude, longitude}. */
function normalizeCenter(center) {
  if (Array.isArray(center)) return center;
  if (center && center.latitude !== undefined) return [center.latitude, center.longitude];
  return [19.9, -98.1];
}

const ToolbarIconButton = memo(function ToolbarIconButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        "flex h-8 w-8 items-center justify-center transition-colors rounded-full",
        active
          ? "bg-white/20 text-accent-400"
          : "text-accent-400 hover:bg-white/10 hover:text-accent-400",
      ].join(" ")}
    >
      <Icon size={16} />
    </button>
  );
});

function MapControlsPanel({
  viewOnly = false,
  layer,
  onLayerChange,
  basemap,
  onBasemapChange,
  showBoundaries,
  onToggleBoundaries,
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/85 p-1.5 text-gray-100 shadow-lg">
      {!viewOnly && (
        <>
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
        </>
      )}

      {BASEMAP_BUTTONS.map((b) => (
        <ToolbarIconButton
          key={b.key}
          icon={b.icon}
          label={b.label}
          active={b.key === "theme" ? basemap === "claro" || basemap === "oscuro" : basemap === b.key}
          onClick={() => onBasemapChange(b.key)}
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

const MapLegend = memo(function MapLegend({ layer }) {
  const items = NDVI_LEGEND;
  // Semáforo: flota directo sobre el mapa, sin contenedor ni título.
  if (layer !== "ndvi") return <RiskTrafficLight />;
  return (
    <div className="rounded-full border border-white/10 bg-black/85 px-4 py-3.5 text-gray-100 shadow-lg">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11px] text-gray-200">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * Componente de mapa de parcelas — motor ligero (Leaflet).
 *
 * Misma API de props que ParcelMapGL para poder intercambiarse sin tocar
 * las páginas que lo usan.
 *
 * @param {{
 *   parcels: Array,
 *   selectedId?: number,
 *   onSelect?: (parcel) => void,
 *   height?: number | string,
 *   center?: [number, number],
 *   zoom?: number,
 *   allowGroundView?: boolean,
 *   showLayerControl?: boolean,
 *   showLegend?: boolean,   // leyenda arriba a la derecha (por defecto igual que showLayerControl)
 *   showBoundariesByDefault?: boolean,
 *   viewOnly?: boolean,   // solo visualizar el lugar: sin capas de riesgo/NDVI y con pin en vez de círculo
 *   basemap?: "satellite" | "terreno",   // mapa base inicial; si se omite, sigue el tema de la app
 *   rounded?: boolean,    // true = esquinas redondeadas (los mapas nunca llevan borde)
 *   edgeFade?: boolean,   // desvanece el mapa hacia el fondo de la app solo en el borde izquierdo (lg+), con el color del tema; para el mapa satelital junto al sidebar
 *   controlsLeftClassName?: string,   // offset izquierdo de la barra de capas (por defecto "left-3")
 *   controlsTopClassName?: string,   // clase de Tailwind para el offset superior de la barra de capas (por defecto "top-3"); útil cuando algo del layout de la página, como un título, ya ocupa esa esquina.
 *   controlsOrientation?: "vertical" | "horizontal",   // dirección de la barra de zoom (por defecto "vertical")
 * }} props
 */
function ParcelMapLite({
  parcels,
  selectedId,
  onSelect,
  height = 420,
  center = [19.9, -98.1],
  zoom = 8,
  basemap: initialBasemap,
  allowGroundView = false,
  showLayerControl = true,
  showLegend = showLayerControl,
  showBoundariesByDefault = true,
  rounded = false,
  viewOnly = false,
  controlsTopClassName = "top-3",
  controlsLeftClassName = "left-3",
  edgeFade = false,
  controlsOrientation = "vertical",
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef(new Map());
  const selectedIdRef = useRef(null);

  const { resolvedTheme, accent } = useTheme();
  const accentHex = getAccentHex(accent, resolvedTheme);
  const boundaryStyle = useCallback(
    () => ({
      color: accentHex,
      weight: 2,
      opacity: 0.85,
      dashArray: "10,8",
      fillOpacity: 0,
    }),
    [accentHex]
  );
  // null = el basemap sigue el tema general de la app (claro/oscuro);
  // "satellite" | "terreno" = el usuario fijó uno manualmente en la barra.
  const [userBasemap, setUserBasemap] = useState(
    initialBasemap === "satellite" || initialBasemap === "terreno" ? initialBasemap : null
  );
  const basemap = userBasemap ?? (resolvedTheme === "dark" ? "oscuro" : "claro");
  const [layer, setLayer] = useState("risk");
  const [showBoundaries, setShowBoundaries] = useState(showBoundariesByDefault);

  const handleBasemapChange = useCallback((key) => {
    setUserBasemap(key === "theme" ? null : key);
  }, []);

  const pinIcon = getPinIcon();

  const initialCenter = useMemo(() => normalizeCenter(center), [center]);
  const basemapConfig = BASEMAPS_LITE[basemap] || BASEMAPS_LITE.satellite;

  const styleFor = useCallback(
    (parcel, { selected }) => ({
      color: "#ffffff",
      weight: selected ? 3 : 2,
      fillColor: colorForParcel(parcel, layer),
      fillOpacity: 0.9,
      radius: selected ? SELECTED_RADIUS : BASE_RADIUS,
    }),
    [layer]
  );

  const selectParcel = useCallback(
    (parcel, { flyTo = false } = {}) => {
      const previousId = selectedIdRef.current;
      if (previousId !== null && previousId !== parcel.id) {
        const prevMarker = markersRef.current.get(previousId);
        const prevParcel = parcels.find((p) => p.id === previousId);
        if (prevMarker && prevParcel) {
          prevMarker.setStyle(styleFor(prevParcel, { selected: false }));
        }
      }

      const marker = markersRef.current.get(parcel.id);
      if (marker) {
        marker.setStyle(styleFor(parcel, { selected: true }));
        marker.openPopup();
      }
      selectedIdRef.current = parcel.id;

      const map = mapRef.current;
      if (map && flyTo) {
        const targetZoom = Math.max(map.getZoom(), 12);
        map.flyTo([parcel.lat, parcel.lng], targetZoom, { duration: 0.6 });
      }
    },
    [parcels, styleFor]
  );

  useEffect(() => {
    if (selectedId === undefined || selectedId === null) return;
    const parcel = parcels.find((p) => p.id === selectedId);
    if (parcel) selectParcel(parcel, { flyTo: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, parcels]);

  const flyToParcel = useCallback((parcel) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([parcel.lat, parcel.lng], GROUND_LEVEL_ZOOM, { duration: 0.8 });
    onSelect?.(parcel);
  }, [onSelect]);

  const handleMarkerClick = useCallback(
    (parcel) => {
      selectParcel(parcel, { flyTo: false });
      onSelect?.(parcel);
    },
    [selectParcel, onSelect]
  );

  return (
    <div
      ref={containerRef}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className={`relative isolate w-full overflow-hidden bg-black ${rounded ? "rounded-2xl" : ""}`}
    >
      <MapContainer
        ref={mapRef}
        center={initialCenter}
        zoom={zoom}
        minZoom={5}
        maxZoom={19}
        zoomControl={false}
        attributionControl={false}
        dragging={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        touchZoom={true}
        keyboard={true}
        style={{ width: "100%", height: "100%", background: "#000" }}
      >
        <TileLayer
          key={basemap}
          url={basemapConfig.url}
          attribution={basemapConfig.attribution}
          maxZoom={19}
          maxNativeZoom={basemapConfig.maxNativeZoom}
        />

        {showBoundaries && (
          <GeoJSON key={accentHex} data={estadosBoundaries} style={boundaryStyle} />
        )}

        {viewOnly &&
          parcels?.map((parcel) => (
            <Marker key={parcel.id} position={[parcel.lat, parcel.lng]} icon={pinIcon} interactive={false} />
          ))}

        {!viewOnly &&
          parcels &&
          parcels.map((parcel) => (
            <CircleMarker
              key={`${parcel.id}-${layer}`}
              center={[parcel.lat, parcel.lng]}
              radius={parcel.id === selectedIdRef.current ? SELECTED_RADIUS : BASE_RADIUS}
              pathOptions={styleFor(parcel, { selected: parcel.id === selectedIdRef.current })}
              ref={(instance) => {
                if (instance) markersRef.current.set(parcel.id, instance);
                else markersRef.current.delete(parcel.id);
              }}
              eventHandlers={{
                click: () => handleMarkerClick(parcel),
                mouseover: (e) => {
                  if (selectedIdRef.current === parcel.id) return;
                  e.target.setRadius(HOVER_RADIUS);
                },
                mouseout: (e) => {
                  if (selectedIdRef.current === parcel.id) return;
                  e.target.setRadius(BASE_RADIUS);
                },
              }}
            >
              <Popup className="parcel-popup" offset={[0, -6]}>
                {/* Ojo: sin <p>. leaflet.css le pone margen a `.leaflet-popup-content p`
                    y pisa las utilidades de Tailwind. */}
                <div className="w-56 font-sans">
                  <div className="flex items-center gap-3">
                    <img
                      src={cebadaMapIcon}
                      alt=""
                      width={26}
                      height={44}
                      draggable={false}
                      className="h-11 w-auto shrink-0 select-none"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-snug text-white">{parcel.name}</div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {parcel.municipio}, {parcel.region}
                      </div>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-px border border-white/10 bg-white/10">
                    <div className="bg-black px-2.5 py-2">
                      <dt className="text-[11px] text-gray-400">Rendimiento</dt>
                      <dd className="mt-0.5 text-sm font-bold text-white">
                        {parcel.yieldEstimate.toFixed(1)}
                        <span className="ml-1 text-[11px] font-medium text-gray-400">ton/ha</span>
                      </dd>
                    </div>
                    <div className="bg-black px-2.5 py-2">
                      <dt className="text-[11px] text-gray-400">NDVI</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-white">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ndviToColor(parcel.ndvi) }}
                        />
                        {parcel.ndvi.toFixed(2)}
                      </dd>
                    </div>
                    <div className="col-span-2 bg-black px-2.5 py-2">
                      <dt className="text-[11px] text-gray-400">Elegibilidad</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: RISK_HEX[parcel.riskColor] ?? "#9ca3af" }}
                        />
                        {parcel.risk}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex gap-1.5">
                    {allowGroundView && (
                      <button
                        type="button"
                        onClick={() => flyToParcel(parcel)}
                        className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-gray-200"
                      >
                        Acercar a parcela
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openInGoogleMaps(parcel.lat, parcel.lng)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/10"
                    >
                      <ExternalLink size={12} className="text-accent-400" />
                      Google Maps
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        <LiteMapControls
          mapRef={mapRef}
          initialCenter={initialCenter}
          initialZoom={zoom}
          position="bottom-right"
          orientation={controlsOrientation}
          containerRef={containerRef}
        />
      </MapContainer>

      {edgeFade && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-900 hidden lg:block"
            style={{
              width: `calc(var(--sidebar-edge, 0px) + ${LEFT_FADE_LENGTH})`,
              background: softFadeGradient("to right", "var(--sidebar-edge, 0px)", LEFT_FADE_LENGTH),
            }}
          />
        </>
      )}

      {showLayerControl && (
        <div className={`absolute z-1000 flex flex-col items-start gap-2 ${controlsLeftClassName} ${controlsTopClassName}`}>
          <MapControlsPanel
            viewOnly={viewOnly}
            layer={layer}
            onLayerChange={setLayer}
            basemap={basemap}
            onBasemapChange={handleBasemapChange}
            showBoundaries={showBoundaries}
            onToggleBoundaries={setShowBoundaries}
          />
        </div>
      )}

      <div className="absolute right-3 top-3 z-1000 flex flex-col items-end gap-2">
        {showLegend && <MapLegend layer={layer} />}
      </div>
    </div>
  );
}

export default memo(ParcelMapLite);
