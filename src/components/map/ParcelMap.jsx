import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { FullscreenControl, Layer, Marker, NavigationControl, Popup, Source } from "react-map-gl/maplibre";
import {
  Gauge,
  Leaf,
  Milestone,
  Mountain,
  Moon,
  Satellite as SatelliteIcon,
  Sun,
  Tags,
} from "lucide-react";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "maplibre-gl/dist/maplibre-gl.css";

const RISK_HEX = {
  green: "#16A34A",
  yellow: "#D97706",
  red: "#DC2626",
};

/**
 * Mapas base sin dependencias de APIs de pago.
 * Usa mapas libres de regalías de Esri y CartoDB.
 */
const BASEMAPS = {
  satellite: {
    label: "Satelital",
    icon: SatelliteIcon,
    // Esri World Imagery (raster tiles)
    style: {
      version: 8,
      sources: {
        "esri-imagery": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics",
        },
      },
      layers: [
        {
          id: "esri-imagery-layer",
          type: "raster",
          source: "esri-imagery",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  claro: {
    label: "Claro",
    icon: Sun,
    // CartoDB Positron (vector style)
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  oscuro: {
    label: "Oscuro",
    icon: Moon,
    // CartoDB Dark Matter (vector style)
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  terreno: {
    label: "Terreno",
    icon: Mountain,
    // Esri World Topo Map (raster tiles)
    style: {
      version: 8,
      sources: {
        "esri-topo": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri",
        },
      },
      layers: [
        {
          id: "esri-topo-layer",
          type: "raster",
          source: "esri-topo",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
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
    <div className="border border-white/10 bg-black/70 px-3 py-2.5 text-gray-100 shadow-card backdrop-blur">
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
 * Componente de mapa de parcelas agrícolas usando MapLibre GL JS.
 * 
 * Migrado desde react-leaflet a react-map-gl/maplibre para eliminar dependencias
 * de APIs de pago. Usa mapas base gratuitos de Esri y CartoDB.
 * 
 * @param {{
 *   parcels: Array<{id: number, name: string, lat: number, lng: number, riskColor: string, ndvi: number, municipio: string, region: string, yieldEstimate: number, risk: string}>,
 *   selectedId?: number,
 *   onSelect?: (parcel: Object) => void,
 *   height?: number | string,
 *   center?: [number, number] | { latitude: number, longitude: number },
 *   zoom?: number,
 *   allowGroundView?: boolean,
 *   showLayerControl?: boolean,
 *   showBoundariesByDefault?: boolean,
 * }} props
 */
function ParcelMap({
  parcels,
  selectedId,
  onSelect,
  height = 420,
  center = [19.9, -98.1],
  zoom = 8,
  allowGroundView = true,
  showLayerControl = true,
  showBoundariesByDefault = true,
}) {
  const mapRef = useRef(null);
  const [popupInfo, setPopupInfo] = useState(null);

  const [basemap, setBasemap] = useState("oscuro");
  const [layer, setLayer] = useState("risk");
  const [showBoundaries, setShowBoundaries] = useState(showBoundariesByDefault);

  // Normalizar el formato del centro ([lat, lng] o {latitude, longitude})
  const initialViewState = useMemo(() => {
    let lat, lng;
    if (Array.isArray(center)) {
      [lat, lng] = center;
    } else {
      lat = center.latitude;
      lng = center.longitude;
    }
    return {
      latitude: lat,
      longitude: lng,
      zoom,
    };
  }, [center, zoom]);

  const mapStyle = useMemo(() => BASEMAPS[basemap]?.style || BASEMAPS.oscuro.style, [basemap]);
  const ndviOverlay = layer === "ndvi";

  // Volar a una parcela con efecto 3D
  const flyToParcel = useCallback(
    (parcel) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      map.flyTo({
        center: [parcel.lng, parcel.lat],
        zoom: GROUND_LEVEL_ZOOM,
        pitch: allowGroundView ? 45 : 0,
        bearing: allowGroundView ? -17 : 0,
        duration: 2000,
        essential: true,
      });

      onSelect?.(parcel);
    },
    [allowGroundView, onSelect]
  );

  // Manejar click en marcador
  const handleMarkerClick = useCallback(
    (parcel) => {
      setPopupInfo(parcel);
      onSelect?.(parcel);
    },
    [onSelect]
  );

  // Volar a la parcela seleccionada cuando cambia selectedId
  useEffect(() => {
    if (selectedId !== undefined && selectedId !== null) {
      const parcel = parcels.find((p) => p.id === selectedId);
      if (parcel) {
        const map = mapRef.current?.getMap();
        if (map) {
          map.flyTo({
            center: [parcel.lng, parcel.lat],
            zoom: Math.max(map.getZoom(), 12),
            duration: 1100,
            essential: true,
          });
        }
      }
    }
  }, [selectedId, parcels]);

  // Renderizar marcadores
  const markers = useMemo(
    () =>
      parcels.map((parcel) => {
        const isSelected = selectedId === parcel.id;
        const color = ndviOverlay ? ndviToColor(parcel.ndvi) : RISK_HEX[parcel.riskColor];
        const size = isSelected ? 24 : 18;

        return (
          <Marker
            key={parcel.id}
            latitude={parcel.lat}
            longitude={parcel.lng}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(parcel);
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: color,
                border: "2px solid white",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title={parcel.name}
            />
          </Marker>
        );
      }),
    [parcels, selectedId, ndviOverlay, handleMarkerClick]
  );

  // Estilos de las capas de límites estatales (línea y relleno)
  const boundaryLineLayer = {
    id: "state-boundaries-line",
    type: "line",
    paint: {
      "line-color": "#F5D949",
      "line-width": 1.5,
      "line-opacity": 0.85,
      "line-dasharray": [5, 4],
    },
  };

  const boundaryFillLayer = {
    id: "state-boundaries-fill",
    type: "fill",
    paint: {
      "fill-color": "#F5D949",
      "fill-opacity": 0,
    },
  };

  return (
    <div
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className="relative w-full overflow-hidden border border-gray-200 bg-black dark:border-gray-800"
    >
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        minZoom={5}
        maxZoom={20}
        scrollZoom={true}
        doubleClickZoom={true}
        dragRotate={true}
        dragPan={true}
        keyboard={true}
        touchZoomRotate={true}
        touchPitch={true}
        attributionControl={true}
      >
        {/* Control de navegación (zoom, rotación, pitch) */}
        <NavigationControl position="bottom-right" showCompass={true} visualizePitch={true} />

        {/* Control de pantalla completa */}
        <FullscreenControl position="bottom-right" />

        {/* Límites estatales GeoJSON */}
        {showBoundaries && (
          <Source id="state-boundaries" type="geojson" data={estadosBoundaries}>
            <Layer {...boundaryLineLayer} />
            <Layer {...boundaryFillLayer} />
          </Source>
        )}

        {/* Marcadores de parcelas */}
        {markers}

        {/* Popup de información */}
        {popupInfo && (
          <Popup
            latitude={popupInfo.lat}
            longitude={popupInfo.lng}
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            anchor="bottom"
            offset={12}
            className="parcel-popup"
          >
            <div className="min-w-[170px] font-sans">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {popupInfo.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {popupInfo.municipio}, {popupInfo.region}
              </p>
              <div className="mt-1.5 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                <p>Rendimiento: {popupInfo.yieldEstimate.toFixed(1)} ton/ha</p>
                <p>NDVI: {popupInfo.ndvi.toFixed(2)}</p>
                <p>Elegibilidad: {popupInfo.risk}</p>
              </div>
              {allowGroundView && (
                <button
                  type="button"
                  onClick={() => flyToParcel(popupInfo)}
                  className="mt-2 flex items-center gap-1.5 bg-gray-900 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  <SatelliteIcon size={12} />
                  Ver el terreno real
                </button>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Controles personalizados (capas, mapas base, límites) */}
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

      {/* Leyenda */}
      <div className="absolute right-2.5 top-2.5 z-[1000] flex flex-col items-end gap-2">
        {showLayerControl && <MapLegend layer={layer} />}
      </div>
    </div>
  );
}

export default memo(ParcelMap);
