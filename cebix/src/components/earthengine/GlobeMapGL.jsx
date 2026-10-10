import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Crosshair, Pencil } from "lucide-react";
import MapControls from "./MapControls";
import { GHOST, PANEL, PRIMARY, STATUS } from "./mapUi";
import { usePageActive } from "../../context/PageActiveContext";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { estadoBounds } from "../../utils/polygon";
import { ESTADOS } from "../../data/earthEngine";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Globo 3D con MapLibre GL (proyección "globe"). Se usa en equipos que aceptan WebGL con
 * aceleración; en los demás GeometryMap sigue usando el globo ligero de Canvas 2D (GlobeMap.jsx).
 * Mantiene exactamente las mismas props que GlobeMap para poder intercambiarlos.
 *
 * @param entry    {key, lat, lon, zoom?}  cada vez que `key` cambia (y el globo está activo) repite la
 *                 animación de entrada; si zoom > 1 hace un "alejar" suave desde ese punto
 * @param active   false mientras el mapa plano está al frente: el globo se queda montado pero en pausa
 * @param onEnter  (bounds, draw, isStudyZone) => void  al terminar el vuelo hacia la zona elegida
 * @param onFail   () => void  si MapLibre GL no pudo arrancar o se perdió el contexto WebGL
 */

const STUDY_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];
const STUDY = { lat: 19.6, lon: -98.1 };
const REST_ZOOM = 1.6; // planeta completo, flotando en el espacio
const BACK_ZOOM = 6; // punto de partida del "alejar" al volver del mapa plano
const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// Los límites de la app son [[s,w],[n,e]]; MapLibre usa [[w,s],[e,n]].
const toLngLatBounds = (b) => [
  [b[0][1], b[0][0]],
  [b[1][1], b[1][0]],
];

const STYLE = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    imagery: {
      type: "raster",
      tiles: [ESRI_IMAGERY],
      tileSize: 256,
      maxzoom: 17,
    },
  },
  sky: {
    "sky-color": "#04101f",
    "horizon-color": "#3d7fc4",
    "fog-color": "#000000",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.2,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#000" } },
    {
      id: "imagery",
      type: "raster",
      source: "imagery",
      paint: { "raster-fade-duration": 0 },
    },
  ],
};

/** Pin de la zona de estudio (elemento DOM para el Marker). */
function createPinElement(color) {
  const root = document.createElement("div");
  root.style.cssText = "position:relative;width:16px;height:16px;cursor:pointer";
  root.setAttribute("role", "button");
  root.setAttribute("aria-label", "Zona de estudio: Hidalgo, Puebla y Tlaxcala");

  const dot = document.createElement("div");
  dot.dataset.role = "dot";
  dot.style.cssText = `position:absolute;inset:0;border-radius:50%;border:1.5px solid ${color};background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center`;
  const core = document.createElement("div");
  core.dataset.role = "core";
  core.style.cssText = `width:5px;height:5px;border-radius:50%;background:${color}`;
  dot.appendChild(core);

  const label = document.createElement("div");
  label.textContent = "Hidalgo · Puebla · Tlaxcala";
  label.style.cssText =
    "position:absolute;left:26px;top:-3px;white-space:nowrap;padding:3px 8px;border-radius:4px;background:rgba(0,0,0,.78);color:#fff;font:500 12px system-ui,sans-serif;line-height:16px";

  root.append(dot, label);
  return root;
}

function paintPin(el, color) {
  const dot = el.querySelector('[data-role="dot"]');
  const core = el.querySelector('[data-role="core"]');
  if (dot) dot.style.borderColor = color;
  if (core) core.style.background = color;
}

