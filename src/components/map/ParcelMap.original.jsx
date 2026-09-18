import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { FullscreenControl, Layer, NavigationControl, Popup, Source } from "react-map-gl/maplibre";
import {
  Gauge,
  Leaf,
  Milestone,
  Mountain,
  Moon,
  Satellite as SatelliteIcon,
  Sun,
} from "lucide-react";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "maplibre-gl/dist/maplibre-gl.css";

const RISK_HEX = {
  green: "#16A34A",
  yellow: "#D97706",
  red: "#DC2626",
};

/**
 * Mapas base optimizados para bajos recursos.
 * PREFERIR RASTER (Esri) sobre VECTOR (CartoDB) para menor consumo de GPU.
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
    label: "Claro",
    icon: Sun,
    type: "vector",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  oscuro: {
    label: "Oscuro",
    icon: Moon,
    type: "vector",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
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

/**
 * Detecta si el dispositivo tiene recursos limitados.
 * Heurística basada en: GPU integrada antigua, CPU con ≤2 cores, falta de WebGL.
 */
function detectLowEndDevice() {
  try {
    // 1. Verificar disponibilidad de WebGL
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return true; // Sin WebGL → asumir limitado

    // 2. Obtener información del renderer GPU
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
      
      // Detectar GPUs integradas antiguas (Intel HD 2000-4000, etc.)
      const lowEndGPUs = [
        /intel.*hd graphics [2-4]\d{3}/i,
        /intel.*graphics media accelerator/i,
        /swiftshader/i, // Renderizador software
        /llvmpipe/i,    // Renderizador software Linux
      ];
      
      if (lowEndGPUs.some((pattern) => pattern.test(renderer))) {
        return true;
      }
    }

    // 3. Verificar número de cores de CPU
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      return true;
    }

    // 4. Verificar memoria disponible (si está disponible)
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
      return true;
    }

    return false;
  } catch (error) {
    console.warn("Error detectando capacidad del dispositivo:", error);
    return true; // En caso de error, asumir limitado por seguridad
  }
}

/**
 * Convierte array de parcelas a GeoJSON FeatureCollection.
 * Cada Feature incluye propiedades necesarias para renderizado y popups.
 */
function parcelsToGeoJSON(parcels, colorMode = "risk") {
  return {
    type: "FeatureCollection",
    features: parcels.map((parcel) => ({
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
        // Color calculado según modo
        color: colorMode === "ndvi" ? ndviToColor(parcel.ndvi) : RISK_HEX[parcel.riskColor],
      },
    })),
  };
}

/** Botón individual de la barra vertical */
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

/** Barra vertical de controles */
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

