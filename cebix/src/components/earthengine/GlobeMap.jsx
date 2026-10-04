import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Pencil } from "lucide-react";
import MapControls from "./MapControls";
import { GHOST, PANEL, PRIMARY, STATUS } from "./mapUi";
import { usePageActive } from "../../context/PageActiveContext";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { estadoBounds } from "../../utils/polygon";
import { ESTADOS } from "../../data/earthEngine";
import estadosBoundaries from "../../data/estadosBoundaries.json";
import { loadGlobeTexture } from "./globeTexture";
import { projectPoint, renderSphere } from "./globeRender";

/**
 * Globo 3D ligero: Canvas 2D puro, sin WebGL ni librerías.
 * Solo se redibuja cuando algo cambia (arrastre, zoom, vuelo): en reposo no gasta CPU.
 */

const D2R = Math.PI / 180;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.6;
// Presupuesto de píxeles que se calculan en CPU para la esfera (se escala al tamaño de pantalla).
// El costo es el mismo en una ventana chica que en pantalla completa.
const BUDGET_MOVING = 60000; // mientras se arrastra / vuela
const BUDGET_IDLE = 300000; // en reposo
const MAX_DPR = 1.5; // el lienzo con contornos y textos no pasa de esta densidad
const STUDY_BOUNDS = [
  [17.8, -99.6],
  [21.4, -96.6],
];
const STUDY = { lat: 19.6, lon: -98.1 };

// Anillos de los estados en [lat, lon], calculados una sola vez.
const STATE_RINGS = estadosBoundaries.features.map((f) => f.geometry.coordinates[0].map(([lng, la]) => [la, lng]));

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const normLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
const boundsCenter = (b) => ({ lat: (b[0][0] + b[1][0]) / 2, lon: (b[0][1] + b[1][1]) / 2 });

/**
 * @param entry    {key, lat, lon, zoom?}  cada vez que `key` cambia (y el globo está activo) repite la
 *                 animación de entrada; si zoom > 1 hace un "alejar" suave desde ese punto
 * @param active   false mientras el mapa plano está al frente: el globo se queda montado pero en pausa
 * @param onEnter  (bounds, draw, isStudyZone) => void  se llama al terminar el vuelo hacia la zona elegida
 */
