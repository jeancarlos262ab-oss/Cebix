import { userMessage } from "../utils/userMessages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "../services/toast";
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
  Save,
  Square,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import GeometryMap from "../components/geomap/GeometryMap";
import { Collapse, SlideList } from "../components/ui/Collapse";
import RunProgress from "../components/satelite/RunProgress";
import ParcelResult from "../components/satelite/ParcelResult";
import ValidationTable from "../components/satelite/ValidationTable";
import ValidationRunner from "../components/satelite/ValidationRunner";
import { Z90, classifyRisk, scoreFromInputs, useParcels } from "../context/ParcelsContext";
import { predictFromGeometry } from "../services/sateliteApi";
import ModeSelector from "../components/model/ModeSelector";
import { parseGeometryFiles } from "../services/geoApi";
import { ESTADOS, MAX_AREA_HA, SAT_QUESTIONS, TRAINED_YEAR, WARN_AREA_HA, YEARS } from "../data/satelite";
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
import { checkPointUrban, checkUrban } from "../utils/urbanCheck";

// Validación REAL: salida de backend/scripts/validate_satelite.py guardada como src/data/sateliteValidation.json.
// Si el archivo no existe, la pestaña lo dice; nunca muestra cifras de ejemplo.
const REAL_VALIDATION = Object.values(import.meta.glob("../data/sateliteValidation.json", { eager: true, import: "default" }))[0];

const TABS = [
  { key: "nueva", label: "Nueva parcela" },
  { key: "validacion", label: "Validación del cálculo" },
];

const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-accent-500 focus:outline-hidden focus:ring-1 focus:ring-accent-500 disabled:opacity-50 dark:border-gray-700 dark:bg-black dark:text-gray-200";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

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

