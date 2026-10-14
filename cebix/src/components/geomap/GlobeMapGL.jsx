import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "../../utils/maplibreSetup";
// MapLibre 6 carga su worker (el que procesa GeoJSON: estados, parcela y malla) desde un archivo aparte.
// Vite no lo copia solo al build, así que se empaqueta aquí y se le indica la URL.
import { Check, Crosshair, Eraser, MousePointer2, Pencil, Undo2 } from "lucide-react";
import MapControls from "./MapControls";
import { GHOST, PANEL, PRIMARY, STATUS } from "./mapUi";
import { usePageActive } from "../../context/PageActiveContext";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { areaHa, estadoBounds } from "../../utils/polygon";
import { parcelGridLines } from "../../utils/parcelGrid";
import { createStarsLayer } from "./globeStarsGL";
import { createTraceLayers } from "./glTraceLayers";
import { boundaryGLPaint } from "../map/boundaryStyle";
import {
  EXPORT_COLOR,
  EXPORT_LABEL,
  IMAGERY_CREDIT,
  IMAGERY_URL,
  STUDY,
  STUDY_BOUNDS,
  drawStatus,
  statusDot,
  traceBlend,
  traceColor,
  vertexLook,
} from "./parcelStyle";
import { ESTADOS } from "./config";
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

const MIN_ZOOM = 0.8; // zoom mínimo permitido: planeta completo, flotando en el espacio
const REST_ZOOM = MIN_ZOOM; // el mapa siempre arranca (y se restablece) con el zoom al mínimo
const MAX_RETRIES = 3; // veces que se recrea el mapa antes de rendirse y usar el mapa ligero
const LOAD_TIMEOUT_MS = 10000; // si el estilo no carga en este tiempo, se recrea

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// Los límites de la app son [[s,w],[n,e]]; MapLibre usa [[w,s],[e,n]].
const toLngLatBounds = (b) => [
  [b[0][1], b[0][0]],
  [b[1][1], b[1][0]],
];

