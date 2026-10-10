import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
// MapLibre 6 carga su worker (el que procesa GeoJSON: estados, parcela y malla) desde un archivo aparte.
// Vite no lo copia solo al build, así que se empaqueta aquí y se le indica la URL.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Check, Crosshair, Eraser, MousePointer2, Pencil, Undo2 } from "lucide-react";
import MapControls from "./MapControls";
import { GHOST, PANEL, PRIMARY, STATUS } from "./mapUi";
import { usePageActive } from "../../context/PageActiveContext";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { estadoBounds } from "../../utils/polygon";
import { parcelGridLines } from "../../utils/parcelGrid";
import { createStarsLayer } from "./globeStarsGL";
import { ESTADOS } from "../../data/earthEngine";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Mapa completo con MapLibre GL: globo 3D (proyección "globe") que al acercar pasa solo a mapa plano,
 * y sobre el que también se dibuja la parcela. Es el único mapa cuando el equipo acepta WebGL; en los
 * demás, GeometryMap usa el globo de Canvas 2D (GlobeMap.jsx) más el mapa plano de Leaflet.
 *
 * Controlado por el padre, igual que el mapa plano: `points` ([lat,lng][]), `closed` y `drawing`.
 * @param onFail   () => void  si MapLibre GL no pudo arrancar o se perdió el contexto WebGL
 */

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const STUDY_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];
const STUDY = { lat: 19.6, lon: -98.1 };
const REST_ZOOM = 1.6; // planeta completo, flotando en el espacio
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
    estados: { type: "geojson", data: estadosBoundaries },
    parcel: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    "parcel-grid": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
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
    // Los tres estados: relleno tenue (se nota aun cuando el planeta se ve pequeño), borde oscuro de
    // contraste y línea en el color de acento. El relleno se aclara al acercar para no tapar la imagen.
    {
      id: "estados-fill",
      type: "fill",
      source: "estados",
      paint: { "fill-color": "#ffffff", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.3, 6, 0.18, 9, 0.05] },
    },
    {
      id: "estados-casing",
      type: "line",
      source: "estados",
      layout: { "line-join": "round" },
      paint: { "line-color": "#000", "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 3, 8, 4.5] },
    },
    {
      id: "estados-line",
      type: "line",
      source: "estados",
      layout: { "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 8, 2.4] },
    },
    { id: "parcel-fill", type: "fill", source: "parcel", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#fff", "fill-opacity": 0.08 } },
    { id: "parcel-grid-casing", type: "line", source: "parcel-grid", paint: { "line-color": "#000", "line-width": 3.5, "line-opacity": 0.35 } },
    { id: "parcel-grid-line", type: "line", source: "parcel-grid", paint: { "line-color": "#fff", "line-width": 1.5 } },
    { id: "parcel-casing", type: "line", source: "parcel", layout: { "line-join": "miter" }, paint: { "line-color": "#000", "line-width": 5, "line-opacity": 0.5 } },
    { id: "parcel-line", type: "line", source: "parcel", layout: { "line-join": "miter" }, paint: { "line-color": "#fff", "line-width": 2.5 } },
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

const EMPTY = { type: "FeatureCollection", features: [] };
const toLngLat = (p) => [p[1], p[0]];

function vertexElement(closeTarget) {
  const el = document.createElement("div");
  const size = closeTarget ? 14 : 10;
  el.dataset.vertex = "1";
  el.style.cssText = `width:${size}px;height:${size}px;background:#fff;border:1.5px solid #000;box-sizing:border-box`;
  return el;
}

export default function GlobeMapGL({
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
  onFail,
  isFullscreen,
  onToggleFullscreen,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const vertexMarkers = useRef([]);
  const live = useRef({});
  live.current = { points, drawing, locked, onChange, onFinish, onFail };
  const pageActive = usePageActive();
  const { accent, resolvedTheme } = useTheme();
  const color = getAccentHex(accent, resolvedTheme === "dark" ? "dark" : "light");
  const colorRef = useRef(color);
  colorRef.current = color;

  const [ready, setReady] = useState(false);
  const [tilesError, setTilesError] = useState(false);

  const ok = points.length >= 3;
  const goStudy = useCallback(() => {
    mapRef.current?.fitBounds(toLngLatBounds(STUDY_BOUNDS), { padding: 40, maxZoom: 12, duration: reducedMotion() ? 0 : 1100, essential: true });
  }, []);
  const goBounds = useCallback((b) => {
    mapRef.current?.fitBounds(toLngLatBounds(b), { padding: 40, maxZoom: 12, duration: reducedMotion() ? 0 : 1100, essential: true });
  }, []);

  /* ───────────── creación del mapa (una sola vez) ───────────── */
  const createMap = useCallback(() => {
    let map;
    try {
      map = new maplibregl.Map({
        container: mapEl.current,
        style: STYLE,
        center: [STUDY.lon, STUDY.lat],
        zoom: REST_ZOOM,
        minZoom: 0.8,
        maxZoom: 19,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        canvasContextAttributes: { antialias: true, failIfMajorPerformanceCaveat: true },
      });
    } catch (err) {
      console.warn("MapLibre GL no pudo iniciar el globo:", err);
      live.current.onFail?.();
      return undefined;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();

    // "Listo" en cuanto el estilo carga (no espera a las teselas: así la parcela se dibuja aunque
    // las imágenes tarden o fallen).
    const markReady = () => {
      // Estrellas y Vía Láctea en WebGL, por debajo de todo (el globo las tapa; solo se ve el espacio).
      try {
        if (!map.getLayer("sky-stars")) map.addLayer(createStarsLayer(), "bg");
      } catch (err) {
        console.warn("No se pudo crear el cielo estrellado:", err);
      }
      map.setPaintProperty("estados-line", "line-color", colorRef.current);
      map.setPaintProperty("estados-fill", "fill-color", colorRef.current);
      setReady(true);
      map.resize();
    };
    if (map.isStyleLoaded()) markReady();
    else map.once("style.load", markReady);

    map.on("error", (e) => {
      if (e?.sourceId === "imagery") setTilesError(true);
    });
    map.on("data", (e) => {
      if (e.sourceId === "imagery" && e.tile) setTilesError(false);
    });

    // Clic en el mapa: agrega vértices mientras se dibuja.
    map.on("click", (e) => {
      const { drawing: d, locked: l, points: pts, onChange: change } = live.current;
      if (!d || l || e.originalEvent?.target?.closest?.("[data-vertex]")) return;
      change([...pts, [e.lngLat.lat, e.lngLat.lng]]);
    });

    const canvas = map.getCanvas();
    const onLost = (ev) => {
      ev.preventDefault();
      live.current.onFail?.();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    // Pin de la zona de estudio: acerca a la zona.
    const el = createPinElement(colorRef.current);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!live.current.drawing) goStudyRef.current?.();
    });
    pinRef.current = el;
    new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([STUDY.lon, STUDY.lat]).addTo(map);

    // Si ya hay parcela, arranca encuadrada en ella; si no, entra girando hacia México.
    const pts = live.current.points;
    if (pts.length >= 3) {
      const b = new maplibregl.LngLatBounds();
      pts.forEach((p) => b.extend(toLngLat(p)));
      map.fitBounds(b, { padding: 70, maxZoom: 17, duration: 0 });
    } else if (reducedMotion()) {
      map.jumpTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM });
    } else {
      map.jumpTo({ center: [STUDY.lon + 110, 8], zoom: REST_ZOOM });
      map.easeTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM, duration: 1700, essential: true });
    }

    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      vertexMarkers.current.forEach((m) => m.remove());
      vertexMarkers.current = [];
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, []);
  // MapLibre se crea solo cuando el contenedor ya tiene tamaño: si nace oculto (pantalla en segundo
  // plano, pestaña sin abrir) con 0×0 px, las capas vectoriales (parcela, malla, estados) no se pintan.
  useEffect(() => {
    const el = mapEl.current;
    let teardown;
    let ro;
    const sized = () => el.clientWidth > 0 && el.clientHeight > 0;
    if (sized()) teardown = createMap();
    else {
      ro = new ResizeObserver(() => {
        if (!sized()) return;
        ro.disconnect();
        ro = null;
        teardown = createMap();
      });
      ro.observe(el);
    }
    return () => {
      ro?.disconnect();
      teardown?.();
    };
  }, [createMap]);
  const goStudyRef = useRef(goStudy);
  goStudyRef.current = goStudy;

  // Se re-mide al volver a la pantalla (keep-alive) o al cambiar de tamaño.
  useEffect(() => {
    if (pageActive) mapRef.current?.resize();
  }, [pageActive]);
  useEffect(() => {
    const el = mapEl.current;
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // El pin de la zona de estudio se oculta mientras hay una parcela (o se dibuja una) para no taparla.
  const hidePin = drawing || points.length > 0;
  useEffect(() => {
    if (pinRef.current) pinRef.current.style.display = hidePin ? "none" : "";
  }, [hidePin, ready]);

  // El color de acento sigue al tema.
  useEffect(() => {
    const m = mapRef.current;
    if (m?.getLayer("estados-line")) {
      m.setPaintProperty("estados-line", "line-color", color);
      m.setPaintProperty("estados-fill", "fill-color", color);
    }
    if (pinRef.current) paintPin(pinRef.current, color);
  }, [color, ready]);

  /* ───────────── dibujo de la parcela ───────────── */
  const paintParcel = useCallback((pts, isClosed) => {
    const m = mapRef.current;
    const src = m?.getSource("parcel");
    if (!src) return;
    const coords = pts.map(toLngLat);
    let data = EMPTY;
    if (isClosed && pts.length >= 3) {
      data = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] } };
    } else if (pts.length >= 2) {
      data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
    }
    src.setData(data);
  }, []);

  const grid = useMemo(() => (closed && ok ? parcelGridLines(points) : []), [closed, ok, points]);

  useEffect(() => {
    if (!ready) return;
    paintParcel(points, closed);
    mapRef.current.getSource("parcel-grid").setData(
      grid.length
        ? { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: grid.map((l) => l.map(toLngLat)) } }
        : EMPTY,
    );
  }, [ready, points, closed, grid, paintParcel]);

  // Vértices: cuadrados blancos; se arrastran cuando la parcela está cerrada; el primero cierra el trazo.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return undefined;
    vertexMarkers.current.forEach((mk) => mk.remove());
    vertexMarkers.current = points.map((p, i) => {
      const closeTarget = drawing && ok && i === 0;
      const el = vertexElement(closeTarget);
      el.style.cursor = closeTarget ? "pointer" : !locked && !drawing ? "move" : "default";
      const mk = new maplibregl.Marker({ element: el, draggable: !locked && !drawing, anchor: "center" })
        .setLngLat(toLngLat(p))
        .addTo(m);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (closeTarget) live.current.onFinish();
      });
      mk.on("drag", () => {
        const ll = mk.getLngLat();
        const cur = live.current.points.map((q, k) => (k === i ? [ll.lat, ll.lng] : q));
        paintParcel(cur, true);
      });
      mk.on("dragend", () => {
        const ll = mk.getLngLat();
        live.current.onChange(live.current.points.map((q, k) => (k === i ? [ll.lat, ll.lng] : q)));
      });
      return mk;
    });
    return () => {
      vertexMarkers.current.forEach((mk) => mk.remove());
      vertexMarkers.current = [];
    };
  }, [ready, points, drawing, locked, ok, paintParcel]);

  // Cursor de dibujo y sin zoom por doble clic mientras se marcan vértices.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const on = drawing && !locked;
    m.getCanvas().style.cursor = on ? "crosshair" : "";
    if (on) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }, [drawing, locked, ready]);

  // Importar un GeoJSON (o cualquier nuevo `fitKey`): encuadra la parcela.
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    const m = mapRef.current;
    if (!m || !fitKey || points.length < 3) return;
    const b = new maplibregl.LngLatBounds();
    points.forEach((p) => b.extend(toLngLat(p)));
    m.fitBounds(b, { padding: 70, maxZoom: 17, duration: reducedMotion() ? 0 : 1100, essential: true });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrawing = () => {
    onStartDrawing();
    // Si se está viendo el planeta entero, baja a la zona de estudio para poder marcar vértices.
    if ((mapRef.current?.getZoom() ?? 0) < 7) goStudy();
  };

  const status = locked
    ? "Calculando índices… la parcela queda bloqueada"
    : drawing
      ? ok
        ? "Sigue marcando vértices · toca el punto blanco o «Terminar» para cerrar"
        : `Haz clic en el mapa para marcar los vértices (${points.length}/3 mínimo)`
      : closed
        ? "Arrastra los vértices para ajustar el contorno"
        : !ready
          ? "Cargando imágenes satelitales del planeta…"
          : tilesError
            ? "No se pudieron cargar las imágenes del globo (sin conexión o bloqueadas)."
            : "Arrastra para girar · rueda o +/− para acercar · «Dibujar parcela» para marcar el contorno";

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-gray-800">
      <div ref={mapEl} aria-label="Globo terráqueo interactivo" className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <div className={`pointer-events-auto flex items-center gap-0.5 p-1 ${PANEL}`}>
          <button type="button" onClick={goStudy} disabled={locked} className={GHOST}>
            <Crosshair size={14} strokeWidth={1.75} /> <span className="hidden sm:inline">Zona de estudio</span>
          </button>
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          {drawing ? (
            <button type="button" onClick={onFinish} disabled={!ok || locked} className={PRIMARY}>
              <Check size={14} /> Terminar
            </button>
          ) : (
            <button type="button" onClick={startDrawing} disabled={locked} className={PRIMARY}>
              {closed ? <MousePointer2 size={14} /> : <Pencil size={14} />}
              {closed ? "Redibujar" : "Dibujar parcela"}
            </button>
          )}
          <button type="button" aria-label="Deshacer último vértice" title="Deshacer último vértice" onClick={onUndo} disabled={!drawing || !points.length || locked} className={GHOST}>
            <Undo2 size={14} /> <span className="hidden sm:inline">Deshacer</span>
          </button>
          <button type="button" aria-label="Borrar parcela" title="Borrar parcela" onClick={onClear} disabled={!points.length || locked} className={GHOST}>
            <Eraser size={14} /> <span className="hidden sm:inline">Borrar</span>
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className={`pointer-events-auto flex flex-col overflow-hidden ${PANEL}`}>
          <span className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">Ir a</span>
          {ESTADOS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => goBounds(estadoBounds(name))}
              className="px-3 py-1.5 text-left text-[11px] font-medium text-gray-300 hover:bg-white/10"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <MapControls
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
          <span
            aria-hidden="true"
            className={`mr-2 inline-block size-1.5 align-middle ${locked ? "animate-pulse bg-amber-400" : drawing ? "bg-white" : "bg-white/40"}`}
          />
          {status}
        </p>
        <p className="bg-black/60 px-1.5 py-0.5 text-[10px] text-gray-300">Imagen: Esri, Maxar, Earthstar Geographics</p>
      </div>
    </div>
  );
}