export default function GlobeMap({ entry, active = true, onEnter, isFullscreen, onToggleFullscreen }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const view = useRef({ lon: entry.lon, lat: entry.lat, zoom: entry.zoom ?? 1 });
  const dims = useRef({ w: 0, h: 0 });
  const tex = useRef({ z2: null, z3: null });
  const fast = useRef(false);
  const rafRender = useRef(0);
  const rafFly = useRef(0);
  const rafInertia = useRef(0);
  const settleTimer = useRef(0);
  const drag = useRef(null);
  const pin = useRef({ x: 0, y: 0, visible: false });
  const buffers = useRef({ img: null, img32: null, off: null });
  const pageActive = usePageActive() && active;
  const activeRef = useRef(pageActive);
  activeRef.current = pageActive;
  const { accent, resolvedTheme } = useTheme();
  const color = getAccentHex(accent, resolvedTheme === "dark" ? "dark" : "light");
  const colorRef = useRef(color);
  colorRef.current = color;

  const [texState, setTexState] = useState("loading"); // loading | ok | error
  const [busy, setBusy] = useState(false);

  /* ───────────── dibujo ───────────── */
  const render = useCallback(() => {
    rafRender.current = 0;
    const canvas = canvasRef.current;
    const { w, h } = dims.current;
    if (!canvas || !w || !h || !activeRef.current) return;
    const q = Math.min(window.devicePixelRatio || 1, MAX_DPR); // fijo: el lienzo no se realoca al arrastrar
    const cw = Math.max(2, Math.round(w * q));
    const ch = Math.max(2, Math.round(h * q));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);

    const { lon, lat, zoom } = view.current;
    const R = Math.min(w, h) * 0.43 * zoom * q;
    const cx = cw / 2;
    const cy = ch / 2;
    const lon0 = lon * D2R;
    const lat0 = lat * D2R;

    // Esfera: se calcula en un búfer chico (según el presupuesto) y se escala al lienzo.
    const x0 = Math.max(0, Math.floor(cx - R));
    const x1 = Math.min(cw, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R));
    const y1 = Math.min(ch, Math.ceil(cy + R));
    const vw = x1 - x0;
    const vh = y1 - y0;
    if (vw > 1 && vh > 1) {
      const budget = fast.current ? BUDGET_MOVING : BUDGET_IDLE;
      const k = Math.min(1, Math.sqrt(budget / (vw * vh)));
      const bw = Math.max(2, Math.ceil(vw * k));
      const bh = Math.max(2, Math.ceil(vh * k));
      // Dimensiones del búfer redondeadas a 32 para no realocar en cada cuadro del vuelo.
      const aw = Math.ceil(bw / 32) * 32;
      const ah = Math.ceil(bh / 32) * 32;
      const b = buffers.current;
      if (!b.img || b.img.width !== aw || b.img.height !== ah) {
        b.img = new ImageData(aw, ah);
        b.img32 = new Uint32Array(b.img.data.buffer);
        b.off = document.createElement("canvas");
        b.off.width = aw;
        b.off.height = ah;
        b.offCtx = b.off.getContext("2d");
      }
      b.img32.fill(0);
      renderSphere(b.img32, aw, ah, (cx - x0) * k, (cy - y0) * k, R * k, lon0, lat0, tex.current.z3 || tex.current.z2);
      b.offCtx.putImageData(b.img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      ctx.drawImage(b.off, 0, 0, bw, bh, x0, y0, bw / k, bh / k);
    }

    const pt = { x: 0, y: 0 };
    const line = (coords, close = false) => {
      let pen = false;
      ctx.beginPath();
      for (const c of coords) {
        if (projectPoint(c[0], c[1], lon0, lat0, cx, cy, R, pt)) {
          if (pen) ctx.lineTo(pt.x, pt.y);
          else ctx.moveTo(pt.x, pt.y);
          pen = true;
        } else pen = false;
      }
      if (close && pen) ctx.closePath();
      ctx.stroke();
    };

    // Contornos de los estados de la zona de estudio
    ctx.lineWidth = 1.2 * q;
    ctx.strokeStyle = colorRef.current;
    for (const ring of STATE_RINGS) line(ring, true);

    // Pin de la zona de estudio
    pin.current.visible = projectPoint(STUDY.lat, STUDY.lon, lon0, lat0, cx, cy, R, pt);
    if (pin.current.visible) {
      pin.current.x = pt.x / q;
      pin.current.y = pt.y / q;
      const c = colorRef.current;
      ctx.lineWidth = 1.5 * q;
      ctx.strokeStyle = c;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8 * q, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5 * q, 0, Math.PI * 2);
      ctx.fill();

      const label = "Hidalgo · Puebla · Tlaxcala";
      ctx.font = `500 ${12 * q}px system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const bx = pt.x + 18 * q;
      const by = pt.y - 11 * q;
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw + 16 * q, 22 * q, 4 * q);
      else ctx.rect(bx, by, tw + 16 * q, 22 * q);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + 8 * q, by + 11.5 * q);
    }
  }, []);

  const requestRender = useCallback(
    (isFast = false) => {
      fast.current = isFast;
      if (isFast) {
        clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => requestRender(false), 140);
      }
      if (!rafRender.current) rafRender.current = requestAnimationFrame(render);
    },
    [render],
  );

  /* ───────────── vuelo animado ───────────── */
  const stopMotion = useCallback(() => {
    cancelAnimationFrame(rafFly.current);
    cancelAnimationFrame(rafInertia.current);
    rafFly.current = 0;
    rafInertia.current = 0;
  }, []);

  const flyTo = useCallback(
    (target, ms, done) => {
      stopMotion();
      const from = { ...view.current };
      const to = { lat: target.lat, lon: target.lon, zoom: clamp(target.zoom, MIN_ZOOM, MAX_ZOOM) };
      if (reducedMotion() || ms <= 0) {
        view.current = to;
        requestRender(false);
        done?.();
        return;
      }
      const dl = ((to.lon - from.lon + 540) % 360) - 180; // camino corto
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        view.current = {
          lon: normLon(from.lon + dl * e),
          lat: from.lat + (to.lat - from.lat) * e,
          zoom: from.zoom + (to.zoom - from.zoom) * e,
        };
        fast.current = t < 1;
        render();
        if (t < 1) rafFly.current = requestAnimationFrame(step);
        else {
          rafFly.current = 0;
          done?.();
        }
      };
      rafFly.current = requestAnimationFrame(step);
    },
    [render, requestRender, stopMotion],
  );

  const enter = useCallback(
    (bounds, draw = false) => {
      if (busy) return;
      setBusy(true);
      const c = boundsCenter(bounds);
      flyTo({ ...c, zoom: MAX_ZOOM }, 1100, () => onEnter(bounds, draw, bounds === STUDY_BOUNDS));
    },
    [busy, flyTo, onEnter],
  );

  /* ───────────── ciclo de vida ───────────── */
  // Tamaño del contenedor
  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(([entry]) => {
      dims.current = { w: entry.contentRect.width, h: entry.contentRect.height };
      requestRender(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [requestRender]);

  // Re-dibuja al volver a la pantalla (keep-alive).
  useEffect(() => {
    if (pageActive) requestRender(false);
  }, [pageActive, requestRender]);

  // Texturas: primero 1024 px (rápida), luego 2048 px (nítida).
  useEffect(() => {
    let dead = false;
    loadGlobeTexture(2)
      .then((t) => {
        if (dead) return null;
        tex.current.z2 = t;
        setTexState("ok");
        requestRender(false);
        return new Promise((r) => setTimeout(r, 2200)).then(() => !dead && loadGlobeTexture(3));
      })
      .then((t) => {
        if (dead || !t) return;
        tex.current.z3 = t;
        requestRender(false);
      })
      .catch(() => {
        if (!dead && !tex.current.z2) setTexState("error");
      });
    return () => {
      dead = true;
    };
  }, [requestRender]);

  // Animación de entrada: viene girando hacia México, o se aleja si regresa del mapa plano.
  // El globo es una sola instancia: se reutiliza cada vez que se vuelve a él.
  useEffect(() => {
    if (!active) {
      stopMotion();
      return;
    }
    setBusy(false);
    if ((entry.zoom ?? 1) > 1) {
      view.current = { lon: entry.lon, lat: entry.lat, zoom: entry.zoom };
      flyTo({ lat: entry.lat, lon: entry.lon, zoom: 1 }, 900);
    } else {
      view.current = { lon: STUDY.lon + 110, lat: 8, zoom: 1 };
      flyTo({ ...STUDY, zoom: 1 }, 1700);
    }
    return stopMotion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key, active]);

  useEffect(
    () => () => {
      clearTimeout(settleTimer.current);
      cancelAnimationFrame(rafRender.current);
    },
    [],
  );

  // Rueda del ratón (listener no pasivo para poder evitar el scroll de la página).
  useEffect(() => {
    const el = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      if (busy) return;
      stopMotion();
      view.current.zoom = clamp(view.current.zoom * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
      requestRender(true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [busy, requestRender, stopMotion]);

  /* ───────────── puntero ───────────── */
  const degPerPx = () => 57.2958 / (Math.min(dims.current.w, dims.current.h) * 0.43 * view.current.zoom);
  const nearPin = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return pin.current.visible && Math.hypot(e.clientX - r.left - pin.current.x, e.clientY - r.top - pin.current.y) < 16;
  };

  const onPointerDown = (e) => {
    if (busy) return;
    stopMotion();
    canvasRef.current.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, lon: view.current.lon, lat: view.current.lat, moved: false, t: e.timeStamp, vlon: 0 };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) {
      canvasRef.current.style.cursor = nearPin(e) ? "pointer" : "grab";
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    canvasRef.current.style.cursor = "grabbing";
    const k = degPerPx();
    const prevLon = view.current.lon;
    view.current.lon = normLon(d.lon - (dx * k) / Math.max(Math.cos(view.current.lat * D2R), 0.3));
    view.current.lat = clamp(d.lat + dy * k, -85, 85);
    const dt = Math.max(1, e.timeStamp - d.t);
    d.vlon = (normLon(view.current.lon - prevLon) / dt) * 0.6 + d.vlon * 0.4;
    d.t = e.timeStamp;
    requestRender(true);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      if (nearPin(e)) enter(STUDY_BOUNDS);
      return;
    }
    // Inercia corta, solo en longitud.
    let v = d.vlon;
    if (Math.abs(v) < 0.02 || reducedMotion()) {
      requestRender(false);
      return;
    }
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      view.current.lon = normLon(view.current.lon + v * dt);
      v *= 0.93 ** (dt / 16);
      if (Math.abs(v) > 0.01) {
        requestRender(true);
        rafInertia.current = requestAnimationFrame(tick);
      } else {
        rafInertia.current = 0;
        requestRender(false);
      }
    };
    rafInertia.current = requestAnimationFrame(tick);
  };

  const zoomBy = (f) => {
    if (busy) return;
    flyTo({ ...view.current, zoom: view.current.zoom * f }, 260);
  };

  const status = busy
    ? "Acercando a la zona…"
    : texState === "loading"
      ? "Cargando imágenes satelitales del planeta…"
      : texState === "error"
        ? "No se pudieron cargar las imágenes del globo (sin conexión o bloqueadas). El mapa plano sigue funcionando."
        : "Arrastra para girar · rueda o +/− para acercar · toca el pin para entrar";

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-[440px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-gray-800"
    >
      <canvas
        ref={canvasRef}
        aria-label="Globo terráqueo interactivo"
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

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
        onZoomIn={() => zoomBy(1.4)}
        onZoomOut={() => zoomBy(1 / 1.4)}
        onReset={() => flyTo({ ...STUDY, zoom: 1 }, 800)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 right-16 z-10">
        <p className={STATUS}>
          {status}
        </p>
      </div>
    </div>
  );
}