/** Leyenda flotante */
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
 * Componente de mapa optimizado para bajos recursos.
 * 
 * OPTIMIZACIONES APLICADAS:
 * 1. Marcadores renderizados como capa GeoJSON (WebGL) en lugar de HTML
 * 2. Restricción 2D estricta (sin pitch ni rotación)
 * 3. Animaciones adaptativas según hardware
 * 4. Mapa base raster por defecto (menor consumo GPU)
 * 5. Detección automática de hardware limitado
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
  allowGroundView = false, // ← OPTIMIZACIÓN: Deshabilitado por defecto
  showLayerControl = true,
  showBoundariesByDefault = true,
}) {
  const mapRef = useRef(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [hoveredParcelId, setHoveredParcelId] = useState(null);

  // Detectar hardware limitado una sola vez
  const isLowEnd = useMemo(() => detectLowEndDevice(), []);

  // Preferir mapa raster por defecto (Esri Satellite)
  const [basemap, setBasemap] = useState("satellite");
  const [layer, setLayer] = useState("risk");
  const [showBoundaries, setShowBoundaries] = useState(showBoundariesByDefault);

  // Normalizar centro
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

  // Convertir parcelas a GeoJSON (se recalcula cuando cambia la capa)
  const parcelGeoJSON = useMemo(
    () => parcelsToGeoJSON(parcels, layer),
    [parcels, layer]
  );

  // Navegar a una parcela (adaptativo según hardware)
  const flyToParcel = useCallback(
    (parcel) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const targetZoom = GROUND_LEVEL_ZOOM;
      const transitionConfig = {
        center: [parcel.lng, parcel.lat],
        zoom: targetZoom,
        // OPTIMIZACIÓN: Sin pitch ni bearing para mantener modo 2D
        pitch: 0,
        bearing: 0,
        essential: true,
      };

      // OPTIMIZACIÓN: Animación adaptativa
      if (isLowEnd) {
        // Hardware limitado: transición instantánea
        map.jumpTo(transitionConfig);
      } else {
        // Hardware moderno: animación suave pero corta
        map.flyTo({
          ...transitionConfig,
          duration: 800, // ← Reducido de 2000ms a 800ms
        });
      }

      onSelect?.(parcel);
    },
    [isLowEnd, onSelect]
  );

  // Navegar cuando cambia selectedId
  useEffect(() => {
    if (selectedId !== undefined && selectedId !== null) {
      const parcel = parcels.find((p) => p.id === selectedId);
      if (parcel) {
        const map = mapRef.current?.getMap();
        if (map) {
          const targetZoom = Math.max(map.getZoom(), 12);
          const transitionConfig = {
            center: [parcel.lng, parcel.lat],
            zoom: targetZoom,
            essential: true,
          };

          // OPTIMIZACIÓN: Animación adaptativa
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

  // Manejar click en capa de parcelas
  const handleMapClick = useCallback(
    (event) => {
      const feature = event.features?.[0];
      if (feature && feature.properties) {
        const parcelId = feature.properties.id;
        const parcel = parcels.find((p) => p.id === parcelId);
        if (parcel) {
          setPopupInfo(parcel);
          onSelect?.(parcel);
        }
      }
    },
    [parcels, onSelect]
  );

  // Manejar hover para resaltar parcela
  const handleMouseEnter = useCallback((event) => {
    const feature = event.features?.[0];
    if (feature) {
      setHoveredParcelId(feature.properties.id);
      const map = mapRef.current?.getMap();
      if (map) map.getCanvas().style.cursor = "pointer";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredParcelId(null);
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  // Estilo de capa de parcelas (círculos)
  const parcelLayerStyle = {
    id: "parcels-layer",
    type: "circle",
    paint: {
      // Color según propiedad
      "circle-color": ["get", "color"],
      
      // Tamaño según selección o hover
      "circle-radius": [
        "case",
        ["==", ["get", "id"], selectedId || -1],
        12, // Seleccionado
        ["==", ["get", "id"], hoveredParcelId || -1],
        10, // Hover
        9, // Normal
      ],
      
      // Stroke
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      
      // Opacidad
      "circle-opacity": 0.9,
    },
  };

  // Estilos de límites estatales
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
        
        // OPTIMIZACIÓN: Restricción 2D estricta
        maxPitch={0}
        pitch={0}
        dragRotate={false}
        pitchWithRotate={false}
        
        // Interacciones básicas habilitadas
        scrollZoom={true}
        doubleClickZoom={true}
        dragPan={true}
        keyboard={true}
        touchZoomRotate={true}
        touchPitch={false} // ← Deshabilitar pitch en móvil
        
        attributionControl={true}
        
        // Configurar capas interactivas
        interactiveLayerIds={["parcels-layer"]}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Control de navegación (solo zoom) */}
        <NavigationControl 
          position="bottom-right" 
          showCompass={false}  // ← Ocultar brújula (no hay rotación)
          visualizePitch={false}  // ← Ocultar indicador de pitch
        />

        {/* Control de pantalla completa */}
        <FullscreenControl position="bottom-right" />

        {/* Límites estatales GeoJSON */}
        {showBoundaries && (
          <Source id="state-boundaries" type="geojson" data={estadosBoundaries}>
            <Layer {...boundaryLineLayer} />
          </Source>
        )}

        {/* OPTIMIZACIÓN: Parcelas renderizadas como capa GeoJSON */}
        <Source id="parcels" type="geojson" data={parcelGeoJSON}>
          <Layer {...parcelLayerStyle} />
        </Source>

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
                  Acercar a parcela
                </button>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Controles personalizados */}
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

      {/* Indicador de modo de rendimiento (solo en desarrollo) */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-black/70 px-2 py-1 text-[10px] text-white backdrop-blur">
          {isLowEnd ? "🐌 Modo bajo consumo" : "🚀 Modo alto rendimiento"}
        </div>
      )}
    </div>
  );
}

export default memo(ParcelMap);
