import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calculator,
  Check,
  ChevronDown,
  Copy,
  FileUp,
  Loader2,
  Pencil,
  RotateCcw,
  Square,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import GeometryMap from "../components/earthengine/GeometryMap";
import RunProgress from "../components/earthengine/RunProgress";
import ParcelResult from "../components/earthengine/ParcelResult";
import ValidationTable from "../components/earthengine/ValidationTable";
import { classifyRisk, scoreFromInputs } from "../context/ParcelsContext";
import { STEP_MS, predictFromGeometry } from "../services/earthEngineApi";
import { parseGeometryFiles } from "../services/geoApi";
import { ESTADOS, GEE_FEATURES, GEE_QUESTIONS, TRAINED_YEAR, YEARS } from "../data/earthEngine";
import {
  areaHa,
  centroid,
  detectEstado,
  formatHa,
  parseGeoJSON,
  perimeterM,
  selfIntersects,
  toGeoJSONPolygon,
} from "../utils/polygon";
import { formatDistance } from "../utils/geo";

// Validación REAL: salida de backend/validate_gee.py guardada como src/data/earthEngineValidation.json.
// Si el archivo no existe, la pestaña lo dice; nunca muestra cifras de ejemplo.
const REAL_VALIDATION = Object.values(import.meta.glob("../data/earthEngineValidation.json", { eager: true, import: "default" }))[0];

const TABS = [
  { key: "nueva", label: "Nueva parcela" },
  { key: "validacion", label: "Validación del cálculo" },
];

const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-accent-500 focus:outline-hidden focus:ring-1 focus:ring-accent-500 disabled:opacity-50 dark:border-gray-700 dark:bg-black dark:text-gray-200";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

const BTN_DARK =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200";

function SectionHeader({ title, description }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
    </label>
  );
}

function SelectField({ value, onChange, disabled, children }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} disabled={disabled} className={`${FIELD} appearance-none pr-9`}>
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function Notice({ tone = "warn", children }) {
  const border = tone === "error" ? "border-red-500" : tone === "info" ? "border-gray-300 dark:border-gray-700" : "border-amber-500";
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={`flex items-start gap-2 border-l-2 bg-gray-50 py-2 pl-3 pr-3 text-xs leading-relaxed text-gray-700 dark:bg-gray-900/60 dark:text-gray-300 ${border}`}
    >
      <AlertTriangle size={13} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${tone === "error" ? "text-red-600 dark:text-red-400" : "text-gray-500"}`} />
      <span>{children}</span>
    </p>
  );
}

/** Círculo numerado de un paso, solo relleno y en escala de grises: "done" (check) | "active" (oscuro) | "pending" (claro). */
function StepDot({ n, state, running = false }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums transition-colors duration-200 ${
        state === "done"
          ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          : state === "active"
            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
            : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
      }`}
    >
      {state === "done" ? <Check size={12} strokeWidth={2.5} /> : state === "active" && running ? <Loader2 size={12} className="animate-spin" /> : n}
    </span>
  );
}

