import { useMemo, useState } from "react";
import { Label, Row } from "../results/ReportParts";
import { areaHa, formatHa, perimeterM } from "../../utils/polygon";

const PAD = 0.18; 
const MAX_Z = 17; 
const TILE = 256;
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

const worldPx = (lng, lat, z) => {
  const n = TILE * 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
};

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
    const k = (x1 - x0) / 640; 
    return {
      view: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`,
      tiles,
      k,
      path: ring.map((c) => px(c).map((v) => v.toFixed(2)).join(",")).join(" "),
      verts: pts.map(px),
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
        <div className="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
          <svg viewBox={g.view} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Contorno descargado sobre imagen satelital">
            {g.tiles.map((t) => (
              <image key={t.key} href={t.href} x={t.x} y={t.y} width={TILE} height={TILE} draggable={false} />
            ))}
            <polygon points={g.path} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
            {g.verts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={4 * g.k} fill="#fff" stroke="rgba(0,0,0,.45)" strokeWidth={1.5 * g.k} />
            ))}
          </svg>
          <p className="absolute bottom-0 left-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-gray-300">Imagen: Esri, Maxar, Earthstar Geographics</p>
        </div>

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
              {g.center[0].toFixed(5)}, {g.center[1].toFixed(5)}
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