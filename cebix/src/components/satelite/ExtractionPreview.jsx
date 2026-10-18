import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { getAccentHex } from "../../utils/accentColors";
import { SOURCES, WINDOWS } from "../../data/satelite";
import { STEP_MS } from "../../services/sateliteApi";

const STAC = "https://earth-search.aws.element84.com/v1";
const CHIRPS = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/cogs/p05";
const LINE_MS = 700;

const WINDOW_ISO = {
  emergencia: { from: "04-01", to: "05-31", days: 61 },
  encanado: { from: "06-01", to: "07-31", days: 61 },
  espigado: { from: "08-01", to: "09-30", days: 61 },
  ciclo: { from: "04-01", to: "10-31", days: 214 },
};

const BANDS = {
  ndvi: "B08 (NIR), B04 (rojo)",
  evi: "B08 (NIR), B04 (rojo), B02 (azul)",
  lai: "bandas de reflectancia B03–B12",
  ndwi: "B03 (verde), B08 (NIR)",
  ndti: "B11 (SWIR1), B12 (SWIR2)",
  sti: "B11 (SWIR1), B12 (SWIR2)",
};

const indexOf = (label) => label.split(" ")[0].toLowerCase();

function bboxOf(points) {
  if (!points.length) return null;
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const f = (n) => n.toFixed(5);
  return `[${f(Math.min(...lngs))}, ${f(Math.min(...lats))}, ${f(Math.max(...lngs))}, ${f(Math.max(...lats))}]`;
}

function linesForFeature(f, year, bbox) {
  const w = WINDOW_ISO[f.window];
  const range = `${year}-${w.from}/${year}-${w.to}`;
  if (f.source === "chirps")
    return [
      { tag: "chirps", text: `Ventana ${WINDOWS[f.window].label}: ${range} (${w.days} días)` },
      { tag: "http", text: `GET ${CHIRPS}/${year}/chirps-v2.0.${year}.MM.DD.cog  × ${w.days} días` },
      { tag: "read", text: "Se lee solo el recorte de la parcela en cada COG diario (lectura por rango, sin bajar el mundo entero)" },
      { tag: "calc", text: `Promedio de lluvia dentro del polígono por día → ${f.method.toLowerCase()} = ${f.unit}` },
    ];
  if (f.source === "scenes")
    return [
      { tag: "stac", text: `POST ${STAC}/search  collections=[sentinel-2-l2a, landsat-c2-l2]` },
      { tag: "stac", text: `bbox=${bbox ?? "—"}  datetime=${range}  eo:cloud_cover ≤ 40` },
      { tag: "calc", text: `${f.method} (solo metadatos de escenas: no se descargan píxeles)` },
    ];
  const idx = indexOf(f.label);
  return [
    { tag: "stac", text: `POST ${STAC}/search  collections=[sentinel-2-l2a]` },
    { tag: "stac", text: `bbox=${bbox ?? "—"}  datetime=${range}  eo:cloud_cover ≤ 40` },
    { tag: "http", text: `GET COG por escena · bandas ${BANDS[idx] ?? "L2A"} + SCL (máscara de nubes/sombras)` },
    { tag: "read", text: "Recorte al polígono de la parcela (solo la ventana de píxeles necesaria)" },
    { tag: "calc", text: `${idx.toUpperCase()} por píxel → promedio dentro del polígono por escena → ${f.method.toLowerCase()} de la ventana` },
  ];
}

const TAG_STYLE = {
  info: "text-sky-700 dark:text-sky-300",
  stac: "text-violet-700 dark:text-violet-300",
  http: "text-amber-700 dark:text-amber-300",
  read: "text-emerald-700 dark:text-emerald-300",
  calc: "text-pink-700 dark:text-pink-300",
  chirps: "text-cyan-700 dark:text-cyan-300",
  model: "text-orange-700 dark:text-orange-300",
};