/** Estilo del mapa; el contorno de los estados usa el color de acento (components/map/boundaryStyle.js). */
const buildStyle = (accentHex) => ({
  version: 8,
  projection: { type: "globe" },
  sources: {
    estados: { type: "geojson", data: estadosBoundaries },
    imagery: {
      type: "raster",
      tiles: [IMAGERY_URL],
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
    // Los tres estados, con el mismo trazo (y color de acento) que Mapa satelital y que el mapa plano de Leaflet.
    {
      id: "estados-line",
      type: "line",
      source: "estados",
      layout: { "line-join": "round" },
      paint: boundaryGLPaint(accentHex),
    },
  ],
});

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

const toLngLat = (p) => [p[1], p[0]];

/** Vértice: mismo diseño que en Leaflet (parcelStyle.vertexLook), con el modo de mezcla del resto del trazo. */
function vertexElement(closeTarget, overLimit) {
  const el = document.createElement("div");
  el.dataset.vertex = "1";
  if (closeTarget) el.dataset.close = "1";
  paintVertex(el, overLimit);
  return el;
}

/** Aspecto de un vértice (se reutiliza al arrastrar, cuando cambia según el límite de superficie). */
function paintVertex(el, overLimit) {
  const { size, css } = vertexLook(Boolean(el.dataset.close), traceColor(overLimit));
  const cursor = el.style.cursor;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;${css};mix-blend-mode:${traceBlend(overLimit)}`;
  el.style.cursor = cursor;
}

export default function GlobeMapGL({
  maxAreaHa = Infinity,
  points,
  closed,
  drawing,
  locked,
  overLimit = false,
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
  const traceRef = useRef(null); // contorno y malla (capas nativas del mapa)
  const live = useRef({});
  const pageActive = usePageActive();
  live.current = { points, drawing, locked, overLimit, maxAreaHa, onChange, onFinish, onFail, pageActive };
  const { accent, resolvedTheme } = useTheme();
  const color = getAccentHex(accent, resolvedTheme === "dark" ? "dark" : "light");
  const colorRef = useRef(color);
  colorRef.current = color;

  const [ready, setReady] = useState(false);
  // Sube cada vez que un mapa nuevo queda listo: los efectos que dibujan sobre el mapa dependen de él, para que se
  // vuelvan a ejecutar aunque `ready` no cambie (el mapa viejo se recrea y `ready` vuelve a true en el mismo ciclo).
  const [mapVer, setMapVer] = useState(0);
  const [tilesError, setTilesError] = useState(false);

  // Recuperación: si el mapa no llega a cargar, falla al iniciar o el navegador le quita el contexto WebGL
  // (pasa cuando hay muchos mapas abiertos en pantallas en segundo plano), se vuelve a crear solo, en vez de
  // dejar al usuario recargando la página. `gen` cambia para re-ejecutar la creación.
  const [gen, setGen] = useState(0);
  const attempts = useRef(0);
  const retryTimer = useRef(null);
  const pendingRecover = useRef(false);
  const view = useRef(null); // última vista, para no volver al planeta completo al recrear

  const recover = useCallback((reason) => {
    attempts.current += 1;
    console.warn(`Globo MapLibre: se reinicia (${reason}), intento ${attempts.current}/${MAX_RETRIES}`);
    if (attempts.current > MAX_RETRIES) {
      live.current.onFail?.();
      return;
    }
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      // En una pantalla oculta no se recrea (le quitaría el contexto a la que sí se ve): espera a que se muestre.
      if (live.current.pageActive === false) pendingRecover.current = true;
      else setGen((g) => g + 1);
    }, 150 * attempts.current);
  }, []);
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  useEffect(() => {
    if (pageActive && pendingRecover.current) {
      pendingRecover.current = false;
      setGen((g) => g + 1);
    }
  }, [pageActive]);

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
    setReady(false);
    try {
      map = new maplibregl.Map({
        container: mapEl.current,
        style: buildStyle(colorRef.current),
        center: [STUDY.lon, STUDY.lat],
        zoom: REST_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: 19,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        canvasContextAttributes: { antialias: true, failIfMajorPerformanceCaveat: true },
      });
    } catch (err) {
      console.warn("MapLibre GL no pudo iniciar el globo:", err);
      recover("no pudo iniciar");
      return undefined;
    }
    mapRef.current = map;
    traceRef.current = createTraceLayers(map);
    let isReady = false;
    let stableTimer;
    // Si el estilo nunca termina de cargar (carrera con el contexto WebGL, red lenta al arrancar...), se recrea.
    const watchdog = setTimeout(() => {
      if (!isReady) recover("el estilo no cargó a tiempo");
    }, LOAD_TIMEOUT_MS);
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
      isReady = true;
      clearTimeout(watchdog);
      stableTimer = setTimeout(() => (attempts.current = 0), 5000); // se perdona el historial si se mantiene estable
      setReady(true);
      setMapVer((v) => v + 1);
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
      recover("se perdió el contexto WebGL");
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

    // Recuerda la vista para conservarla si hay que recrear el mapa.
    map.on("moveend", () => {
      const c = map.getCenter();
      view.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
    });

    // Si se está recreando, vuelve a donde estaba; la primera vez arranca con el planeta completo y gira hacia México.
    if (view.current) {
      map.jumpTo(view.current);
    } else if (reducedMotion()) {
      map.jumpTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM });
    } else {
      map.jumpTo({ center: [STUDY.lon + 110, 8], zoom: REST_ZOOM });
      map.easeTo({ center: [STUDY.lon, STUDY.lat], zoom: REST_ZOOM, duration: 1700, essential: true });
    }

    return () => {
      clearTimeout(watchdog);
      clearTimeout(stableTimer);
      canvas.removeEventListener("webglcontextlost", onLost);
      vertexMarkers.current.forEach((m) => m.remove());
      vertexMarkers.current = [];
      traceRef.current?.destroy();
      traceRef.current = null;
      try {
        map.remove();
      } catch {
        // contexto ya perdido: no hay nada más que liberar
      }
      mapRef.current = null;
      pinRef.current = null;
    };
  }, [recover]);
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
  }, [createMap, gen]);
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
  }, [hidePin, ready, mapVer]);

  // El color de acento sigue al tema.
  useEffect(() => {
    if (pinRef.current) paintPin(pinRef.current, color);
    const m = mapRef.current;
    if (ready && m?.getLayer("estados-line")) {
      for (const [k, v] of Object.entries(boundaryGLPaint(color))) m.setPaintProperty("estados-line", k, v);
    }
  }, [color, ready, mapVer]);

  /* ───────────── dibujo de la parcela ───────────── */
  // Contorno y malla: capas nativas de MapLibre (glTraceLayers.js + parcelStyle.js).
  const grid = useMemo(() => (closed && ok ? parcelGridLines(points) : []), [closed, ok, points]);

  useEffect(() => {
    if (!ready) return;
    traceRef.current?.set({ points, closed, grid, overLimit });
  }, [ready, mapVer, points, closed, grid, overLimit]);

  // Vértices: círculos blancos; se arrastran cuando la parcela está cerrada; el primero cierra el trazo.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return undefined;
    vertexMarkers.current.forEach((mk) => mk.remove());
    vertexMarkers.current = points.map((p, i) => {
      const closeTarget = drawing && ok && i === 0;
      const el = vertexElement(closeTarget, live.current.overLimit);
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
        const over = cur.length >= 3 && areaHa(cur) > live.current.maxAreaHa;
        // El contorno, la malla y el color siguen al vértice mientras se arrastra.
        traceRef.current?.set({ points: cur, closed: true, grid: cur.length >= 3 ? parcelGridLines(cur) : [], overLimit: over });
        vertexMarkers.current.forEach((v) => paintVertex(v.getElement(), over));
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
  }, [ready, mapVer, points, drawing, locked, ok, overLimit]);

  // Cursor de dibujo y sin zoom por doble clic mientras se marcan vértices.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const on = drawing && !locked;
    m.getCanvas().style.cursor = on ? "crosshair" : "";
    if (on) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }, [drawing, locked, ready, mapVer]);

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

  const status =
    drawStatus({ locked, drawing, ready: ok, closed, count: points.length }) ??
    (!ready
      ? "Cargando imágenes satelitales del planeta…"
      : tilesError
        ? "No se pudieron cargar las imágenes del globo (sin conexión o bloqueadas)."
        : "Arrastra para girar · rueda o +/− para acercar · 'Dibujar parcela' para marcar el contorno");

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden bg-black">
      <div ref={mapEl} aria-label="Globo terráqueo interactivo" className="absolute inset-0 isolate h-full w-full" />

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
            className={`mr-2 inline-block size-1.5 align-middle ${statusDot({ locked, drawing })}`}
          />
          {status}
        </p>
        {closed && ok && (
          <p className="flex items-center gap-2 bg-black/60 px-1.5 py-0.5 text-[10px] text-gray-200">
            <span aria-hidden="true" className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: EXPORT_COLOR }} />
            {EXPORT_LABEL}
          </p>
        )}
        <p className="bg-black/60 px-1.5 py-0.5 text-[10px] text-gray-300">{IMAGERY_CREDIT}</p>
      </div>
    </div>
  );
}