/** Sección numerada del panel de trabajo: el número pasa a ✓ cuando el paso queda resuelto. */
function PanelSection({ n, state, title, running = false, children }) {
  return (
    <section className="p-5">
      <header className="mb-4 flex items-center gap-3">
        <StepDot n={n} state={state} running={running} />
        <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Metric({ label, wide = false, children }) {
  return (
    <div className={`bg-white px-3 py-2.5 dark:bg-black ${wide ? "col-span-3" : ""}`}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

/** Estado vacío: qué se lee, cuánto tarda y qué se obtiene. Sustituye al antiguo "Cómo funciona". */
function Facts() {
  const items = [
    { label: "Fuentes", text: "Sentinel-2, Landsat y CHIRPS (datos abiertos), resumidos dentro del polígono." },
    { label: "Cálculo", text: "10 variables por ventana fenológica. Tarda entre 30 y 90 s." },
    { label: "Resultado", text: "Rendimiento estimado, intervalo al 90 % y peso SHAP de cada variable." },
  ];
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800 sm:grid-cols-3">
      {items.map(({ label, text }) => (
        <div key={label} className="bg-white p-4 dark:bg-black">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

function downloadBlob(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function NuevaParcelaTab() {
  // ── Geometría ────────────────────────────────────────────────────────────
  const [points, setPoints] = useState([]);
  const [closed, setClosed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const fileRef = useRef(null);

  // ── Datos de la parcela ──────────────────────────────────────────────────
  const [name, setName] = useState("NUEVA_01");
  const [estadoManual, setEstadoManual] = useState(null); // null = usar el detectado por la ubicación
  const [anio, setAnio] = useState(TRAINED_YEAR);

  // ── Ejecución ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState("idle"); // idle | running | done | error
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [ran, setRan] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const timersRef = useRef([]);
  const resultsRef = useRef(null);
  const running = phase === "running";

  const info = useMemo(() => {
    if (!closed || points.length < 3) return null;
    const c = centroid(points);
    return {
      ha: areaHa(points),
      perimeter: perimeterM(points),
      center: c,
      detected: detectEstado(c[0], c[1]),
      crosses: selfIntersects(points),
    };
  }, [closed, points]);

  // El estado se propone solo según dónde cae el polígono, hasta que el usuario lo cambie a mano.
  const estado = estadoManual ?? info?.detected ?? "Puebla";

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearInterval(t) || clearTimeout(t));
    timersRef.current = [];
  };
  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearTimers();
    },
    []
  );

  const warnings = [];
  if (info?.crosses) warnings.push({ tone: "error", text: "El contorno se cruza consigo mismo. Arrastra los vértices o redibuja la parcela." });
  if (info && !info.crosses && info.ha < 1) warnings.push({ tone: "warn", text: "Menos de 1 ha (≈ 100 píxeles de 10 m): el promedio por escena puede ser poco representativo." });
  if (info && info.ha > 1000) warnings.push({ tone: "warn", text: "Es muy grande para una parcela: el promedio mezclaría cultivos y coberturas distintas." });
  if (info && !info.detected) warnings.push({ tone: "warn", text: "El polígono cae fuera de Hidalgo, Puebla y Tlaxcala. El modelo solo se entrenó y validó en esos estados." });
  if (info?.detected && info.detected !== estado) warnings.push({ tone: "warn", text: `El polígono está en ${info.detected} pero elegiste ${estado}; el margen de confianza depende del estado.` });
  if (anio !== TRAINED_YEAR) warnings.push({ tone: "warn", text: `El modelo se entrenó con el ciclo ${TRAINED_YEAR}. Para ${anio} extrapola (clima distinto): léelo con cautela.` });

  const signature = `${points.map((p) => p.map((n) => n.toFixed(6)).join(",")).join(";")}|${estado}|${anio}`;
  const stale = Boolean(result && ran && ran.signature !== signature);
  const canRun = Boolean(info && !info.crosses && name.trim() && estado && !running);

  // ── Acciones de dibujo ───────────────────────────────────────────────────
  const resetResults = () => {
    setPhase("idle");
    setResult(null);
    setRan(null);
    setError(null);
  };
  const startDrawing = () => {
    setPoints([]);
    setClosed(false);
    setDrawing(true);
    resetResults();
  };
  const finishDrawing = () => {
    if (points.length < 3) return;
    setDrawing(false);
    setClosed(true);
  };
  const clearAll = () => {
    setPoints([]);
    setClosed(false);
    setDrawing(false);
    resetResults();
  };
  const undo = () => setPoints((p) => p.slice(0, -1));

  function applyImported(pts, extra = 0) {
    setPoints(pts);
    setClosed(true);
    setDrawing(false);
    setFitKey((k) => k + 1);
    resetResults();
    if (extra) toast.info(`El archivo traía ${extra} polígono${extra === 1 ? "" : "s"} más; usé el primero.`);
  }

  // Shapefile (.zip o .shp+.dbf+.prj), KML/KMZ y GeoJSON en otra proyección los lee el backend (/parse-geometry),
  // que los reproyecta a lat/lng y valida el contorno con las mismas reglas que el cálculo satelital.
  async function importViaBackend(files, localError) {
    const id = toast.loading("Leyendo el archivo…");
    try {
      const res = await parseGeometryFiles(files);
      const poly = res.poligonos.find((p) => !p.error);
      if (!poly) {
        toast.error(res.poligonos[0]?.error || "No encontré ningún polígono que se pueda calcular.", { id, duration: 10000 });
        return;
      }
      const ring = poly.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng]);
      applyImported(ring);
      if (poly.Estado) setEstadoManual(poly.Estado);
      const extra = res.poligonos.length - 1;
      toast.success(
        `«${poly.nombre}» importada (${formatHa(poly.area_ha)} ha).${
          extra > 0 ? ` El archivo traía ${extra} polígono${extra === 1 ? "" : "s"} más; usé el primero.` : ""
        }`,
        { id },
      );
    } catch (err) {
      toast.error(localError || err.message, { id, duration: 10000 });
    }
  }

  async function handleFile(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    // Un GeoJSON suelto en lat/lng se lee aquí mismo, sin backend; si no se puede, lo intenta el backend.
    if (files.length === 1 && /\.(geo)?json$/i.test(files[0].name)) {
      try {
        const { points: pts, extra } = parseGeoJSON(await files[0].text());
        applyImported(pts, extra);
      } catch (err) {
        await importViaBackend(files, err.message);
      }
      return;
    }
    await importViaBackend(files);
  }

  const geoFeature = () => ({
    type: "Feature",
    properties: { ID_POLIGONO: name.trim(), Estado: estado, anio },
    geometry: toGeoJSONPolygon(points),
  });

  async function copyGeoJSON() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(geoFeature(), null, 2));
      toast.success("GeoJSON copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar. Tu navegador bloqueó el portapapeles.");
    }
  }

  // ── Ejecución del cálculo ────────────────────────────────────────────────
  async function run() {
    if (!canRun) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = { name: name.trim(), estado, anio, ha: info.ha, center: info.center, signature };
    const total = GEE_FEATURES.length;

    clearTimers();
    setPhase("running");
    setResult(null);
    setError(null);
    setStepIdx(0);
    setElapsed(0);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

    // La petición es una sola; el avance por variable es una estimación de tiempo.
    const startedAt = Date.now();
    timersRef.current.push(setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500));
    timersRef.current.push(setInterval(() => setStepIdx((i) => Math.min(i + 1, total - 1)), STEP_MS));

    try {
      const data = await predictFromGeometry(
        { ID_POLIGONO: snapshot.name, Estado: estado, geometry: toGeoJSONPolygon(points), anio },
        { signal: controller.signal }
      );
      clearTimers();
      setStepIdx(total); // "Predicción del modelo"
      await new Promise((r) => setTimeout(r, 450));
      if (controller.signal.aborted) return;
      setResult(data);
      setRan(snapshot);
      setPhase("done");
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      clearTimers();
      if (err.name === "AbortError") return;
      const message = err.message || "Error desconocido (la petición falló sin mensaje).";
      setError({ message, status: err.status, url: err.url, raw: err.raw });
      setPhase("error");
      toast.error("No se pudieron calcular los índices", {
        description: err.status ? `${message} (HTTP ${err.status})` : message,
        duration: 10000,
      });
    }
  }

  function cancel() {
    abortRef.current?.abort();
    clearTimers();
    setPhase("idle");
    toast("Cálculo cancelado.");
  }

  // ── Derivados del resultado ──────────────────────────────────────────────
  const view = useMemo(() => {
    if (!result) return null;
    const f = result.features_calculadas ?? {};
    const half = (result.ic90_superior - result.ic90_inferior) / 2;
    const score = scoreFromInputs({
      yieldEstimate: result.yieldEstimate,
      confidence: half,
      ndvi: f.bas_ndvi_emergencia_macollamiento ?? 0,
      precip: f.precip_acum_emergencia_macollamiento_mm ?? 0,
    });
    return { features: f, half, score, risk: classifyRisk(score) };
  }, [result]);

  // Estado de cada paso del panel.
  const s1 = closed ? "done" : "active";
  const s2 = !closed ? "pending" : phase === "done" ? "done" : "active";
  const s3 = phase === "done" && !stale ? "done" : canRun || running ? "active" : "pending";

  const drawHint =
    points.length === 0
      ? drawing
        ? "Haz clic sobre el mapa para marcar el primer vértice."
        : "Dibuja el contorno sobre la imagen satelital o importa un shapefile (.zip), GeoJSON o KML/KMZ."
      : points.length < 3
        ? `${points.length} de 3 vértices mínimos. Sigue marcando sobre el mapa.`
        : `${points.length} vértices. Cierra con «Terminar» o tocando el primer punto.`;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Mapa: protagonista de la pantalla ── */}
        <div className="relative min-h-[460px] sm:min-h-[560px] lg:min-h-[640px]">
          <div className="absolute inset-0">
            <GeometryMap
              points={points}
              closed={closed}
              drawing={drawing}
              locked={running}
              fitKey={fitKey}
              onChange={setPoints}
              onStartDrawing={startDrawing}
              onFinish={finishDrawing}
              onClear={clearAll}
              onUndo={undo}
            />
          </div>
        </div>

        {/* ── Panel de trabajo: tres pasos, de arriba abajo ── */}
        <aside className="min-w-0 self-start divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          <PanelSection n={1} state={s1} title="Contorno de la parcela">
            {info ? (
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
                <Metric label="Superficie">{formatHa(info.ha)} ha</Metric>
                <Metric label="Perímetro">{formatDistance(info.perimeter)}</Metric>
                <Metric label="Vértices">{points.length}</Metric>
                <Metric label="Centroide" wide>
                  {info.center[0].toFixed(5)}, {info.center[1].toFixed(5)}
                </Metric>
              </dl>
            ) : (
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{drawHint}</p>
            )}

            {warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {warnings.map((w) => (
                  <Notice key={w.text} tone={w.tone}>
                    {w.text}
                  </Notice>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <input ref={fileRef} type="file" multiple accept=".geojson,.json,.zip,.shp,.dbf,.prj,.shx,.cpg,.kml,.kmz" onChange={handleFile} className="hidden" />
              {!closed && !drawing && (
                <button type="button" onClick={startDrawing} disabled={running} className={BTN_DARK}>
                  <Pencil size={13} strokeWidth={1.75} /> Dibujar parcela
                </button>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={running} className={BTN}>
                <FileUp size={13} strokeWidth={1.75} className="text-gray-400" /> Importar archivo
              </button>
              {closed && (
                <button type="button" onClick={copyGeoJSON} className={BTN}>
                  <Copy size={13} strokeWidth={1.75} className="text-gray-400" /> Copiar
                </button>
              )}
            </div>
          </PanelSection>

          <PanelSection n={2} state={s2} title="Datos del ciclo">
            <div className="space-y-4">
              <Field label="ID de la parcela">
                <input value={name} onChange={(e) => setName(e.target.value)} disabled={running} placeholder="NUEVA_01" className={FIELD} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado">
                  <SelectField value={estado} disabled={running} onChange={(e) => setEstadoManual(e.target.value)}>
                    {ESTADOS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SelectField>
                </Field>
                <Field label="Año del ciclo">
                  <SelectField value={anio} disabled={running} onChange={(e) => setAnio(Number(e.target.value))}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </SelectField>
                </Field>
              </div>
              <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                {info?.detected && estadoManual === null ? `Estado detectado por la ubicación: ${info.detected}. ` : "El estado define el margen de confianza. "}
                Modelo entrenado con el ciclo {TRAINED_YEAR}.
              </p>
            </div>
          </PanelSection>

          <PanelSection n={3} state={s3} running={running} title="Predicción">
            {running ? (
              <button type="button" onClick={cancel} className={`${BTN} w-full gap-2 px-4 py-2.5 text-sm font-medium`}>
                <Square size={14} /> Cancelar cálculo
              </button>
            ) : (
              <button
                type="button"
                onClick={run}
                disabled={!canRun}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black"
              >
                <Calculator size={15} strokeWidth={1.75} />
                {result ? "Recalcular índices satelitales" : "Calcular índices satelitales"}
              </button>
            )}
            <p className="mt-3 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              {canRun || running
                ? "Se leen imágenes reales de 10 variables. Tarda entre 30 y 90 s."
                : info?.crosses
                  ? "Corrige el contorno para poder calcular."
                  : "Cierra el contorno de la parcela para habilitar el cálculo."}
            </p>
          </PanelSection>
        </aside>
      </div>

      {/* ── Resultados, a todo el ancho ── */}
      <div ref={resultsRef} className="scroll-mt-6 space-y-12">
        {phase === "idle" && !result && <Facts />}

        {running && <RunProgress current={stepIdx} elapsedSec={elapsed} year={anio} />}

        {phase === "error" && (
          <div className="space-y-4 border-l-2 border-red-500 bg-gray-50 py-4 pl-5 pr-5 dark:bg-gray-900/60">
            <div>
              <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">No se pudieron calcular los índices</h2>
              <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-400">{error?.message}</p>
              {(error?.status || error?.url || error?.raw) && (
                <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <summary className="cursor-pointer select-none font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
                    Detalle técnico
                  </summary>
                  <dl className="mt-2 space-y-1">
                    {error.status ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium">Código HTTP:</dt>
                        <dd className="tabular-nums">{error.status}</dd>
                      </div>
                    ) : null}
                    {error.url ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium">Endpoint:</dt>
                        <dd className="break-all">{error.url}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {error.raw ? (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/5 p-3 font-mono text-[11px] leading-relaxed dark:bg-white/5">
                      {error.raw}
                    </pre>
                  ) : null}
                </details>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={run}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-accent-contrast hover:bg-accent-600"
              >
                <RotateCcw size={13} strokeWidth={1.75} /> Reintentar
              </button>
              <button type="button" onClick={() => setPhase("idle")} className={BTN}>
                Editar parcela
              </button>
            </div>
          </div>
        )}

        {result && view && ran && (
          <>
            {(stale || result.advertencias?.length > 0) && (
              <div className="space-y-2">
                {result.advertencias?.map((w) => (
                  <Notice key={w}>{w}</Notice>
                ))}
                {stale && (
                  <Notice>
                    Cambiaste el contorno, el estado o el año después de calcular. Pulsa «Recalcular índices satelitales» para actualizar este resultado.
                  </Notice>
                )}
              </div>
            )}

            <ParcelResult
              result={result}
              view={view}
              ran={ran}
              stale={stale}
              onDownload={() =>
                downloadBlob(
                  `${ran.name}_features_${ran.anio}.json`,
                  JSON.stringify({ ID_POLIGONO: ran.name, Estado: ran.estado, anio: ran.anio, features: view.features }, null, 2),
                )
              }
              onReset={clearAll}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ValidacionTab() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="¿Qué tan fiel es el cálculo en vivo?"
        description="Se corre la misma extracción sobre parcelas del dataset oficial y se compara contra features_completo.csv. Índices y lluvia deben quedar dentro de ±15 %; el conteo de escenas puede diferir más."
      />

      {REAL_VALIDATION ? (
        <ValidationTable rows={REAL_VALIDATION} />
      ) : (
        <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-800">
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Aún no se ha corrido la validación</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Esta pestaña solo muestra resultados reales. Para generarlos, desde la carpeta <code>backend/</code> ejecuta{" "}
            <code>python validate_gee.py --csv … --shp … --n 5</code> y copia el archivo que genera a{" "}
            <code>cebix/src/data/earthEngineValidation.json</code>. Verás aquí la diferencia porcentual de cada variable contra el
            dataset oficial.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Criterio de aceptación</h3>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-gray-600 marker:text-gray-300 dark:text-gray-400 dark:marker:text-gray-600">
            <li>Índices espectrales y precipitación: diferencia dentro de ±15 %.</li>
            <li>Densidad de observaciones: puede diferir más (±30 %); si es sistemático, se ajusta o se documenta.</li>
            <li>Diferencias pequeñas son normales: distinta versión del procesamiento atmosférico o geometría exacta.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Si algo sale fuera de rango, revisa</h3>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-gray-600 marker:text-gray-300 dark:text-gray-400 dark:marker:text-gray-600">
            <li>Que el polígono esté en lat/lng y no en UTM.</li>
            <li>Que se use promedio por escena → mediana por ventana, y no un compuesto por píxel.</li>
            <li>Que la lluvia sume los 61 días de abril y mayo (si falta un día, el backend no devuelve el valor).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function EarthEnginePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.key === requested) ? requested : "nueva";

  return (
    <>
      <TopBar
        title="Parcela satelital"
        subtitle="Dibuja una parcela nueva y obtén su predicción con índices calculados en vivo desde imágenes reales."
        hideSearch
        actions={
          <>
            <InfoButton title="Acerca de la parcela satelital" questions={GEE_QUESTIONS} />
          </>
        }
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-gray-200 scrollbar-none dark:border-gray-800">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setParams({ tab: t.key }, { replace: true })}
                className={`-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent-500 text-gray-900 dark:text-white"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* La pestaña de dibujo permanece montada para no perder el polígono ni el resultado al cambiar de pestaña. */}
        <div hidden={tab !== "nueva"}>
          <NuevaParcelaTab />
        </div>
        {tab === "validacion" && <ValidacionTab />}
      </div>
    </>
  );
}