export default function ExtractionPreview({ points, feature, index, total, predicting, year, features = [], logs, onlyRain = false }) {
  const { accent, resolvedTheme } = useTheme();
  const color = getAccentHex(accent, resolvedTheme);
  const bbox = useMemo(() => bboxOf(points), [points]);

  
  const blocks = useMemo(() => {
    const head = {
      title: "Preparación",
      lines: [
        { tag: "info", text: `Ciclo ${year} · contorno con ${points.length} vértices` },
        { tag: "info", text: `Caja envolvente (lng/lat) = ${bbox ?? "sin contorno"}` },
        { tag: "info", text: onlyRain ? `Solo lluvia: se lee ${SOURCES.chirps.label} (sin cuenta ni cuota)` : `Se leen fuentes abiertas: ${SOURCES.s2.label}, Landsat 8/9, ${SOURCES.chirps.label} (sin cuenta ni cuota)` },
      ],
    };
    const feats = features.map((f, i) => ({
      title: `[${String(i + 1).padStart(2, "0")}/${total}] ${f.label}`,
      lines: linesForFeature(f, year, bbox),
    }));
    const tail = {
      title: `[${String(total + 1).padStart(2, "0")}] Predicción del modelo`,
      lines: [
        { tag: "model", text: total === 1 ? "Lluvia ya extraída de esta parcela" : `Vector de ${total} variables ya extraídas de esta parcela` },
        { tag: "model", text: "Random Forest → rendimiento e intervalo de confianza; SHAP → impacto por variable" },
      ],
    };
    return [head, ...feats, tail];
  }, [features, year, points.length, bbox, total, onlyRain]);

  
  const active = predicting ? total + 1 : index + 1;
  const [shown, setShown] = useState(1); 
  useEffect(() => {
    setShown(1);
    const id = setInterval(() => setShown((n) => n + 1), Math.max(300, Math.min(LINE_MS, STEP_MS / 8)));
    return () => clearInterval(id);
  }, [active]);

  
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [active, shown]);

  const visible = blocks.map((b, i) => (i < active ? b.lines.length : i === active ? Math.min(shown, b.lines.length) : 0));
  
  const startIdx = 0;

  return (
    <div className="relative isolate flex h-[360px] min-w-0 flex-col overflow-hidden border-t border-gray-200 dark:border-gray-800 lg:h-auto lg:min-h-0 lg:border-l lg:border-t-0">
      {}
      <div className="absolute inset-0 flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-white/10 px-4 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-600 dark:text-white/70">Registro del proceso · lo que se descarga</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-white/50">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: color }} /> en curso
        </span>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 font-mono text-[11.5px] leading-relaxed text-gray-700 dark:text-white/80" role="log" aria-live="off">
        {logs?.length
          ? logs.map((l, i) => (
              <p key={i} className="break-words">
                <span className="text-gray-400 dark:text-white/30">{l.t} </span>
                <span className={TAG_STYLE[l.tag] ?? "text-gray-500 dark:text-white/60"}>{l.tag.padEnd(6)}</span> {l.text}
              </p>
            ))
          : blocks.slice(startIdx, active + 1).map((b, bi) => {
              const i = startIdx + bi;
              const n = visible[i];
              if (!n) return null;
              return (
                <div key={i} className="mb-2.5">
                  <p className="font-semibold text-gray-900 dark:text-white" style={i === active ? { color } : undefined}>
                    {i === active ? "▶ " : "✓ "}
                    {b.title}
                  </p>
                  {b.lines.slice(0, n).map((l, li) => (
                    <p key={li} className="break-words pl-4">
                      <span className={TAG_STYLE[l.tag] ?? "text-gray-500 dark:text-white/60"}>{l.tag.padEnd(6)}</span> {l.text}
                    </p>
                  ))}
                  {i === active && n < b.lines.length && <p className="pl-4 text-gray-400 dark:text-white/40">▌</p>}
                </div>
              );
            })}
      </div>

      <footer className="border-t border-gray-200 dark:border-white/10 px-4 py-2 text-[10px] leading-snug text-gray-400 dark:text-white/40">
        {feature ? `${SOURCES[feature.source].dataset}. ` : ""}
        Traza construida a partir del procedimiento de cálculo; el servidor responde en una sola petición y no emite logs en vivo, por eso no se muestran tiempos ni conteos.
      </footer>
      </div>
    </div>
  );
}