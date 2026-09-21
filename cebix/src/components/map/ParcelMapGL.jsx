/**
 * ParcelMapGL — motor de mapas "completo" (MapLibre GL / WebGL).
 *
 * Este es el mapa original, pensado para equipos con GPU decente. NO se usa
 * directamente desde las páginas: se renderiza a través de ParcelMap.jsx,
 * que decide automáticamente si cargar este motor o el motor ligero
 * (ParcelMapLite.jsx, basado en Leaflet) según los recursos del dispositivo.
 * No se debe borrar ni reemplazar este archivo: sigue siendo el mapa para
 * laptops/PCs potentes.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Popup, Source } from "react-map-gl/maplibre";
import LocationPin, { PIN_TIP_OFFSET } from "./LocationPin";
import CustomMapControls from "./CustomMapControls";
import { Gauge, Leaf, Map as MapIcon, Milestone, Mountain, Satellite as SatelliteIcon } from "lucide-react";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import { detectLowEndDevice } from "../../utils/mapDevice";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import "maplibre-gl/dist/maplibre-gl.css";

const RISK_HEX = {
  green: "#16A34A",
  yellow: "#D97706",
  red: "#DC2626",
};

/**
 * Mapas base disponibles en el motor GL.
 * Los 4 usan tiles rasterizados de Esri (World_Imagery, World_Topo_Map,
 * Canvas/World_Light_Gray_Base, Canvas/World_Dark_Gray_Base) — ninguno
 * requiere API key. Antes "Claro"/"Oscuro" usaban estilos vectoriales de
 * CartoDB, pero CARTO empezó a exigir API key en 2026, así que se
 * reemplazaron por el equivalente de Esri.
 *
 * "Claro"/"Oscuro" ya NO se eligen a mano: el mapa base sigue el tema
 * general de la app (definido en Ajustes). Sólo "Satelital" y "Terreno"
 * quedan como opciones manuales en la barra.
 */
