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
import { LEFT_FADE_LENGTH, softFadeGradient } from "./edgeFade";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Popup, Source } from "react-map-gl/maplibre";
import LocationPin, { PIN_TIP_OFFSET } from "./LocationPin";
import CustomMapControls from "./CustomMapControls";
import { ExternalLink, Gauge, Leaf, Map as MapIcon, Milestone, Moon, Mountain, Satellite as SatelliteIcon } from "lucide-react";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import { detectLowEndDevice } from "../../utils/mapDevice";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { openInGoogleMaps } from "../../utils/googleMaps";
import RiskTrafficLight from "./RiskTrafficLight";
import "maplibre-gl/dist/maplibre-gl.css";
import { RISK_COLORS } from "../../utils/riskColors";

const RISK_HEX = RISK_COLORS;

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
          // Sin fundido entre teselas: durante el fundido la tesela nueva se mezcla con la
          // vecina/padre y deja una línea clara en cada borde (la "cuadrícula" del mapa).
          paint: { "raster-fade-duration": 0, "raster-opacity": 1 },
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
          // Sin fundido entre teselas: durante el fundido la tesela nueva se mezcla con la
          // vecina/padre y deja una línea clara en cada borde (la "cuadrícula" del mapa).
          paint: { "raster-fade-duration": 0, "raster-opacity": 1 },
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
          // Sin fundido entre teselas: durante el fundido la tesela nueva se mezcla con la
          // vecina/padre y deja una línea clara en cada borde (la "cuadrícula" del mapa).
          paint: { "raster-fade-duration": 0, "raster-opacity": 1 },
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
          // Sin fundido entre teselas: durante el fundido la tesela nueva se mezcla con la
          // vecina/padre y deja una línea clara en cada borde (la "cuadrícula" del mapa).
          paint: { "raster-fade-duration": 0, "raster-opacity": 1 },
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
  { key: "oscuro", label: "Oscuro", icon: Moon },
];

export { BASEMAPS };

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

const GROUND_LEVEL_ZOOM = 18;

/** Vuelo suave: más largo cuanto más zoom hay que recorrer, con arranque y llegada suaves y sin alejarse primero. */
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function smoothFlight(map, targetZoom) {
  const dz = Math.abs(targetZoom - map.getZoom());
  return {
    duration: Math.min(1800, 700 + dz * 130),
    curve: 1.1,
    easing: easeInOutCubic,
  };
}

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
      let color = RISK_COLORS.green;

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
        "flex h-8 w-8 items-center justify-center transition-colors rounded-md",
        active
          ? "bg-white/20 text-white"
          : "text-gray-200 hover:bg-white/10",
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
  basemapKeys,
  showBoundaries,
  onToggleBoundaries,
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-white/15 bg-black/90 p-1 text-gray-100">
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

          <div className="my-0.5 h-px w-6 bg-white/15" aria-hidden="true" />
        </>
      )}

      {BASEMAP_BUTTONS.filter((b) => (basemapKeys ? basemapKeys.includes(b.key) : b.key !== "oscuro")).map((b) => (
        <ToolbarIconButton
          key={b.key}
          icon={b.icon}
          label={b.label}
          active={b.key === "theme" ? basemap === "claro" || basemap === "oscuro" : basemap === b.key}
          onClick={() => onBasemapChange(b.key)}
        />
      ))}

      <div className="my-0.5 h-px w-6 bg-white/15" aria-hidden="true" />

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
  const items = NDVI_LEGEND;
  // Semáforo: flota directo sobre el mapa, sin contenedor ni título.
  if (layer !== "ndvi") return <RiskTrafficLight />;
  return (
    <div className="rounded-lg border border-white/15 bg-black/90 px-3.5 py-3 text-gray-100">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11px] text-gray-200">
            <span className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ backgroundColor: item.color }} />
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
 *   showPopup?: boolean,   // false = no abre el popup al tocar una parcela (la página muestra su propio detalle)
 *   viewOnly?: boolean,   // solo visualizar el lugar: sin capas de riesgo/NDVI y con pin en vez de círculo
 *   rounded?: boolean,    // true = esquinas redondeadas (los mapas nunca llevan borde)
 *   edgeFade?: boolean,   // desvanece el mapa hacia el fondo de la app solo en el borde izquierdo (lg+), con el color del tema; para el mapa satelital junto al sidebar
 *   controlsLeftClassName?: string,   // offset izquierdo de la barra de capas (por defecto "left-3")
 *   controlsTopClassName?: string,   // clase de Tailwind para el offset superior de la barra de capas (por defecto "top-3"); útil cuando algo del layout de la página, como un título, ya ocupa esa esquina.
 *   basemapKeys?: string[],   // botones de mapa base a mostrar (por defecto: satelital, terreno y mapa según tema)
 *   zoomClassName?: string,   // clases extra para reubicar la barra de zoom
 *   controlsOrientation?: "vertical" | "horizontal",   // dirección de la barra de zoom (por defecto "vertical")
 *   basemap?: "satellite" | "terreno",   // mapa base inicial; si se omite, sigue el tema de la app
 * }} props
 */