export default function GlobeMapGL({ entry, active = true, onEnter, onFail, isFullscreen, onToggleFullscreen }) {
  const wrapRef = useRef(null);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const busyRef = useRef(false);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  const pageActive = usePageActive() && active;
  const { accent, resolvedTheme } = useTheme();
  const color = getAccentHex(accent, resolvedTheme === "dark" ? "dark" : "light");
  const colorRef = useRef(color);
  colorRef.current = color;

  const [ready, setReady] = useState(false);
  const [tilesError, setTilesError] = useState(false);
  const [busy, setBusy] = useState(false);

  const setBusyBoth = useCallback((v) => {
    busyRef.current = v;
    setBusy(v);
    const m = mapRef.current;
    if (!m) return;
    const fn = v ? "disable" : "enable";
    m.dragPan[fn]();
    m.scrollZoom[fn]();
    m.doubleClickZoom[fn]();
    m.touchZoomRotate[fn]();
    if (!v) m.touchZoomRotate.disableRotation();
  }, []);

  /* ───────────── creación del mapa (una sola vez) ───────────── */
  useEffect(() => {
    let map;
    try {
      map = new maplibregl.Map({
        container: mapEl.current,
        style: STYLE,
        center: [STUDY.lon, STUDY.lat],
        zoom: REST_ZOOM,
        minZoom: 0.8,
        maxZoom: 12,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        canvasContextAttributes: { antialias: true, failIfMajorPerformanceCaveat: true },
      });
    } catch (err) {
      console.warn("MapLibre GL no pudo iniciar el globo:", err);
      onFailRef.current?.();
      return undefined;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();

    map.on("load", () => {
      map.addSource("estados", { type: "geojson", data: estadosBoundaries });
      map.addLayer({
        id: "estados-line",
        type: "line",
        source: "estados",
        paint: { "line-color": colorRef.current, "line-width": 1.2 },
      });
      setReady(true);
    });

    // Marcas de error de teselas (sin conexión o bloqueadas) y pérdida del contexto WebGL.
    map.on("error", (e) => {
      if (e?.sourceId === "imagery") setTilesError(true);
    });
    map.on("data", (e) => {
      if (e.sourceId === "imagery" && e.tile) setTilesError(false);
    });
    const canvas = map.getCanvas();
    const onLost = (ev) => {
      ev.preventDefault();
      onFailRef.current?.();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    // Pin de la zona de estudio
    const el = createPinElement(colorRef.current);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      enterRef.current?.(STUDY_BOUNDS);
    });
    pinRef.current = el;
    new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([STUDY.lon, STUDY.lat]).addTo(map);

    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, []);

  // El color de acento sigue al tema.
  useEffect(() => {
    const m = mapRef.current;
    if (m?.getLayer("estados-line")) m.setPaintProperty("estados-line", "line-color", color);
    if (pinRef.current) paintPin(pinRef.current, color);
  }, [color, ready]);

  /* ───────────── vuelos ───────────── */
  const enter = useCallback(
    (bounds, draw = false) => {
      const m = mapRef.current;
      if (!m || busyRef.current) return;
      setBusyBoth(true);
      const finish = () => onEnterRef.current?.(bounds, draw, bounds === STUDY_BOUNDS);
      m.fitBounds(toLngLatBounds(bounds), {
        padding: 40,
        maxZoom: 9,
        duration: reducedMotion() ? 0 : 1100,
        essential: true,
      });
      m.once("moveend", finish);
    },
    [setBusyBoth],
  );
  const enterRef = useRef(enter);
  enterRef.current = enter;

  // Animación de entrada: viene girando hacia México, o se aleja si regresa del mapa plano.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !pageActive) return undefined;
    setBusyBoth(false);
    m.resize();
    m.stop();
    const dur = reducedMotion() ? 0 : undefined;
    if ((entry.zoom ?? 1) > 1) {
      m.jumpTo({ center: [entry.lon, entry.lat], zoom: BACK_ZOOM });
      m.flyTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM, duration: dur ?? 1400, essential: true });
    } else {
      m.jumpTo({ center: [STUDY.lon + 110, 8], zoom: REST_ZOOM });
      m.easeTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM, duration: dur ?? 1700, essential: true });
    }
    return () => m.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key, pageActive, ready]);

  const status = busy
    ? "Acercando a la zona…"
    : !ready
      ? "Cargando imágenes satelitales del planeta…"
      : tilesError
        ? "No se pudieron cargar las imágenes del globo (sin conexión o bloqueadas). El mapa plano sigue funcionando."
        : "Arrastra para girar · rueda o +/− para acercar · toca el pin para entrar";

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-[440px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-gray-800"
    >
      <div ref={mapEl} aria-label="Globo terráqueo interactivo" className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <div className={`pointer-events-auto flex items-center gap-0.5 p-1 ${PANEL}`}>
          <button type="button" onClick={() => enter(STUDY_BOUNDS)} disabled={busy} className={PRIMARY}>
            <Crosshair size={14} strokeWidth={1.75} /> Ir a la zona de estudio
          </button>
          <button type="button" onClick={() => enter(STUDY_BOUNDS, true)} disabled={busy} className={GHOST}>
            <Pencil size={14} strokeWidth={1.75} /> Dibujar parcela
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className={`pointer-events-auto flex flex-col overflow-hidden ${PANEL}`}>
          {ESTADOS.map((name, i) => (
            <button
              key={name}
              type="button"
              disabled={busy}
              onClick={() => enter(estadoBounds(name))}
              className={`px-3 py-1.5 text-left text-[11px] font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50 ${i ? "border-t border-white/10" : ""}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <MapControls
        disabled={busy}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 260 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 260 })}
        onReset={() =>
          mapRef.current?.flyTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM, duration: reducedMotion() ? 0 : 800, essential: true })
        }
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 right-16 z-10 flex flex-col items-start gap-1.5">
        <p className={STATUS} role="status">
          {status}
        </p>
        <p className="bg-black/60 px-1.5 py-0.5 text-[10px] text-gray-300">Imagen: Esri, Maxar, Earthstar Geographics</p>
      </div>
    </div>
  );
}