const BASEMAPS = {
  satellite: {
    label: "Satelital",
    icon: SatelliteIcon,
    type: "raster",
    style: {
      version: 8,
      sources: {
        "esri-imagery": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 17, // sobre-zoom cuando Esri no tiene tiles más cercanos
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
  terreno: {
    label: "Terreno",
    icon: Mountain,
    type: "raster",
    style: {
      version: 8,
      sources: {
        "esri-topo": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 16, // sobre-zoom cuando Esri no tiene tiles más cercanos
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
  claro: {
    label: "Mapa (claro)",
    type: "raster",
    style: {
      version: 8,
      sources: {
        "esri-gray-light": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 16, // sobre-zoom cuando Esri no tiene tiles más cercanos
          attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin",
        },
      },
      layers: [
        {
          id: "esri-gray-light-layer",
          type: "raster",
          source: "esri-gray-light",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  oscuro: {
    label: "Mapa (oscuro)",
    type: "raster",
    style: {
      version: 8,
      sources: {
        "esri-gray-dark": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 16, // sobre-zoom cuando Esri no tiene tiles más cercanos
          attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin",
        },
      },
      layers: [
        {
          id: "esri-gray-dark-layer",
          type: "raster",
          source: "esri-gray-dark",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
};

/** Botones manuales en la barra de basemaps. "Mapa" resuelve a claro/oscuro según el tema. */
const BASEMAP_BUTTONS = [
  { key: "satellite", label: "Satelital", icon: SatelliteIcon },
  { key: "terreno", label: "Terreno", icon: Mountain },
  { key: "theme", label: "Mapa (según tema)", icon: MapIcon },
];

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

/**
 * Calcula el color de NDVI según el rango.
 */
function ndviToColor(ndvi) {
  if (ndvi >= 0.68) return "#3B7A4E";
  if (ndvi >= 0.55) return "#7CC192";
  if (ndvi >= 0.5) return "#D9A544";
  return "#C0362E";
}

/**
 * Convierte parcelas a GeoJSON FeatureCollection.
 */
function parcelsToGeoJSON(parcels, colorMode = "risk") {
  if (!parcels || parcels.length === 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  return {
    type: "FeatureCollection",
    features: parcels.map((parcel) => {
      let color = "#16A34A";

      if (colorMode === "ndvi") {
        color = ndviToColor(parcel.ndvi);
      } else if (parcel.riskColor && RISK_HEX[parcel.riskColor]) {
        color = RISK_HEX[parcel.riskColor];
      }

      return {
        type: "Feature",
        id: parcel.id,
        geometry: {
          type: "Point",
          coordinates: [parcel.lng, parcel.lat],
        },
        properties: {
          id: parcel.id,
          name: parcel.name,
          municipio: parcel.municipio,
          region: parcel.region,
          yieldEstimate: parcel.yieldEstimate,
          ndvi: parcel.ndvi,
          risk: parcel.risk,
          riskColor: parcel.riskColor,
          color: color,
        },
      };
    }),
  };
}

/**
 * Botón individual de la barra lateral.
 */
const ToolbarIconButton = memo(function ToolbarIconButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        "flex h-8 w-8 items-center justify-center transition-colors rounded",
        active
          ? "bg-gray-200 text-gray-900 dark:bg-white/20 dark:text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white",
      ].join(" ")}
    >
      <Icon size={16} />
    </button>
  );
});

/**
 * Barra vertical de controles del mapa.
 */
function MapControls({
  viewOnly = false,
  layer,
  onLayerChange,
  basemap,
  onBasemapChange,
  showBoundaries,
  onToggleBoundaries,
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded border border-gray-200 bg-white/90 dark:border-white/10 dark:bg-black/70 p-1.5 text-gray-800 shadow-lg dark:text-gray-100 backdrop-blur">
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

          <div className="my-1 h-px w-6 bg-gray-200 dark:bg-white/10" aria-hidden="true" />
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

      <div className="my-1 h-px w-6 bg-gray-200 dark:bg-white/10" aria-hidden="true" />

      <ToolbarIconButton
        icon={Milestone}
        label="Límites estatales"
        active={showBoundaries}
        onClick={() => onToggleBoundaries(!showBoundaries)}
      />
    </div>
  );
}

/**
 * Leyenda flotante que muestra los colores y significados.
 */
const MapLegend = memo(function MapLegend({ layer }) {
  const items = layer === "ndvi" ? NDVI_LEGEND : RISK_LEGEND;
  return (
    <div className="rounded border border-gray-200 bg-white/90 dark:border-white/10 dark:bg-black/70 px-3 py-2.5 text-gray-800 shadow-lg dark:text-gray-100 backdrop-blur">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-200">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * Componente de mapa de parcelas optimizado para rendimiento.
 *
 * Características:
 * - Renderizado de parcelas como capas GeoJSON (WebGL)
 * - Modo 2D estricto (sin pitch ni rotación)
 * - Animaciones adaptativas según hardware
 * - Detección automática de dispositivos con bajos recursos
 * - Interfaz profesional e institucional
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
 *   bordered?: boolean,   // false = sin borde, para pegarlo a las líneas de la página
 * }} props
 */
function ParcelMapGL({
  parcels,
  selectedId,
  onSelect,
  height = 420,
  center = [19.9, -98.1],
  zoom = 8,
  allowGroundView = false,
  showLayerControl = true,
  showLegend = showLayerControl,
  showBoundariesByDefault = true,
  bordered = true,
  viewOnly = false,
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [hoveredParcelId, setHoveredParcelId] = useState(null);
  const previouslyClickedRef = useRef(null);

  const isLowEnd = useMemo(() => detectLowEndDevice(), []);
  const { resolvedTheme, accent } = useTheme();
  const accentHex = getAccentHex(accent, resolvedTheme);
  // null = el basemap sigue el tema general de la app (claro/oscuro);
  // "satellite" | "terreno" = el usuario fijó uno manualmente en la barra.
  const [userBasemap, setUserBasemap] = useState(null);
  const basemap = userBasemap ?? (resolvedTheme === "dark" ? "oscuro" : "claro");
  const [layer, setLayer] = useState("risk");
  const [showBoundaries, setShowBoundaries] = useState(showBoundariesByDefault);

  const handleBasemapChange = useCallback((key) => {
    setUserBasemap(key === "theme" ? null : key);
  }, []);

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

  const mapStyle = useMemo(() => BASEMAPS[basemap]?.style || BASEMAPS.satellite.style, [basemap]);

  const parcelGeoJSON = useMemo(() => parcelsToGeoJSON(parcels, layer), [parcels, layer]);

  const flyToParcel = useCallback(
    (parcel) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const targetZoom = GROUND_LEVEL_ZOOM;
      const transitionConfig = {
        center: [parcel.lng, parcel.lat],
        zoom: targetZoom,
        pitch: 0,
        bearing: 0,
        essential: true,
      };

      if (isLowEnd) {
        map.jumpTo(transitionConfig);
      } else {
        map.flyTo({
          ...transitionConfig,
          duration: 800,
        });
      }

      onSelect?.(parcel);
    },
    [isLowEnd, onSelect]
  );

  useEffect(() => {
    if (selectedId !== undefined && selectedId !== null) {
      const parcel = parcels.find((p) => p.id === selectedId);
      if (parcel) {
        const map = mapRef.current?.getMap();
        if (map) {
          // Limpiar estado anterior
          if (previouslyClickedRef.current !== null && previouslyClickedRef.current !== selectedId) {
            map.setFeatureState(
              { source: "parcels", id: previouslyClickedRef.current },
              { clicked: false }
            );
          }

          // Establecer nuevo estado
          map.setFeatureState({ source: "parcels", id: selectedId }, { clicked: true });
          previouslyClickedRef.current = selectedId;

          const targetZoom = Math.max(map.getZoom(), 12);
          const transitionConfig = {
            center: [parcel.lng, parcel.lat],
            zoom: targetZoom,
            essential: true,
          };

          if (isLowEnd) {
            map.jumpTo(transitionConfig);
          } else {
            map.flyTo({
              ...transitionConfig,
              duration: 600,
            });
          }
        }
      }
    }
  }, [selectedId, parcels, isLowEnd]);

  const handleMapClick = useCallback(
    (event) => {
      if (!event.features || event.features.length === 0) return;

      const feature = event.features[0];
      if (feature && feature.geometry.type === "Point") {
        const parcelId = feature.id;
        const parcel = parcels.find((p) => p.id === parcelId);

        if (parcel) {
          setPopupInfo(parcel);
          onSelect?.(parcel);

          const map = mapRef.current?.getMap();
          if (map) {
            if (previouslyClickedRef.current !== null && previouslyClickedRef.current !== parcelId) {
              map.setFeatureState(
                { source: "parcels", id: previouslyClickedRef.current },
                { clicked: false }
              );
            }

            map.setFeatureState({ source: "parcels", id: parcelId }, { clicked: true });
            previouslyClickedRef.current = parcelId;
          }
        }
      }
    },
    [parcels, onSelect]
  );

  const handleMouseEnter = useCallback((event) => {
    if (!event.features || event.features.length === 0) return;

    const feature = event.features[0];
    if (feature && feature.geometry.type === "Point") {
      setHoveredParcelId(feature.id);

      const map = mapRef.current?.getMap();
      if (map) {
        map.getCanvas().style.cursor = "pointer";
        map.setFeatureState({ source: "parcels", id: feature.id }, { hover: true });
      }
    }
  }, []);

  const handleMouseLeave = useCallback((event) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      if (feature && feature.geometry.type === "Point") {
        const map = mapRef.current?.getMap();
        if (map) {
          map.setFeatureState({ source: "parcels", id: feature.id }, { hover: false });
        }
      }
    }

    setHoveredParcelId(null);
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  // Estilo de la capa de parcelas
  const parcelLayerStyle = {
    id: "parcels-layer",
    type: "circle",
    paint: {
      "circle-color": ["get", "color"],

      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "clicked"], false],
        14,
        ["boolean", ["feature-state", "hover"], false],
        11,
        9,
      ],

      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": [
        "case",
        ["boolean", ["feature-state", "clicked"], false],
        3,
        2,
      ],

      "circle-opacity": 0.9,
      "circle-stroke-opacity": 1,
    },
  };

  // Estilo de límites estatales
  const boundaryLineLayer = {
    id: "state-boundaries-line",
    type: "line",
    paint: {
      "line-color": accentHex,
      "line-width": 1.5,
      "line-opacity": 0.85,
      "line-dasharray": [5, 4],
    },
  };

  return (
    <div
      ref={containerRef}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className={`relative isolate w-full overflow-hidden bg-black ${bordered ? "border border-gray-200 dark:border-gray-800" : ""}`}
    >
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        minZoom={5}
        maxZoom={20}
        maxPitch={0}
        pitch={0}
        dragRotate={false}
        pitchWithRotate={false}
        scrollZoom={true}
        doubleClickZoom={true}
        dragPan={true}
        keyboard={true}
        touchZoomRotate={true}
        touchPitch={false}
        attributionControl={false}
        interactiveLayerIds={viewOnly ? [] : ["parcels-layer"]}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Controles personalizados del mapa */}
        <CustomMapControls
          mapRef={mapRef}
          initialCenter={center}
          initialZoom={zoom}
          position="bottom-right"
          containerRef={containerRef}
        />

        {showBoundaries && (
          <Source id="state-boundaries" type="geojson" data={estadosBoundaries}>
            <Layer {...boundaryLineLayer} />
          </Source>
        )}

        {viewOnly &&
          parcels?.map((parcel) => (
            <Marker
              key={parcel.id}
              latitude={parcel.lat}
              longitude={parcel.lng}
              anchor="bottom"
              offset={[0, PIN_TIP_OFFSET]}
            >
              <LocationPin />
            </Marker>
          ))}

        {!viewOnly && parcels && parcels.length > 0 && (
          <Source id="parcels" type="geojson" data={parcelGeoJSON}>
            <Layer {...parcelLayerStyle} />
          </Source>
        )}

        {!viewOnly && popupInfo && (
          <Popup
            latitude={popupInfo.lat}
            longitude={popupInfo.lng}
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            anchor="bottom"
            offset={16}
            className="parcel-popup"
          >
            <div className="w-max font-sans">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {popupInfo.name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {popupInfo.municipio}, {popupInfo.region}
              </p>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>
                  <span className="font-medium">Rendimiento:</span> {popupInfo.yieldEstimate.toFixed(1)} ton/ha
                </p>
                <p>
                  <span className="font-medium">NDVI:</span> {popupInfo.ndvi.toFixed(2)}
                </p>
                <p>
                  <span className="font-medium">Elegibilidad:</span> {popupInfo.risk}
                </p>
              </div>
              {allowGroundView && (
                <button
                  type="button"
                  onClick={() => flyToParcel(popupInfo)}
                  className="mt-3 w-full rounded bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Acercar a parcela
                </button>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {showLayerControl && (
        <div className="absolute left-3 top-3 z-[1000] flex flex-col items-start gap-2">
          <MapControls
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

      <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        {showLegend && <MapLegend layer={layer} />}
      </div>
    </div>
  );
}

export default memo(ParcelMapGL);