function ParcelMapGL({
  parcels,
  selectedId,
  onSelect,
  showPopup = true,
  height = 420,
  center = [19.9, -98.1],
  zoom = 8,
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
  zoomClassName = "",
  basemapKeys,
  basemap: initialBasemap,
  onWebGLError,
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
  const [userBasemap, setUserBasemap] = useState(
    initialBasemap === "satellite" || initialBasemap === "terreno" ? initialBasemap : null
  );
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
          ...smoothFlight(map, transitionConfig.zoom),
        });
      }

      onSelect?.(parcel);
    },
    [isLowEnd, onSelect]
  );

  useEffect(() => {
    if (selectedId === undefined || selectedId === null) {
      // Se cerró el detalle: quita el resaltado de la parcela que estaba seleccionada.
      const map = mapRef.current?.getMap();
      if (map && previouslyClickedRef.current !== null) {
        try {
          map.setFeatureState({ source: "parcels", id: previouslyClickedRef.current }, { clicked: false });
        } catch {
          /* la fuente aún no existe: no hay nada que limpiar */
        }
        previouslyClickedRef.current = null;
      }
      return;
    }
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
              ...smoothFlight(map, transitionConfig.zoom),
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

      // El radio crece con el zoom: de lejos los puntos son pequeños (no se amontonan en manchas
      // enormes) y al acercarse llegan a su tamaño normal de forma gradual.
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        ["case", ["boolean", ["feature-state", "clicked"], false], 6, ["boolean", ["feature-state", "hover"], false], 5, 3.5],
        8,
        ["case", ["boolean", ["feature-state", "clicked"], false], 9, ["boolean", ["feature-state", "hover"], false], 8, 6],
        12,
        ["case", ["boolean", ["feature-state", "clicked"], false], 14, ["boolean", ["feature-state", "hover"], false], 11, 9],
      ],

      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        1,
        12,
        ["case", ["boolean", ["feature-state", "clicked"], false], 3, 2],
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
      "line-width": 2,
      "line-opacity": 0.85,
      "line-dasharray": [5, 4],
    },
  };

  return (
    <div
      ref={containerRef}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className={`relative isolate w-full overflow-hidden bg-black ${rounded ? "rounded-2xl" : ""}`}
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
        fadeDuration={0}
        interactiveLayerIds={viewOnly ? [] : ["parcels-layer"]}
        onError={(e) => {
          // Sin WebGL (o contexto no disponible): avisa para que ParcelMap cambie a Leaflet.
          const message = String(e?.error?.message ?? e?.originalEvent?.message ?? e?.message ?? "");
          if (/webgl/i.test(message)) onWebGLError?.();
        }}
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
          orientation={controlsOrientation}
          className={zoomClassName}
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

        {!viewOnly && showPopup && popupInfo && (
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
              <p className="text-sm font-semibold text-white">
                {popupInfo.name}
              </p>
              <p className="text-xs text-gray-400">
                {popupInfo.municipio}, {popupInfo.region}
              </p>
              <div className="mt-2 space-y-1 text-xs text-gray-300">
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
              <div className="mt-3 flex gap-1.5">
                {allowGroundView && (
                  <button
                    type="button"
                    onClick={() => flyToParcel(popupInfo)}
                    className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-gray-200"
                  >
                    Acercar a parcela
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openInGoogleMaps(popupInfo.lat, popupInfo.lng)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border border-white/20 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10"
                >
                  <ExternalLink size={12} className="text-gray-400" />
                  Google Maps
                </button>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {edgeFade && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-5 hidden lg:block"
            style={{
              width: `calc(var(--sidebar-edge, 0px) + ${LEFT_FADE_LENGTH})`,
              background: softFadeGradient("to right", "var(--sidebar-edge, 0px)", LEFT_FADE_LENGTH),
            }}
          />
        </>
      )}

      {showLayerControl && (
        <div className={`absolute z-1000 flex flex-col items-start gap-2 ${controlsLeftClassName} ${controlsTopClassName}`}>
          <MapControls
            viewOnly={viewOnly}
            layer={layer}
            onLayerChange={setLayer}
            basemap={basemap}
            onBasemapChange={handleBasemapChange}
            basemapKeys={basemapKeys}
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

export default memo(ParcelMapGL);
