import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Pane, Polygon, Polyline, Marker, GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { Check, Eraser, Globe, MousePointer2, Pencil, Undo2 } from "lucide-react";
import MapControls from "./MapControls";
import { GHOST, PANEL, PRIMARY, STATUS } from "./mapUi";
import { preloadWorldTiles } from "./tilePreload";
import { usePageActive } from "../../context/PageActiveContext";
import { estadoBounds } from "../../utils/polygon";
import { reportGLFailure, resolveMapEngine } from "../../utils/mapDevice";
import { parcelGridLines } from "../../utils/parcelGrid";
import { ESTADOS } from "../../data/earthEngine";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import "leaflet/dist/leaflet.css";

// Globo 3D, cargado solo cuando se necesita. Si el equipo acepta WebGL se usa MapLibre GL con
// proyección de globo; si no (PCs sin potencia / sin aceleración), el globo ligero de Canvas 2D.
const GlobeMapCanvas = lazy(() => import("./GlobeMap"));
const GlobeMapGL = lazy(() => import("./GlobeMapGL"));

const SATELLITE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};
// Un solo mundo: sin copias repetidas en tiras y con el zoom mínimo limitado a lo que cabe en el mapa.
const WORLD = [
  [-85.05, -180],
  [85.05, 180],
];
const WORLD_BOUNDS = L.latLngBounds(WORLD);
function limitMinZoom(map) {
  map.setMaxBounds(WORLD_BOUNDS);
  map.options.maxBoundsViscosity = 1;
  const { x, y } = map.getSize();
  if (!x || !y) return;
  const z = map.getBoundsZoom(WORLD, true); // el mundo llena el recuadro, sin huecos
  map.setMinZoom(z);
  if (map.getZoom() < z) map.setZoom(z, { animate: false });
}

// Encuadre inicial: Hidalgo, Tlaxcala y Puebla.
const START_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];

// Vértices sobrios: cuadrados blancos (se invierten con la imagen, igual que la malla). El de cierre es algo mayor.
const vertexIcon = (closeTarget) =>
  L.divIcon({
    className: "",
    iconSize: closeTarget ? [12, 12] : [8, 8],
    iconAnchor: closeTarget ? [6, 6] : [4, 4],
    html: `<span style="display:block;width:100%;height:100%;background:#fff"></span>`,
  });

