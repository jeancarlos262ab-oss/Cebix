import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, MapPinned, Play, Square } from "lucide-react";
import Dropzone from "../ui/Dropzone";
import { parseCSV } from "../../utils/csv";
import { SAT_FEATURES, TRAINED_YEAR, YEARS } from "../../data/satelite";
import { parseGeometryFiles } from "../../services/geoApi";
import { predictFromGeometry } from "../../services/sateliteApi";

const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-accent-500 focus:outline-hidden focus:ring-1 focus:ring-accent-500 disabled:opacity-50 dark:border-gray-700 dark:bg-black dark:text-gray-200";

/** Lee el CSV oficial (features_completo.csv o similar): ID_POLIGONO + las 10 variables del modelo. */
async function readOfficial(file) {
  const rows = parseCSV(await file.text());
  if (!rows.length) throw new Error("El CSV está vacío.");
  if (!("ID_POLIGONO" in rows[0])) throw new Error("El CSV necesita una columna ID_POLIGONO.");
  const missing = SAT_FEATURES.map((f) => f.key).filter((k) => !(k in rows[0]));
  if (missing.length) throw new Error(`Faltan columnas en el CSV: ${missing.join(", ")}.`);

  // En features_completo.csv solo se comparan las parcelas de ENTRENAMIENTO (las del dataset oficial).
  const hasSet = "CONJUNTO" in rows[0];
  const usable = hasSet && rows.some((r) => r.CONJUNTO === "ENTRENAMIENTO") ? rows.filter((r) => r.CONJUNTO === "ENTRENAMIENTO") : rows;

  const map = new Map();
  for (const r of usable) {
    const official = {};
    for (const f of SAT_FEATURES) {
      const v = parseFloat(r[f.key]);
      official[f.key] = Number.isFinite(v) ? v : null;
    }
    map.set(r.ID_POLIGONO, { estado: r.Estado || "Puebla", official });
  }
  return map;
}

/** Reparte la muestra entre estados (como validate_satelite.py) para que no salgan todas de uno solo. */
function pickSample(ids, officialMap, n) {
  const groups = new Map();
  for (const id of ids) {
    const estado = officialMap.get(id).estado;
    if (!groups.has(estado)) groups.set(estado, []);
    groups.get(estado).push(id);
  }
  const lists = [...groups.values()];
  const out = [];
  for (let i = 0; out.length < n && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length && out.length < n) out.push(l[i]);
  }
  return out;
}

/**
 * Corre la validación del cálculo en vivo desde la pantalla (lo que antes hacía scripts/validate_satelite.py):
 * cruza el CSV oficial con los contornos por ID_POLIGONO, calcula cada parcela desde satélite con
 * POST /predict-from-geometry (una por una, ~30–90 s cada una) y va agregando los resultados a la tabla.
 */
