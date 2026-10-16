import { userMessage } from "../../utils/userMessages";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, UploadCloud, X } from "lucide-react";
import { toast } from "../../services/toast";
import { parseCSV } from "../../utils/csv";
import { detectEstado } from "../../utils/polygon";
import { predictFromGeometry } from "../../services/sateliteApi";
import { isGeoFile, parseGeometryFiles } from "../../services/geoApi";
import BatchSizeDialog from "./BatchSizeDialog";
import Dropzone from "../ui/Dropzone";

const REQUIRED_FIELDS = ["name", "municipio", "region", "area", "lat", "lng", "ndvi", "precip", "gdd", "yieldEstimate"];

const MAX_UPLOAD_MB = 20;
const GEO_YEAR = 2025; // ciclo con el que se entrenó el modelo

const finite = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : 0);

/** Resultado de /predict-from-geometry + polígono leído del archivo -> campos de una parcela. */
function geometryResultToFields(poly, estado, data) {
  const f = data.features_calculadas ?? {};
  const half = (Number(data.ic90_superior) - Number(data.ic90_inferior)) / 2;
  return {
    name: poly.nombre || poly.ID_POLIGONO,
    municipio: poly.Municipio || "—",
    region: estado,
    area: `${finite(data.area_ha ?? poly.area_ha).toFixed(2)} ha`,
    lat: poly.lat,
    lng: poly.lng,
    // Las 3 variables del modelo que la tabla muestra. GDD no es una de las 10 variables del modelo.
    ndvi: finite(f.bas_ndvi_emergencia_macollamiento),
    evi: finite(f.bas_evi_emergencia_macollamiento),
    precip: finite(f.precip_acum_emergencia_macollamiento_mm),
    gdd: 0,
    yieldEstimate: data.yieldEstimate,
    confidence: Number.isFinite(half) ? half : undefined,
  };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Convierte las filas de un CSV en registros listos para `buildParcelRecord`.
 * Encabezados esperados (insensible a mayúsculas): name, municipio, region,
 * area, lat, lng, ndvi, evi, precip, gdd, yieldEstimate, confidence, score.
 */
function rowsToParcelFields(rows) {
  return rows.map((row) => {
    const lower = {};
    for (const key of Object.keys(row)) lower[key.trim().toLowerCase()] = row[key];
    return {
      name: lower.name || lower.parcela,
      municipio: lower.municipio,
      region: lower.region || lower.estado,
      regionCode: lower.regioncode,
      area: lower.area?.includes("ha") ? lower.area : `${lower.area} ha`,
      lat: lower.lat || lower.latitud,
      lng: lower.lng || lower.lon || lower.longitud,
      ndvi: lower.ndvi,
      evi: lower.evi,
      precip: lower.precip || lower.precipitacion,
      gdd: lower.gdd,
      yieldEstimate: lower.yieldestimate || lower.rendimiento,
      confidence: lower.confidence || lower.margen,
      score: lower.score,
    };
  });
}

function validateFields(fields) {
  const missing = REQUIRED_FIELDS.filter((f) => fields[f] === undefined || fields[f] === "" || fields[f] === null);
  const numericFields = ["lat", "lng", "ndvi", "precip", "gdd", "yieldEstimate"];
  const invalidNumbers = numericFields.filter((f) => fields[f] !== undefined && Number.isNaN(Number(fields[f])));
  return { missing, invalidNumbers, valid: missing.length === 0 && invalidNumbers.length === 0 };
}

/**
 * @param {{onParsed?: (fields: object[]) => Promise<{failed?: number, message?: string}|void>|void}} props
 */
export default function UploadDropzone({ onParsed }) {
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const [pendingBatch, setPendingBatch] = useState(null); // { total, omitted, fileName, resolve }
  // Parcelas leídas/calculadas pero SIN guardar: solo se guardan al pulsar "Guardar".
  const [staged, setStaged] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Mientras se calculan parcelas, el navegador avisa antes de cerrar o recargar la pestaña.
  useEffect(() => {
    if (!busy && staged.length === 0) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, staged.length]);

  const stage = useCallback((records) => setStaged((prev) => [...prev, ...records]), []);

  async function handleSaveStaged() {
    if (staged.length === 0 || saving) return;
    setSaving(true);
    try {
      const result = await onParsed?.(staged);
      const failedRecords = result?.failedRecords ?? [];
      const failed = result?.failed ?? failedRecords.length;
      const saved = staged.length - failed;
      // Las que no se pudieron guardar se quedan en la lista para reintentar con el botón.
      setStaged(failedRecords);
      if (failed > 0) {
        toast.error(
          `${plural(failed, "parcela no se pudo guardar", "parcelas no se pudieron guardar")}.${saved > 0 ? ` Se guardaron ${saved}.` : ""} Sigue${failed === 1 ? "" : "n"} en la lista para reintentar.`,
          { duration: 12000 }
        );
      } else {
        toast.success(`${plural(saved, "parcela guardada", "parcelas guardadas")}.`);
      }
    } catch (err) {
      toast.error(userMessage(err, "No se pudieron guardar las parcelas."));
    } finally {
      setSaving(false);
    }
  }

  /** Abre el diálogo y espera cuántas parcelas quiere calcular el usuario (null = canceló). */
  const askBatchSize = useCallback(
    (total, omitted, fileName) => new Promise((resolve) => setPendingBatch({ total, omitted, fileName, resolve })),
    []
  );

  /**
   * Shapefile / GeoJSON / KML / KMZ: el backend lee el archivo (/parse-geometry), y cada polígono se
   * calcula con imágenes satelitales y el modelo (/predict-from-geometry). Quedan en la lista de
   * "sin guardar" hasta que la persona pulse "Guardar".
   */
  const processGeometry = useCallback(
    async (files) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      const id = toast.loading("Leyendo el archivo…");
      const cancel = { label: "Cancelar", onClick: () => controller.abort() };

      try {
        const parsed = await parseGeometryFiles(files, { signal: controller.signal });
        if (parsed.advertencias?.length) toast.info(parsed.advertencias.join(" "), { duration: 9000 });
        const valid = parsed.poligonos.filter((p) => !p.error);
        const rejected = parsed.poligonos.filter((p) => p.error);
        if (valid.length === 0) {
          const first = rejected[0];
          toast.error(
            `Ninguno de los ${plural(parsed.n_poligonos, "polígono", "polígonos")} se puede calcular. ${first.nombre}: ${userMessage(first.error, "el contorno no es válido.")}`,
            { id, duration: 12000 }
          );
          return;
        }

        // Cuántas calcular: si hay más de una, se le avisa cuánto tardará y elige la cantidad.
        toast.dismiss(id);
        const wanted = await askBatchSize(valid.length, rejected.length, files[0].name);
        if (wanted === null) {
          toast("Importación cancelada.");
          return;
        }
        const batch = valid.slice(0, wanted);
        const computed = [];
        const failures = [];
        let cancelled = false;

        for (const [i, poly] of batch.entries()) {
          toast.loading(
            `Parcela ${i + 1} de ${batch.length} ('${poly.nombre}'): calculando índices desde satélite. Tarda entre 30 y 90 s.`,
            { id, action: cancel }
          );
          try {
            const estado = poly.Estado || detectEstado(poly.lat, poly.lng) || "Puebla";
            const data = await predictFromGeometry(
              { ID_POLIGONO: poly.ID_POLIGONO, Estado: estado, geometry: poly.geometry, anio: GEO_YEAR },
              { signal: controller.signal }
            );
            // No se guarda: pasa a la lista de "sin guardar". Si algo falla o se cancela, lo ya calculado se conserva ahí.
            computed.push(geometryResultToFields(poly, estado, data));
          } catch (err) {
            if (err.name === "AbortError") {
              cancelled = true;
              break;
            }
            failures.push(`'${poly.nombre}': ${userMessage(err)}`);
          }
        }

        const notes = [];
        if (cancelled) notes.push("Cancelaste el cálculo.");
        if (rejected.length) notes.push(`${plural(rejected.length, "polígono omitido", "polígonos omitidos")} (${rejected[0].nombre}: ${userMessage(rejected[0].error, "contorno no válido")})`);
        if (valid.length > batch.length && !cancelled) notes.push(`Elegiste calcular ${batch.length}; quedaron ${valid.length - batch.length} sin calcular.`);
        if (failures.length) notes.push(`No se pudo calcular ${failures[0]}${failures.length > 1 ? ` (y ${failures.length - 1} más)` : ""}`);
        if (computed.length > 0) stage(computed);
        const added = computed.length;
        const summary = added > 0 ? `${plural(added, "parcela calculada", "parcelas calculadas")} desde ${files[0].name}. Pulsa "Guardar" para agregarlas.` : "No se calculó ninguna parcela.";
        const message = [summary, ...notes].join(" ");

        if (added > 0 && notes.length === 0) toast.success(message, { id });
        else if (added > 0) toast.warning(message, { id, duration: 14000 });
        else toast.error(message, { id, duration: 14000 });
      } catch (err) {
        if (err.name === "AbortError") toast("Importación cancelada.", { id });
        else toast.error(userMessage(err, "No se pudo leer el archivo."), { id, duration: 12000 });
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [askBatchSize, stage]
  );

  const processFiles = useCallback(
    async (files) => {
      if (busy || files.length === 0) return;

      const total = files.reduce((sum, f) => sum + f.size, 0);
      if (total > MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`Los archivos pesan ${(total / 1048576).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`);
        return;
      }

      // Shapefile (.zip o .shp + .dbf + .prj), GeoJSON, KML y KMZ: se procesan en el backend.
      const geoFiles = files.filter(isGeoFile);
      if (geoFiles.length > 0) {
        await processGeometry(geoFiles);
        return;
      }

      const file = files.find((f) => /\.csv$/i.test(f.name) || f.type === "text/csv");
      if (!file) {
        toast.error("Formato no compatible. Sube un CSV, un shapefile (el .zip, o solo el .shp), un GeoJSON o un KML/KMZ.");
        return;
      }

      try {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error("El CSV no tiene filas de datos.");
          return;
        }

        const candidates = rowsToParcelFields(rows);
        const results = candidates.map((fields) => ({ fields, ...validateFields(fields) }));
        const validRows = results.filter((r) => r.valid).map((r) => r.fields);
        const invalidCount = results.length - validRows.length;

        // No se guarda aquí: las filas válidas pasan a la lista de "sin guardar" hasta pulsar "Guardar".
        if (validRows.length > 0) stage(validRows);

        if (invalidCount === 0 && validRows.length > 0) {
          toast.success(`${plural(validRows.length, "fila lista", "filas listas")} desde ${file.name}. Pulsa "Guardar" para agregarlas.`);
        } else if (validRows.length > 0) {
          toast.warning(`${validRows.length} fila(s) listas para guardar; ${invalidCount} fila(s) omitidas por datos faltantes o inválidos (se requieren: ${REQUIRED_FIELDS.join(", ")}).`);
        } else {
          toast.error(`Ninguna fila es válida. Columnas requeridas: ${REQUIRED_FIELDS.join(", ")}.`);
        }
      } catch (err) {
        toast.error(userMessage(err, "No se pudo leer el archivo. Revisa que sea un CSV válido."));
      }
    },
    [busy, processGeometry, stage]
  );

  return (
    <div>
      <Dropzone
        multiple
        busy={busy}
        accept=".csv,text/csv,.zip,.shp,.dbf,.prj,.shx,.cpg,.geojson,.json,.kml,.kmz"
        onFiles={processFiles}
      >
        {({ dragging }) => (
          <>
            {busy ? (
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400 dark:text-gray-500" />
            ) : (
              <UploadCloud size={22} strokeWidth={1.5} className="text-gray-400 dark:text-gray-500" />
            )}
            {busy ? (
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Procesando archivo… sigue el avance en el aviso</p>
            ) : dragging ? (
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Suelta el archivo para subirlo</p>
            ) : (
              <p className="text-sm leading-snug text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 dark:text-gray-100 dark:decoration-gray-600">
                  Selecciona un archivo
                </span>{" "}
                o arrástralo aquí
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">Shapefile (.zip o solo el .shp) · GeoJSON · KML/KMZ · CSV — máx. 20 MB</p>
          </>
        )}
      </Dropzone>

      {staged.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/60 bg-white p-3 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-100">
              {plural(staged.length, "parcela sin guardar", "parcelas sin guardar")}
              <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">· no se guardan solas</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStaged([])}
                disabled={saving || busy}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <X size={12} /> Descartar
              </button>
              <button
                type="button"
                onClick={handleSaveStaged}
                disabled={saving || busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-accent-contrast hover:bg-accent-600 disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.75} />}
                Guardar {staged.length}
              </button>
            </div>
          </div>
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
            {staged.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex justify-between gap-3">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 tabular-nums">{Number.isFinite(Number(f.yieldEstimate)) ? `${Number(f.yieldEstimate).toFixed(2)} t/ha` : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingBatch && (
        <BatchSizeDialog
          total={pendingBatch.total}
          omitted={pendingBatch.omitted}
          fileName={pendingBatch.fileName}
          onConfirm={(count) => {
            pendingBatch.resolve(count);
            setPendingBatch(null);
          }}
          onClose={() => {
            pendingBatch.resolve(null);
            setPendingBatch(null);
          }}
        />
      )}
    </div>
  );
}
