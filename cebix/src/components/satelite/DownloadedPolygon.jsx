import { useEffect, useMemo, useRef, useState } from "react";
import { Label, Row } from "../results/ReportParts";
import { areaHa, formatHa, perimeterM } from "../../utils/polygon";
import { formatFixed } from "../../utils/intl";

const PAD = 0.18; 
const MAX_Z = 17; 
const TILE = 256;
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

const worldPx = (lng, lat, z) => {
  const n = TILE * 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
};

const PULSE_MS = 2200;
const RING_MS = 1600;
const FRAME_MS = 33; 

function PolygonCanvas({ g }) {
  const wrapRef = useRef(null);
  const baseRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!wrap || !base || !overlay) return undefined;

    const [bx, by, bw, bh] = g.box;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let dpr = 1;
    let scale = 1;
    let offX = 0;
    let offY = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let disposed = false;

    const toCanvas = ([x, y]) => [(x - bx) * scale + offX, (y - by) * scale + offY];

    const drawBase = () => {
      const ctx = base.getContext("2d");
      ctx.clearRect(0, 0, base.width, base.height);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(0, 0, base.width, base.height);
      for (const { t, img } of tiles) {
        if (!img.complete || !img.naturalWidth) continue;
        const [x, y] = toCanvas([t.x, t.y]);
        ctx.drawImage(img, x, y, TILE * scale + 1, TILE * scale + 1);
      }
    };

    const drawOverlay = (time) => {
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const pts = g.ring.map(toCanvas);
      if (pts.length < 3) return;

      const phase = reduce ? 1 : (Math.sin((time / PULSE_MS) * Math.PI * 2) + 1) / 2;
      const ringT = reduce ? 0 : (time % RING_MS) / RING_MS;

      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * phase})`;
      ctx.shadowColor = "rgba(255,255,255,0.85)";
      ctx.shadowBlur = 8 * dpr * phase;
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (const [x, y] of pts) {
        if (!reduce) {
          ctx.beginPath();
          ctx.arc(x, y, (3.5 + 8 * ringT) * dpr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - ringT)})`;
          ctx.lineWidth = 1.25 * dpr;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.lineWidth = 1.25 * dpr;
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.stroke();
      }
    };

    const loop = (time) => {
      if (disposed || !visible) return;
      raf = requestAnimationFrame(loop);
      if (time - last < FRAME_MS) return;
      last = time;
      drawOverlay(time);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce) drawOverlay(0);
      else if (visible) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const cssW = wrap.clientWidth;
      const cssH = wrap.clientHeight;
      if (!cssW || !cssH) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(cssW * dpr);
      const H = Math.round(cssH * dpr);
      base.width = overlay.width = W;
      base.height = overlay.height = H;
      scale = Math.max(W / bw, H / bh); 
      offX = (W - bw * scale) / 2;
      offY = (H - bh * scale) / 2;
      drawBase();
      drawOverlay(performance.now());
    };

    const tiles = g.tiles.map((t) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = drawBase;
      img.src = t.href;
      return { t, img };
    });

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    io.observe(wrap);
    resize();
    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      tiles.forEach(({ img }) => {
        img.onload = null;
      });
    };
  }, [g]);

  return (
    <div ref={wrapRef} className="relative aspect-square w-full self-start overflow-hidden bg-gray-100 dark:bg-gray-900">
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={overlayRef}
        role="img"
        aria-label="Contorno descargado sobre imagen satelital"
        className="absolute inset-0 h-full w-full"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 22%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0) 100%)",
        }}
      />
      <p className="absolute bottom-0 left-0 px-2.5 py-2 text-[10px] text-gray-300">Imagen: Esri, Maxar, Earthstar Geographics</p>
    </div>
  );
}

export default function DownloadedPolygon({ data }) {
  const [showJson, setShowJson] = useState(false);

  const g = useMemo(() => {
    const ring = data?.geometry?.coordinates?.[0];
    if (!ring || ring.length < 4) return null;
    const lngs = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    const [w, e, s, n] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
    const cosLat = Math.cos((((s + n) / 2) * Math.PI) / 180);
    
    const spanM = Math.max((e - w) * cosLat, n - s, 1e-6) * (1 + PAD * 2);
    const dLng = spanM / cosLat;
    const dLat = spanM;
    const cx = (w + e) / 2;
    const cy = (s + n) / 2;
    const [west, east, south, north] = [cx - dLng / 2, cx + dLng / 2, cy - dLat / 2, cy + dLat / 2];
    
    const z = Math.max(1, Math.min(MAX_Z, Math.floor(Math.log2((640 * 360) / (TILE * dLng)))));
    const [x0, y1] = worldPx(west, south, z);
    const [x1, y0] = worldPx(east, north, z);
    const tiles = [];
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++)
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++)
        tiles.push({ key: `${tx}-${ty}`, x: tx * TILE, y: ty * TILE, href: `${TILE_URL}/${z}/${ty}/${tx}` });
    const pts = ring.slice(0, -1); 
    const latlng = pts.map(([lng, lat]) => [lat, lng]);
    const px = ([lng, lat]) => worldPx(lng, lat, z);
    return {
      box: [x0, y0, x1 - x0, y1 - y0],
      tiles,
      ring: pts.map(px),
      count: pts.length,
      ha: areaHa(latlng),
      perim: perimeterM(latlng),
      center: [cy, cx],
    };
  }, [data]);

  if (!g) return null;

  return (
    <section>
      <Label>Polígono en los datos descargados</Label>
      <p className="mb-3 mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        Se dibuja a partir de la geometría que lleva el archivo JSON descargado, no del mapa de arriba.
      </p>
      <div className="grid overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PolygonCanvas g={g} />

        <div className="flex min-w-0 flex-col border-t border-gray-200 dark:border-gray-800 md:border-l md:border-t-0">
          <dl className="divide-y divide-gray-100 dark:divide-gray-800/70">
            <Row label="Parcela">{data.ID_POLIGONO}</Row>
            <Row label="Estado · ciclo">
              {data.Estado} · {data.anio}
            </Row>
            <Row label="Vértices">{g.count}</Row>
            <Row label="Superficie">{formatHa(g.ha)} ha</Row>
            <Row label="Perímetro">{Math.round(g.perim).toLocaleString("es-MX")} m</Row>
            <Row label="Centro (lat, lng)">
              {formatFixed(g.center[0], 5)}, {formatFixed(g.center[1], 5)}
            </Row>
          </dl>
          <div className="mt-auto border-t border-gray-200 px-6 py-3 dark:border-gray-800">
            <button type="button" onClick={() => setShowJson((v) => !v)} className="text-xs font-medium text-gray-600 underline-offset-2 hover:underline dark:text-gray-300">
              {showJson ? "Ocultar geometría (GeoJSON)" : "Ver geometría (GeoJSON)"}
            </button>
            {showJson && (
              <pre className="mt-3 max-h-56 overflow-auto text-[11px] leading-snug text-gray-600 dark:text-gray-400">{JSON.stringify(data.geometry, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}