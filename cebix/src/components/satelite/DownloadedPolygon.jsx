import { useMemo, useState } from "react";
import { Label, Row } from "../results/ReportParts";
import { areaHa, formatHa, perimeterM } from "../../utils/polygon";

/**
 * Visualización APARTE del polígono tal como quedó en los datos descargados (el JSON de 'Descargar
 * variables'): se dibuja leyendo `data.geometry`, no el dibujo del mapa. Fondo satelital estático (Esri
 * export, en lat/lng lineales) con el contorno encima en SVG, para que coincidan sin reproyectar.
 *
 * data = { ID_POLIGONO, Estado, anio, geometry: GeoJSON Polygon }
 */
const SIZE = 640; // lado mayor de la imagen pedida (px)
const PAD = 0.18; // margen alrededor del polígono

export default function DownloadedPolygon({ data }) {
  const [imgOk, setImgOk] = useState(true);
  const [showJson, setShowJson] = useState(false);

  const g = useMemo(() => {
    const ring = data?.geometry?.coordinates?.[0];
    if (!ring || ring.length < 4) return null;
    const lngs = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    const [w, e, s, n] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
    const cosLat = Math.cos((((s + n) / 2) * Math.PI) / 180);
    // Mismo alto y ancho en metros: se iguala el lado mayor con margen y se centra el polígono.
    const spanM = Math.max((e - w) * cosLat, n - s, 1e-6) * (1 + PAD * 2);
    const dLng = spanM / cosLat;
    const dLat = spanM;
    const cx = (w + e) / 2;
    const cy = (s + n) / 2;
    const bbox = [cx - dLng / 2, cy - dLat / 2, cx + dLng / 2, cy + dLat / 2];
    const px = ([lng, lat]) => [((lng - bbox[0]) / dLng) * SIZE, ((bbox[3] - lat) / dLat) * SIZE];
    const pts = ring.slice(0, -1); // sin el vértice repetido que cierra el anillo
    const latlng = pts.map(([lng, lat]) => [lat, lng]);
    const params = new URLSearchParams({
      bbox: bbox.join(","),
      bboxSR: "4326",
      imageSR: "4326",
      size: `${SIZE},${SIZE}`,
      format: "png24",
      f: "image",
    });
    return {
      src: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params}`,
      path: ring.map((c) => px(c).map((v) => v.toFixed(1)).join(",")).join(" "),
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
        <div className="relative aspect-square w-full bg-gray-100 dark:bg-gray-900 md:aspect-auto md:min-h-[320px]">
          {imgOk && (
            <img
              src={g.src}
              alt="Imagen satelital bajo el polígono descargado"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              onError={() => setImgOk(false)}
            />
          )}
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Contorno descargado">
            <polygon points={g.path} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="miter" />
            {g.verts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke="rgba(0,0,0,.45)" strokeWidth="1.5" />
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