/** Clics del mapa: solo agregan vértices mientras se dibuja (y se evita el zoom por doble clic). */
function DrawEvents({ drawing, onAdd }) {
  const map = useMap();
  useEffect(() => {
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
    return () => {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    };
  }, [drawing, map]);
  useMapEvents({ click: (e) => drawing && onAdd([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Re-mide el mapa al volver a la pantalla (keep-alive) y encuadra el polígono cuando `fitKey` cambia. */
function MapSync({ fitKey, points }) {
  const map = useMap();
  const active = usePageActive();
  useEffect(() => {
    if (active) {
      const id = setTimeout(() => map.invalidateSize(), 50);
      return () => clearTimeout(id);
    }
  }, [active, map]);
  // Cubre también la pestaña oculta (display:none) y el cambio de tamaño de la ventana.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      limitMinZoom(map); // también al pasar a pantalla completa o cambiar el tamaño de la ventana
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  // Recorte duro: la vista nunca sale del mundo, ni arrastrando ni con la inercia del movimiento.
  useEffect(() => {
    const clamp = () => {
      if (!WORLD_BOUNDS.contains(map.getBounds())) map.panInsideBounds(WORLD_BOUNDS, { animate: false });
    };
    map.on("drag", clamp);
    map.on("moveend", clamp);
    return () => {
      map.off("drag", clamp);
      map.off("moveend", clamp);
    };
  }, [map]);
  useEffect(() => {
    if (fitKey && points.length >= 3) map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 17 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Amplía unos límites [[s,w],[n,e]] por un factor alrededor de su centro. */
function widen([[s, w], [n, e]], f) {
  const cy = (s + n) / 2;
  const cx = (w + e) / 2;
  const hy = ((n - s) / 2) * f;
  const hx = ((e - w) / 2) * f;
  return [
    [cy - hy, cx - hx],
    [cy + hy, cx + hx],
  ];
}

/**
 * Mapa satelital plano con dibujo de polígono (Leaflet, sin plugins).
 * Controlado por el padre: `points` ([lat,lng][]), `closed` y `drawing`.
 * `target` ([[s,w],[n,e]]): si viene del globo, arranca amplio y vuela hasta esa zona.
 */
function FlatGeometryMap({
  points,
  closed,
  drawing,
  locked,
  fitKey,
  entry,
  active,
  onChange,
  onStartDrawing,
  onFinish,
  onClear,
  onUndo,
  onOpenGlobe,
  isFullscreen,
  onToggleFullscreen,
}) {
  const [map, setMap] = useState(null);
  const [startBounds] = useState(() => {
    if (entry.target) return widen(entry.target, 5);
    if (points.length >= 3) return L.latLngBounds(points).pad(0.4);
    return START_BOUNDS;
  });
  // Cada vez que se entra desde el globo: encuadra amplio y vuela a la zona elegida.
  const lastEntry = useRef(entry.key);
  useEffect(() => {
    if (!map || !active || !entry.target || lastEntry.current === entry.key) return;
    lastEntry.current = entry.key;
    map.invalidateSize(false);
    map.fitBounds(widen(entry.target, 5), { animate: false });
    const id = setTimeout(() => map.flyToBounds(entry.target, { duration: 1.3, padding: [30, 30], maxZoom: 17 }), 150);
    return () => clearTimeout(id);
  }, [map, active, entry]);
  // La primera entrada (mapa recién creado) también vuela.
  useEffect(() => {
    if (!map || !entry.target) return;
    const id = setTimeout(() => map.flyToBounds(entry.target, { duration: 1.3, padding: [30, 30], maxZoom: 17 }), 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  const ready = points.length >= 3;
  // Malla en perspectiva que se adapta a la forma de la parcela ya cerrada.
  const gridLines = useMemo(() => (closed && ready ? parcelGridLines(points) : []), [closed, ready, points]);
  const stateStyle = useMemo(() => ({ color: "#ffffff", weight: 1.2, opacity: 0.55, dashArray: "4 5", fillOpacity: 0 }), []);

  const status = locked
    ? "Calculando índices… la parcela queda bloqueada"
    : drawing
      ? ready
        ? "Sigue marcando vértices · toca el punto blanco o «Terminar» para cerrar"
        : `Haz clic en el mapa para marcar los vértices (${points.length}/3 mínimo)`
      : closed
        ? "Arrastra los vértices para ajustar el contorno"
        : "Pulsa «Dibujar parcela» y marca el contorno sobre la imagen";

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden rounded-lg">
      <MapContainer
        ref={setMap}
        bounds={startBounds}
        zoomControl={false}
        attributionControl={false}
        fadeAnimation={false}
        maxBounds={WORLD}
        maxBoundsViscosity={1}
        maxZoom={19}
        className="absolute inset-0 bg-gray-100 dark:bg-gray-900"
      >
        {/* Capa base de vista general: siempre hay imagen debajo mientras llegan las teselas nítidas. */}
        <TileLayer url={SATELLITE.url} noWrap minNativeZoom={2} maxNativeZoom={5} maxZoom={19} zIndex={1} keepBuffer={2} />
        <TileLayer
          {...SATELLITE}
          noWrap
          maxNativeZoom={17}
          maxZoom={19}
          zIndex={2}
          keepBuffer={5}
          updateWhenIdle={false}
          updateWhenZooming={false}
        />
        <GeoJSON data={estadosBoundaries} style={() => stateStyle} interactive={false} />

        {/* Dibujo de la parcela con contraste invertido: trazos blancos en modo "difference" invierten el color
            de la imagen que tienen debajo, así se leen sobre cualquier tono. El modo de mezcla va en el panel
            (no en cada trazo) porque los paneles de Leaflet son contextos de apilamiento aislados. */}
        <Pane name="parcel" style={{ zIndex: 450, mixBlendMode: "difference" }}>
          {points.length >= 2 && !closed && (
            <Polyline positions={points} pathOptions={{ color: "#fff", weight: 2.5 }} interactive={false} />
          )}
          {closed && ready && (
            <>
              <Polygon
                positions={points}
                pathOptions={{ color: "#fff", weight: 2.5, lineJoin: "miter", fill: false }}
                interactive={false}
              />
              {gridLines.length > 0 && (
                <Polyline positions={gridLines} pathOptions={{ color: "#fff", weight: 2 }} interactive={false} />
              )}
            </>
          )}

          {points.map((p, i) => {
            const closeTarget = drawing && ready && i === 0;
            return (
              <Marker
                key={`${i}-${closeTarget}`}
                position={p}
                draggable={!locked && !drawing}
                icon={vertexIcon(closeTarget)}
                eventHandlers={{
                  click: () => closeTarget && onFinish(),
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    onChange(points.map((q, k) => (k === i ? [lat, lng] : q)));
                  },
                }}
              />
            );
          })}
        </Pane>

        <DrawEvents drawing={drawing && !locked} onAdd={(p) => onChange([...points, p])} />
        <MapSync fitKey={fitKey} points={points} />
      </MapContainer>

      {/* Herramientas de dibujo (a la izquierda) y cambio de vista (separado, al final) */}
      <div className="pointer-events-none absolute left-3 top-3 z-1000">
        <div className={`pointer-events-auto flex items-center gap-0.5 p-1 ${PANEL}`}>
          {drawing ? (
            <button type="button" onClick={onFinish} disabled={!ready || locked} className={PRIMARY}>
              <Check size={14} /> Terminar
            </button>
          ) : (
            <button type="button" onClick={onStartDrawing} disabled={locked} className={PRIMARY}>
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
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          <button
            type="button"
            aria-label="Ver el globo"
            title="Volver al globo"
            onClick={() => {
              const c = map?.getCenter();
              onOpenGlobe(c ? { lat: c.lat, lon: c.lng } : { lat: 19.6, lon: -98.1 });
            }}
            disabled={locked}
            className={GHOST}
          >
            <Globe size={14} strokeWidth={1.75} /> <span className="hidden sm:inline">Globo</span>
          </button>
        </div>
      </div>

      {/* Zoom y saltos a cada estado */}
      <div className="pointer-events-none absolute right-3 top-3 z-1000 flex flex-col items-end gap-2">
        <div className={`pointer-events-auto flex flex-col overflow-hidden ${PANEL}`}>
          <span className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">Ir a</span>
          {ESTADOS.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => map?.flyToBounds(estadoBounds(name), { duration: 0.8 })}
              className="px-3 py-1.5 text-left text-[11px] font-medium text-gray-300 hover:bg-white/10"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <MapControls
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        onReset={() => map?.flyToBounds(START_BOUNDS, { duration: 0.8 })}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 right-16 z-1000 flex flex-col items-start gap-1.5">
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

/**
 * Pantalla de parcela satelital: arranca en un globo 3D (MapLibre GL con proyección de globo; en equipos sin WebGL, un globo ligero de Canvas 2D)
 * y entra al mapa plano para dibujar. Si ya hay una parcela o se importa un GeoJSON,
 * va directo al mapa plano.
 */
export default function GeometryMap(props) {
  const { points, fitKey, onStartDrawing } = props;
  const [view, setView] = useState(points.length ? "flat" : "globe");
  // Cada vista se crea UNA sola vez (la primera que se necesita) y se reutiliza: no se desmonta al cambiar.
  const [flatCreated, setFlatCreated] = useState(points.length > 0);
  const [globeCreated, setGlobeCreated] = useState(points.length === 0);
  const [flatEntry, setFlatEntry] = useState({ key: 0, target: null });
  const [globeEntry, setGlobeEntry] = useState({ key: 0, lat: 8, lon: -98.1 });
  const [lastFit, setLastFit] = useState(fitKey);
  // MapLibre GL si el equipo acepta WebGL; si falla al arrancar, se cae al globo de Canvas 2D.
  const [glFailed, setGlFailed] = useState(false);
  const useGL = !glFailed && resolveMapEngine() === "gl";
  const GlobeMap = GlobeMapCanvas;
  useEffect(() => {
    preloadWorldTiles();
  }, []);
  const boxRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else boxRef.current?.requestFullscreen?.().catch(() => {});
  };

  const goFlat = (target) => {
    setFlatEntry((e) => ({ key: e.key + 1, target }));
    setFlatCreated(true);
    setView("flat");
  };
  const goGlobe = (c) => {
    setGlobeEntry((e) => ({ key: e.key + 1, ...c, zoom: 5.4 }));
    setGlobeCreated(true);
    setView("globe");
  };

  // Importar un GeoJSON salta directo al mapa plano (se ajusta durante el render, sin efecto).
  if (fitKey !== lastFit) {
    setLastFit(fitKey);
    if (fitKey) {
      setFlatCreated(true);
      setView("flat");
    }
  }

  // Si se empieza a dibujar desde el panel (no desde el globo), se pasa al mapa plano sobre la zona de estudio.
  if (!useGL && props.drawing && view === "globe") goFlat(START_BOUNDS);

  const pane = (on) =>
    `absolute inset-0 transition-[opacity,visibility] duration-300 ${on ? "visible opacity-100" : "invisible opacity-0"}`;

  // Con MapLibre GL todo vive en un solo mapa: globo, zoom y dibujo de la parcela.
  if (useGL) {
    return (
      <div ref={boxRef} className="relative h-full min-h-[440px] w-full [&:fullscreen]:bg-black">
        <Suspense fallback={<div className="h-full w-full rounded-lg bg-black" />}>
          <GlobeMapGL
            {...props}
            onFail={() => {
              reportGLFailure();
              setGlFailed(true);
            }}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </Suspense>
      </div>
    );
  }

  // El contenedor es el que entra en pantalla completa, así sigue activa al cambiar de globo a mapa plano.
  return (
    <div ref={boxRef} className="relative h-full min-h-[440px] w-full [&:fullscreen]:bg-black">
      {globeCreated && (
        <div className={pane(view === "globe")}>
          <Suspense fallback={<div className="h-full w-full rounded-lg bg-black" />}>
            <GlobeMap
              entry={globeEntry}
              active={view === "globe"}
              onEnter={(bounds, draw, isStudyZone) => {
                // Si ya hay algo dibujado (parcela o trazo en curso) se conserva: nunca se borra al volver del
                // globo. "Ir a la zona de estudio" y "Dibujar parcela" regresan a ese dibujo en vez de a la región.
                const hasDrawing = points.length > 0;
                let target = bounds;
                if (hasDrawing && isStudyZone && points.length >= 2) {
                  const b = L.latLngBounds(points).pad(0.3);
                  target = [
                    [b.getSouth(), b.getWest()],
                    [b.getNorth(), b.getEast()],
                  ]; // arreglo [[s,w],[n,e]], el formato que esperan widen() y flyToBounds()
                }
                goFlat(target);
                if (draw && !hasDrawing) onStartDrawing();
              }}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </Suspense>
        </div>
      )}
      {flatCreated && (
        <div className={pane(view === "flat")}>
          <FlatGeometryMap
            {...props}
            entry={flatEntry}
            active={view === "flat"}
            onOpenGlobe={goGlobe}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      )}
    </div>
  );
}