export default function ValidationRunner({ onRows }) {
  const [csvName, setCsvName] = useState("");
  const [official, setOfficial] = useState(null); // Map id -> { estado, official }
  const [geoName, setGeoName] = useState("");
  const [polys, setPolys] = useState(null); // Map id -> polígono del backend
  const [reading, setReading] = useState(false);
  const [n, setN] = useState(5);
  const [anio, setAnio] = useState(TRAINED_YEAR);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "", elapsed: 0 });
  const [failed, setFailed] = useState([]);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearInterval(timerRef.current);
    },
    []
  );

  const matched = useMemo(() => {
    if (!official || !polys) return [];
    return [...official.keys()].filter((id) => polys.has(id));
  }, [official, polys]);

  const count = Math.max(1, Math.min(Number(n) || 1, matched.length || 1));

  async function handleCsv(files) {
    const file = files[0];
    if (!file) return;
    setReading(true);
    try {
      const map = await readOfficial(file);
      setOfficial(map);
      setCsvName(file.name);
      toast.success(`${map.size} parcelas con valores oficiales.`);
    } catch (err) {
      toast.error(err.message, { duration: 8000 });
    } finally {
      setReading(false);
    }
  }

  async function handleGeo(files) {
    if (!files.length) return;
    setReading(true);
    const id = toast.loading("Leyendo los contornos…");
    try {
      const res = await parseGeometryFiles(files);
      const map = new Map(res.poligonos.filter((p) => !p.error).map((p) => [p.ID_POLIGONO, p]));
      if (!map.size) {
        toast.error(res.poligonos[0]?.error || "No encontré polígonos que se puedan calcular.", { id, duration: 8000 });
        return;
      }
      setPolys(map);
      setGeoName(files.length === 1 ? files[0].name : `${files.length} archivos`);
      toast.success(`${map.size} contornos leídos.`, { id });
    } catch (err) {
      toast.error(err.message, { id, duration: 8000 });
    } finally {
      setReading(false);
    }
  }

  async function run() {
    const ids = pickSample(matched, official, count);
    if (!ids.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setFailed([]);
    const errors = [];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const { estado, official: values } = official.get(id);
      setProgress({ done: i, total: ids.length, current: id, elapsed: 0 });
      clearInterval(timerRef.current);
      const startedAt = Date.now();
      timerRef.current = setInterval(
        () => setProgress((p) => ({ ...p, elapsed: Math.floor((Date.now() - startedAt) / 1000) })),
        500
      );
      try {
        const data = await predictFromGeometry(
          { ID_POLIGONO: id, Estado: estado, geometry: polys.get(id).geometry, anio },
          { signal: controller.signal }
        );
        onRows((prev) => [...prev.filter((r) => r.id !== id), { id, estado, official: values, live: data.features_calculadas }]);
      } catch (err) {
        if (err.name === "AbortError") break;
        errors.push({ id, message: err.message || "Error desconocido." });
      }
    }

    clearInterval(timerRef.current);
    setFailed(errors);
    setRunning(false);
    setProgress((p) => ({ ...p, done: p.total }));
    if (!controller.signal.aborted) {
      errors.length
        ? toast.warning(`Validación terminada: ${ids.length - errors.length} de ${ids.length} parcelas calculadas.`)
        : toast.success("Validación terminada.");
    }
  }

  function cancel() {
    abortRef.current?.abort();
    toast("Validación cancelada. Los resultados ya calculados se conservan.");
  }

  const ready = Boolean(official && polys);
  const noMatch = ready && matched.length === 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      <header className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Correr la validación aquí</h3>
        <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Sube los valores oficiales y los contornos de las mismas parcelas. Se calcula cada una desde satélite y se compara contra el
          dataset, sin ejecutar nada aparte.
        </p>
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <Dropzone accept=".csv" onFiles={handleCsv} busy={reading} disabled={running} active={Boolean(official)} className="py-6">
          <FileSpreadsheet size={22} strokeWidth={1.5} className="text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{official ? csvName : "Valores oficiales (CSV)"}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {official
              ? `${official.size} parcelas con las 10 variables · toca para cambiar`
              : "features_completo.csv: ID_POLIGONO y las 10 variables del modelo"}
          </span>
        </Dropzone>

        <Dropzone
          accept=".zip,.shp,.dbf,.prj,.shx,.cpg,.geojson,.json,.kml,.kmz"
          multiple
          onFiles={handleGeo}
          busy={reading}
          disabled={running}
          active={Boolean(polys)}
          className="py-6"
        >
          <MapPinned size={22} strokeWidth={1.5} className="text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{polys ? geoName : "Contornos de las parcelas"}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {polys
              ? `${polys.size} contornos válidos · toca para cambiar`
              : "Shapefile (.zip o .shp/.dbf/.prj/.shx/.cpg), GeoJSON o KML con el mismo ID_POLIGONO"}
          </span>
        </Dropzone>
      </div>

      {noMatch && (
        <p className="mx-5 mb-5 border-l-2 border-amber-500 bg-gray-50 py-2 pl-3 pr-3 text-xs leading-relaxed text-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          Ningún ID_POLIGONO del CSV coincide con los contornos. Ejemplo del CSV: {[...official.keys()].slice(0, 3).join(", ")} · de los
          contornos: {[...polys.keys()].slice(0, 3).join(", ")}.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
        <label className="block w-32">
          <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Parcelas a comparar</span>
          <input
            type="number"
            min={1}
            max={Math.max(matched.length, 1)}
            value={n}
            onChange={(e) => setN(e.target.value)}
            disabled={running || !ready}
            className={FIELD}
          />
        </label>
        <label className="block w-32">
          <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Año del ciclo</span>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} disabled={running} className={FIELD}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-3">
          {ready && !noMatch && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {matched.length} coinciden · se calcularán {count} (≈ {count} min)
            </p>
          )}
          {running ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Square size={14} /> Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={!ready || noMatch}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black"
            >
              <Play size={14} strokeWidth={1.75} /> Calcular y comparar
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-gray-900 dark:text-gray-100">
              <Loader2 size={14} className="shrink-0 animate-spin text-accent-600 dark:text-accent-400" />
              <span className="truncate">
                Calculando <span className="font-medium">{progress.current}</span> desde satélite…
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {progress.done + 1} de {progress.total} · {progress.elapsed} s
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-accent-500 transition-[width] duration-500"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Cada parcela tarda entre 30 y 90 s. Puedes cambiar de pestaña; el cálculo sigue.</p>
        </div>
      )}

      {failed.length > 0 && (
        <ul className="space-y-1 border-t border-gray-200 px-5 py-4 text-xs text-red-700 dark:border-gray-800 dark:text-red-400">
          {failed.map((f) => (
            <li key={f.id}>
              <span className="font-semibold">{f.id}:</span> {f.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