function Notice({ tone = "warn", children, action = null, loading = false }) {
  const border = tone === "error" ? "border-red-500" : tone === "info" ? "border-gray-300 dark:border-gray-700" : "border-amber-500";
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={`flex items-start gap-2 border-l-2 bg-gray-50 py-2 pl-3 pr-3 text-xs leading-relaxed text-gray-700 dark:bg-gray-900/60 dark:text-gray-300 ${border}`}
    >
      {loading ? (
        <Loader2 size={16} strokeWidth={2.25} className="mt-px shrink-0 animate-spin text-accent-600 dark:text-accent-400" aria-hidden="true" />
      ) : (
        <AlertTriangle size={13} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${tone === "error" ? "text-red-600 dark:text-red-400" : "text-gray-500"}`} />
      )}
      <span>
        {children}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="ml-2 inline rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {action.label}
          </button>
        )}
      </span>
    </p>
  );
}

/** Círculo numerado de un paso: "done" (check, acento suave) | "active" (acento sólido) | "pending" (gris). */
function StepDot({ n, state, running = false }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-200 ${
        state === "done"
          ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
          : state === "active"
            ? "bg-accent-500 text-accent-contrast"
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
    <section className="px-5 py-5">
      <header className="mb-4 flex items-center gap-3">
        <StepDot n={n} state={state} running={running} />
        <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Metric({ label, wide = false, accent = false, children }) {
  return (
    <div className={`bg-white px-3 py-2.5 dark:bg-black ${wide ? "col-span-3" : ""}`}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${
          accent ? "text-accent-600 dark:text-accent-400" : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {children}
      </dd>
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
  // El avance por variable y el cronómetro viven dentro de <RunProgress>: así los temporizadores solo
  // vuelven a pintar ese panel y no toda la pantalla (mapa y formulario incluidos).
  const [predicting, setPredicting] = useState(false); // ya llegó la respuesta: "Predicción del modelo"
  const [result, setResult] = useState(null);
  const [ran, setRan] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const resultsRef = useRef(null);
  const running = phase === "running";

  // ── Guardado: el resultado se guarda en las parcelas del usuario (Supabase) solo al pulsar 'Guardar parcela'.
  const { addParcel, updateParcel, isCustomParcel } = useParcels();
  const [savedId, setSavedId] = useState(null); // parcela guardada de la última vez (se actualiza al volver a guardar)
  const [savedFor, setSavedFor] = useState(null); // resultado (objeto `ran`) que ya quedó guardado
  const [saving, setSaving] = useState(false);

  // ── Zona urbana: se consulta OpenStreetMap cada vez que cambia el contorno cerrado.
  const [urban, setUrban] = useState({ status: "idle" }); // idle | checking | ok | urban | unknown
  const [recheck, setRecheck] = useState(0); // sube al pulsar 'Reintentar verificación'
  // La persona puede OMITIR la verificación de zona urbana: desde ahí la validez del resultado depende de ella.
  const [urbanOverride, setUrbanOverride] = useState(false);
  const [vertexHit, setVertexHit] = useState(false); // se rechazó un vértice por caer en zona urbana
  const urbanCtlRef = useRef(null);
  const urbanOverrideRef = useRef(false);
  urbanOverrideRef.current = urbanOverride;

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

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!closed || points.length < 3) {
      setUrban({ status: "idle" });
      if (points.length === 0) {
        setUrbanOverride(false); // parcela nueva: vuelve a verificarse
        setVertexHit(false);
      }
      return undefined;
    }
    const controller = new AbortController();
    urbanCtlRef.current = controller;
    setUrban({ status: "checking" });
    // Espera un instante a que se deje de mover el vértice para no consultar en cada arrastre.
    const timer = setTimeout(async () => {
      try {
        const r = await checkUrban(points, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setUrban({ status: r.urban ? "urban" : "ok", ...r });
        if (r.urban && !urbanOverrideRef.current)
          toast.error("Ese contorno cae sobre una zona urbana. Dibuja la parcela sobre terreno agrícola o usa 'Omitir verificación' si estás seguro.", { id: "urban-block" });
      } catch (err) {
        if (err.name === "AbortError" || controller.signal.aborted) return;
        console.warn("No se pudo verificar la zona urbana", err);
        setUrban({ status: "unknown" });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [closed, points, recheck]);

  const isUrban = urban.status === "urban"; // se detectó zona urbana
  const urbanBlocked = isUrban && !urbanOverride; // ...y la persona no omitió la verificación
  const overLimit = Boolean(info && info.ha > MAX_AREA_HA);
  const skipUrbanCheck = () => {
    urbanCtlRef.current?.abort(); // se descarta la consulta a OpenStreetMap en curso
    setUrbanOverride(true);
    setVertexHit(false);
    setUrban({ status: "skipped" });
  };
  const warnings = [];
  if (isUrban) {
    const why = {
      landuse: `cerca del ${Math.round((urban.share ?? 0) * 100)} % del contorno está sobre mancha urbana`,
      place: "hay un poblado marcado dentro del contorno",
      streets: `hay ${urban.streets} calles urbanas dentro del contorno`,
      buildings: `hay ${urban.buildings} construcciones dentro del contorno (${(urban.perHa ?? 0).toFixed(1)} por ha)`,
      amenities: `hay ${urban.amenities} comercios, escuelas o iglesias dentro del contorno`,
    }[urban.reason] ?? "se detectó una zona urbana";
    if (urbanOverride) {
      warnings.push({
        tone: "warn",
        text: `Omitiste la verificación de zona urbana (${why}). Desde ahora es tu responsabilidad que esta parcela sea terreno agrícola: si cae sobre una ciudad o un pueblo, el resultado no será válido.`,
        action: { label: "Volver a verificar", onClick: () => setUrbanOverride(false) },
      });
    } else {
      warnings.push({
        tone: "error",
        text: `Esta parcela cae sobre una ciudad o un pueblo (${why}). No se puede calcular ni guardar: mueve los vértices a terreno agrícola o dibuja otra parcela. Si estás seguro de que es terreno agrícola, puedes omitir la verificación, pero entonces la validez del resultado depende de ti.`,
        action: { label: "Omitir verificación", onClick: () => setUrbanOverride(true) },
      });
    }
  } else if (vertexHit && !urbanOverride) {
    warnings.push({
      tone: "warn",
      text: "Un vértice se rechazó porque ahí hay una ciudad o un pueblo. Si estás seguro de que es terreno agrícola, puedes omitir la verificación; desde ahí, que el resultado sea válido depende de ti.",
      action: { label: "Omitir verificación", onClick: () => { setUrbanOverride(true); setVertexHit(false); } },
    });
  }
  if (urban.status === "checking")
    warnings.push({
      tone: "info",
      loading: true,
      text: "Verificando que el contorno no caiga sobre una zona urbana…",
      action: { label: "Omitir", onClick: skipUrbanCheck },
    });
  if (urban.status === "skipped")
    warnings.push({
      tone: "warn",
      text: "Verificación de zona urbana omitida: asegúrate tú de que la parcela sea terreno agrícola; si cae sobre un pueblo o una ciudad, el resultado no será válido.",
      action: { label: "Verificar", onClick: () => { setUrbanOverride(false); setRecheck((k) => k + 1); } },
    });
  if (urban.status === "unknown")
    warnings.push({ tone: "warn", text: "No se pudo verificar que el contorno sea terreno agrícola (OpenStreetMap no respondió). Puedes calcular de todos modos, pero asegúrate tú de que la parcela no caiga sobre un pueblo o una ciudad: si es así, el resultado no será válido. También puedes pulsar 'Reintentar verificación'." });
  if (info?.crosses) warnings.push({ tone: "error", text: "El contorno se cruza consigo mismo. Arrastra los vértices o redibuja la parcela." });
  if (info && !info.crosses && info.ha < 1) warnings.push({ tone: "warn", text: "Menos de 1 ha (≈ 100 píxeles de 10 m): el promedio por escena puede ser poco representativo." });
  if (overLimit)
    warnings.push({
      tone: "error",
      text: `La parcela mide ${formatHa(info.ha)} ha y el máximo es ${formatHa(MAX_AREA_HA)} ha: el servicio no alcanza a procesar una zona tan grande. Arrastra los vértices para reducirla o dibuja parcelas más chicas; el cálculo se habilita en cuanto quede dentro del límite.`,
    });
  else if (info && !info.crosses && info.ha > WARN_AREA_HA)
    warnings.push({ tone: "warn", text: "Es muy grande para una parcela: el promedio mezclaría cultivos y coberturas distintas." });
  if (info && !info.detected) warnings.push({ tone: "warn", text: "El polígono cae fuera de Hidalgo, Puebla y Tlaxcala. El modelo solo se entrenó y validó en esos estados." });
  if (info?.detected && info.detected !== estado) warnings.push({ tone: "warn", text: `El polígono está en ${info.detected} pero elegiste ${estado}; el margen de confianza depende del estado.` });
  if (anio !== TRAINED_YEAR) warnings.push({ tone: "warn", text: `El modelo se entrenó con el ciclo ${TRAINED_YEAR}. Para ${anio} extrapola (clima distinto): léelo con cautela.` });

  const signature = `${points.map((p) => p.map((n) => n.toFixed(6)).join(",")).join(";")}|${estado}|${anio}`;
  const stale = Boolean(result && ran && ran.signature !== signature);
  const canRun = Boolean(info && !info.crosses && !overLimit && !urbanBlocked && (urban.status === "ok" || urban.status === "unknown" || urban.status === "skipped") && name.trim() && estado && !running);

  // ── Acciones de dibujo ───────────────────────────────────────────────────
  // Handlers estables: GeometryMap está memoizado y no debe repintarse al escribir el nombre de la parcela.
  const resetResults = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setRan(null);
    setError(null);
    setSavedId(null);
    setSavedFor(null);
  }, []);
  const startDrawing = useCallback(() => {
    setPoints([]);
    setClosed(false);
    setDrawing(true);
    resetResults();
  }, [resetResults]);
  // Cada vértice nuevo (o movido) se verifica contra OpenStreetMap: si cae sobre una ciudad o un pueblo se rechaza
  // en el momento y la parcela vuelve a como estaba. Si OpenStreetMap no responde no se bloquea (la verificación
  // del contorno completo, al cerrarlo, vuelve a intentarlo y avisa).
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onPointsChange = useCallback((next) => {
    const prev = pointsRef.current;
    setPoints(next);

    let vertex = null;
    let restore = null; // vértice anterior (arrastre) o null (vértice recién agregado: se quita)
    if (next.length === prev.length + 1) vertex = next[next.length - 1];
    else if (next.length === prev.length) {
      const i = next.findIndex((p, k) => p[0] !== prev[k][0] || p[1] !== prev[k][1]);
      if (i >= 0) {
        vertex = next[i];
        restore = prev[i];
      }
    }
    if (!vertex) return;

    if (urbanOverrideRef.current) return; // verificación omitida por la persona
    const same = (p) => p[0] === vertex[0] && p[1] === vertex[1];
    checkPointUrban(vertex)
      .then((r) => {
        if (!r.urban) {
          setVertexHit(false);
          return;
        }
        setVertexHit(true);
        setPoints((cur) => (restore ? cur.map((p) => (same(p) ? restore : p)) : cur.filter((p) => !same(p))));
        toast.error("Ahí hay una ciudad o un pueblo. Marca el vértice sobre terreno agrícola o usa 'Omitir verificación'.", { id: "urban-vertex" });
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.warn("No se pudo verificar el vértice", err);
      });
  }, []);
  const pointCount = points.length;
  const finishDrawing = useCallback(() => {
    if (pointCount < 3) return;
    setDrawing(false);
    setClosed(true);
  }, [pointCount]);
  const clearAll = useCallback(() => {
    setPoints([]);
    setClosed(false);
    setDrawing(false);
    resetResults();
  }, [resetResults]);
  const undo = useCallback(() => setPoints((p) => p.slice(0, -1)), []);

  function applyImported(pts, extra = 0) {
    setUrbanOverride(false);
    setVertexHit(false);
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
        toast.error(userMessage(res.poligonos[0]?.error, "No encontré ningún polígono que se pueda calcular."), { id, duration: 10000 });
        return;
      }
      const ring = poly.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng]);
      applyImported(ring);
      if (poly.Estado) setEstadoManual(poly.Estado);
      const extra = res.poligonos.length - 1;
      toast.success(
        `'${poly.nombre}' importada (${formatHa(poly.area_ha)} ha).${
          extra > 0 ? ` El archivo traía ${extra} polígono${extra === 1 ? "" : "s"} más; usé el primero.` : ""
        }`,
        { id },
      );
    } catch (err) {
      toast.error(userMessage(localError || err, "No se pudo leer el archivo."), { id, duration: 10000 });
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
    if (urbanBlocked) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = { name: name.trim(), estado, anio, ha: info.ha, center: info.center, signature, geometry: toGeoJSONPolygon(points) };

    setPhase("running");
    setPredicting(false);
    setResult(null);
    setError(null);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

    // La petición es una sola; el avance por variable es una estimación de tiempo (la lleva <RunProgress>).
    try {
      const data = await predictFromGeometry(
        { ID_POLIGONO: snapshot.name, Estado: estado, geometry: toGeoJSONPolygon(points), anio },
        { signal: controller.signal }
      );
      setPredicting(true); // "Predicción del modelo"
      await new Promise((r) => setTimeout(r, 450));
      if (controller.signal.aborted) return;
      setResult(data);
      setRan(snapshot);
      setPhase("done");
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (err.name === "AbortError") return;
      const message = userMessage(err, "No pudimos completar el cálculo.");
      setError({ message }); // el detalle técnico (código, URL, cuerpo) queda solo en la consola
      setPhase("error");
      toast.error("No se pudieron calcular los índices", {
        description: message,
        duration: 10000,
      });
    }
  }

  async function saveResult() {
    if (!result || !view || !ran || saving || stale || urbanBlocked) return;
    const f = view.features;
    const fields = {
      name: ran.name,
      area: `${ran.ha.toFixed(2)} ha`,
      yieldEstimate: result.yieldEstimate,
      confidence: view.half,
      score: view.score, // el mismo score que se ve en pantalla
      region: ran.estado,
      municipio: "—",
      lat: ran.center[0],
      lng: ran.center[1],
      ndvi: f.bas_ndvi_emergencia_macollamiento ?? 0,
      evi: f.bas_evi_emergencia_macollamiento ?? 0,
      precip: f.precip_acum_emergencia_macollamiento_mm ?? 0,
      gdd: 0, // el cálculo satelital no incluye grados-día
      shap: result.shap ?? [], // SHAP real de esta predicción
      // Todo lo calculado, para poder reabrirlo después: contorno, las 10 variables, intervalo y ciclo.
      satelite: {
        version: 1,
        geometry: ran.geometry,
        anio: ran.anio,
        estado: ran.estado,
        features: result.features_calculadas ?? {},
        ic90_inferior: result.ic90_inferior,
        ic90_superior: result.ic90_superior,
        advertencias: result.advertencias ?? [],
        proveedor: result.proveedor ?? null,
        calculado_en: new Date().toISOString(),
      },
    };
    setSaving(true);
    // Si ya se había guardado y sigue existiendo, se actualiza en vez de duplicarla.
    const res = savedId && isCustomParcel(savedId) ? await updateParcel(savedId, fields) : await addParcel(fields);
    setSaving(false);
    if (res?.error || !res?.data) {
      console.error("No se pudo guardar la parcela", res?.error);
      toast.error("No se pudo guardar la parcela.", { description: userMessage(res?.error, "Inténtalo de nuevo en un momento.") });
      return;
    }
    setSavedId(res.data.id);
    setSavedFor(ran);
    if (res.warning === "satelite-column") {
      toast.warning(`'${ran.name}' guardada, pero sin el detalle del cálculo.`, {
        description: "No se pudo guardar el detalle del cálculo satelital. Avisa al administrador de la aplicación.",
        duration: 12000,
      });
      return;
    }
    toast.success(`'${ran.name}' guardada en tus parcelas con todo lo calculado.`);
  }

  const isSaved = Boolean(savedId && savedFor === ran);
  // Un cálculo tarda hasta 90 s: si hay un resultado sin guardar, el navegador avisa antes de cerrar o recargar.
  const unsaved = phase === "done" && Boolean(result) && !isSaved;
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function cancel() {
    abortRef.current?.abort();
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
      confidence: half / Z90, // el score usa el error típico (σ); el IC 90 % es ±1.645 σ
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
        : "Dibuja el contorno sobre la imagen satelital o importa un shapefile (.zip o .shp/.dbf/.prj/.shx/.cpg), GeoJSON o KML/KMZ."
      : points.length < 3
        ? `${points.length} de 3 vértices mínimos. Sigue marcando sobre el mapa.`
        : `${points.length} vértices. Cierra con 'Terminar' o tocando el primer punto.`;

  return (
    <div className="space-y-8">
      {/* Un solo contenedor para el mapa y el panel de trabajo (separados por una línea fina) */}
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Mapa: protagonista de la pantalla ── */}
        <div className="relative min-h-[460px] sm:min-h-[560px] lg:min-h-[640px]">
          <div className="absolute inset-0">
            <GeometryMap
              points={points}
              closed={closed}
              drawing={drawing}
              locked={running}
              overLimit={overLimit || urbanBlocked}
              maxAreaHa={MAX_AREA_HA}
              fitKey={fitKey}
              onChange={onPointsChange}
              onStartDrawing={startDrawing}
              onFinish={finishDrawing}
              onClear={clearAll}
              onUndo={undo}
            />
          </div>
        </div>

        {/* ── Panel de trabajo: tres pasos, de arriba abajo ── */}
        <aside className="min-w-0 divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:border-l lg:border-t-0">
          <PanelSection n={1} state={s1} title="Contorno de la parcela">
            {info ? (
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
                <Metric label="Superficie" accent>{formatHa(info.ha)} ha</Metric>
                <Metric label="Perímetro">{formatDistance(info.perimeter)}</Metric>
                <Metric label="Vértices">{points.length}</Metric>
                <Metric label="Centroide" wide>
                  {info.center[0].toFixed(5)}, {info.center[1].toFixed(5)}
                </Metric>
              </dl>
            ) : (
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{drawHint}</p>
            )}

            <Collapse open={warnings.length > 0}>
              <div className="pt-2">
                <SlideList
                  items={warnings.map((w) => ({ ...w, key: w.text }))}
                  render={(w) => <Notice tone={w.tone} action={w.action} loading={w.loading}>{w.text}</Notice>}
                />
              </div>
            </Collapse>

            <div className="mt-4 flex flex-wrap gap-2">
              <input ref={fileRef} type="file" multiple accept=".geojson,.json,.zip,.shp,.dbf,.prj,.shx,.cpg,.kml,.kmz" onChange={handleFile} className="hidden" />
              {!closed && !drawing && (
                <button
                  type="button"
                  onClick={startDrawing}
                  disabled={running}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:opacity-40 dark:focus-visible:ring-offset-black"
                >
                  <Pencil size={13} strokeWidth={1.75} /> Dibujar parcela
                </button>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={running} className={BTN}>
                <FileUp size={13} strokeWidth={1.75} className="text-gray-400" /> Importar archivo
              </button>
              {urban.status === "unknown" && (
                <button type="button" onClick={() => setRecheck((k) => k + 1)} className={BTN}>
                  <RotateCcw size={13} strokeWidth={1.75} className="text-gray-400" /> Reintentar verificación
                </button>
              )}
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
            {!running && <ModeSelector stacked className="mb-3" />}
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
            {!running && phase === "done" && result && ran && (
              <div className="mt-3">
                {isSaved ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Check size={13} strokeWidth={2.25} /> Guardada con todo lo calculado
                    </span>
                    <Link to={`/parcelas/${savedId}`} className="underline underline-offset-2">
                      Ver parcela
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={saveResult}
                    disabled={saving || stale || urbanBlocked}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-500 px-4 py-2.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:text-accent-400 dark:hover:bg-accent-500/10 dark:focus-visible:ring-offset-black"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} strokeWidth={1.75} />}
                    {saving ? "Guardando…" : "Guardar parcela"}
                  </button>
                )}
                {!isSaved && (
                  <p className="mt-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                    {stale ? "Recalcula antes de guardar: el contorno cambió." : "El cálculo no se guarda solo. Pulsa 'Guardar parcela' para conservarlo en tus parcelas."}
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              {canRun && urban.status === "skipped"
                ? "Verificación de zona urbana omitida: la validez del resultado depende de que la parcela sea terreno agrícola. Se leen imágenes reales de 10 variables (30 a 90 s)."
                : canRun && urbanOverride && isUrban
                ? "Verificación de zona urbana omitida: la validez del resultado depende de que la parcela sea terreno agrícola. Se leen imágenes reales de 10 variables (30 a 90 s)."
                : canRun && urban.status === "unknown"
                ? "Sin verificar la zona urbana: si la parcela cae sobre un pueblo o una ciudad, el resultado no será válido. Se leen imágenes reales de 10 variables (30 a 90 s)."
                : canRun || running
                ? "Se leen imágenes reales de 10 variables. Tarda entre 30 y 90 s."
                : urbanBlocked
                  ? "El contorno cae sobre una zona urbana: muévelo a terreno agrícola u omite la verificación para poder calcular."
                  : urban.status === "checking"
                    ? "Verificando que no sea zona urbana…"
                : overLimit
                  ? `Reduce la parcela a ${formatHa(MAX_AREA_HA)} ha o menos para poder calcular.`
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

        {running && <RunProgress predicting={predicting} year={anio} points={points} />}

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
                {result.advertencias?.some((w) => /mediana de entrenamiento|CHIRPS: faltaron/i.test(w)) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-amber-500 bg-gray-50 py-2 pl-3 pr-3 text-xs leading-relaxed text-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
                    <span>
                      {result.advertencias.some((w) => /mediana de entrenamiento/i.test(w))
                        ? "Parte de la lluvia (CHIRPS) no se pudo leer y el modelo la sustituyó por la mediana de entrenamiento: este resultado es menos preciso."
                        : "Faltaron algunos días de lluvia (CHIRPS) y la suma se estimó con los días válidos: el resultado es aproximado."}{" "}
                      Suele ser un bloqueo temporal del servidor de CHIRPS; reintentar casi siempre lo resuelve.
                    </span>
                    <button
                      type="button"
                      onClick={run}
                      disabled={running}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-accent-contrast hover:bg-accent-600 disabled:opacity-60"
                    >
                      <RotateCcw size={13} strokeWidth={1.75} /> Reintentar cálculo
                    </button>
                  </div>
                )}
                {stale && (
                  <Notice>
                    Cambiaste el contorno, el estado o el año después de calcular. Pulsa &quot;Recalcular índices satelitales&quot; para actualizar este resultado.
                  </Notice>
                )}
              </div>
            )}

            <ParcelResult
              result={result}
              view={view}
              ran={ran}
              stale={stale}
              save={{ saving, savedId: savedFor === ran ? savedId : null, onSave: saveResult }}
              downloaded={{ ID_POLIGONO: ran.name, Estado: ran.estado, anio: ran.anio, geometry: ran.geometry, features: view.features }}
              onDownload={(payload) => downloadBlob(`${ran.name}_features_${ran.anio}.json`, JSON.stringify(payload, null, 2))}
              onReset={clearAll}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ValidacionTab({ rows, setRows }) {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="¿Qué tan fiel es el cálculo en vivo?"
        description="Se repite el cálculo satelital sobre parcelas de referencia y se compara con los valores oficiales. Los índices y la lluvia deben quedar dentro de ±15 %; el número de imágenes puede diferir más."
      />

      <ValidationRunner onRows={setRows} />

      {rows.length > 0 ? (
        <ValidationTable
          rows={rows}
          onClear={() => setRows([])}
          onDownload={() => downloadBlob("validacion_satelite.json", JSON.stringify(rows.map(({ id, official, live }) => ({ id, official, live })), null, 2))}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Aún no hay parcelas comparadas</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Sube arriba el CSV con los valores oficiales y los contornos de esas parcelas, y pulsa &quot;Calcular y comparar&quot;. Los resultados
            aparecen aquí, parcela por parcela, a medida que se calculan.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Criterio de aceptación</h3>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-gray-600 marker:text-gray-300 dark:text-gray-400 dark:marker:text-gray-600">
            <li>Índices espectrales y precipitación: diferencia dentro de ±15 %.</li>
            <li>Densidad de observaciones: puede diferir más (±30 %); si es sistemático, se ajusta o se documenta.</li>
            <li>Diferencias pequeñas son normales: distinta versión del procesamiento atmosférico o geometría exacta.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Si algo sale fuera de rango, revisa</h3>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-gray-600 marker:text-gray-300 dark:text-gray-400 dark:marker:text-gray-600">
            <li>Que el polígono esté en lat/lng y no en UTM.</li>
            <li>Que se use promedio por escena → mediana por ventana, y no un compuesto por píxel.</li>
            <li>Que la lluvia sume los 61 días de abril y mayo (si falta un día, no se puede calcular el valor).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function SatelitePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.key === requested) ? requested : "nueva";
  // Los resultados de la validación viven aquí para no perderse (ni cortar un cálculo en curso) al cambiar de pestaña.
  const [validationRows, setValidationRows] = useState(() => (Array.isArray(REAL_VALIDATION) ? REAL_VALIDATION.map((r) => ({ ...r, live: r.live ?? r.gee })) : []));

  return (
    <>
      <TopBar
        title="Parcela satelital"
        subtitle="Dibuja una parcela nueva y obtén su predicción con índices calculados en vivo desde imágenes reales."
        hideSearch
        actions={
          <>
            <InfoButton title="Acerca de la parcela satelital" questions={SAT_QUESTIONS} />
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
        <div hidden={tab !== "validacion"}>
          <ValidacionTab rows={validationRows} setRows={setValidationRows} />
        </div>
      </div>
    </>
  );
}
