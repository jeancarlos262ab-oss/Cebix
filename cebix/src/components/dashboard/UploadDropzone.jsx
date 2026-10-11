import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { parseCSV } from "../../utils/csv";
import { detectEstado } from "../../utils/polygon";
import { predictFromGeometry } from "../../services/earthEngineApi";
import { isGeoFile, parseGeometryFiles } from "../../services/geoApi";

const REQUIRED_FIELDS = ["name", "municipio", "region", "area", "lat", "lng", "ndvi", "precip", "gdd", "yieldEstimate"];

const MAX_UPLOAD_MB = 20;
const GEO_YEAR = 2025; // ciclo con el que se entrenó el modelo
// Cada parcela se calcula desde satélite (~30–90 s) y el backend procesa una a la vez: se limita el lote.
const MAX_GEO_PARCELS = 10;

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
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Shapefile / GeoJSON / KML / KMZ: el backend lee el archivo (/parse-geometry), y cada polígono se
   * calcula con imágenes satelitales y el modelo (/predict-from-geometry). Se guardan al terminar.
   */
  const processGeometry = useCallback(
    async (files) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      const id = toast.loading("Leyendo el archivo en el backend…");
      const cancel = { label: "Cancelar", onClick: () => controller.abort() };

      try {
        const parsed = await parseGeometryFiles(files, { signal: controller.signal });
        const valid = parsed.poligonos.filter((p) => !p.error);
        const rejected = parsed.poligonos.filter((p) => p.error);
        if (valid.length === 0) {
          const first = rejected[0];
          toast.error(
            `Ninguno de los ${plural(parsed.n_poligonos, "polígono", "polígonos")} se puede calcular. ${first.nombre}: ${first.error}`,
            { id, duration: 12000 }
          );
          return;
        }

        const batch = valid.slice(0, MAX_GEO_PARCELS);
        const records = [];
        const failures = [];
        let cancelled = false;

        for (const [i, poly] of batch.entries()) {
          toast.loading(
            `Parcela ${i + 1} de ${batch.length} («${poly.nombre}»): calculando índices desde satélite. Tarda entre 30 y 90 s.`,
            { id, action: cancel }
          );
          try {
            const estado = poly.Estado || detectEstado(poly.lat, poly.lng) || "Puebla";
            const data = await predictFromGeometry(
              { ID_POLIGONO: poly.ID_POLIGONO, Estado: estado, geometry: poly.geometry, anio: GEO_YEAR },
              { signal: controller.signal }
            );
            records.push(geometryResultToFields(poly, estado, data));
          } catch (err) {
            if (err.name === "AbortError") {
              cancelled = true;
              break;
            }
            failures.push(`«${poly.nombre}»: ${err.message}`);
          }
        }

        const saved = records.length > 0 ? await onParsed?.(records) : null;
        const saveFailed = Math.min(saved?.failed ?? 0, records.length);
        const added = records.length - saveFailed;

        const notes = [];
        if (cancelled) notes.push("Cancelaste el cálculo.");
        if (rejected.length) notes.push(`${plural(rejected.length, "polígono omitido", "polígonos omitidos")} (${rejected[0].nombre}: ${rejected[0].error})`);
        if (valid.length > batch.length) notes.push(`Solo se calculan ${MAX_GEO_PARCELS} por archivo; quedaron ${valid.length - batch.length} sin procesar.`);
        if (failures.length) notes.push(`No se pudo calcular ${failures[0]}${failures.length > 1 ? ` (y ${failures.length - 1} más)` : ""}`);
        if (saveFailed) notes.push(`${plural(saveFailed, "parcela no se pudo guardar", "parcelas no se pudieron guardar")}${saved?.message ? `: ${saved.message}` : ""}`);
        const summary = added > 0 ? `${plural(added, "parcela agregada", "parcelas agregadas")} desde ${files[0].name}.` : "No se agregó ninguna parcela.";
        const message = [summary, ...notes].join(" ");

        if (added > 0 && notes.length === 0) toast.success(message, { id });
        else if (added > 0) toast.warning(message, { id, duration: 14000 });
        else toast.error(message, { id, duration: 14000 });
      } catch (err) {
        if (err.name === "AbortError") toast("Importación cancelada.", { id });
        else toast.error(err.message || "No se pudo leer el archivo.", { id, duration: 12000 });
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [onParsed]
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
        toast.error("Formato no compatible. Sube un CSV, un shapefile (.zip o .shp con .dbf y .prj), un GeoJSON o un KML/KMZ.");
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

        // onParsed puede devolver { failed, message } (cuántas no se pudieron guardar y por qué).
        const saved = validRows.length > 0 ? await onParsed?.(validRows) : null;
        const failed = Math.min(saved?.failed ?? 0, validRows.length);
        const added = validRows.length - failed;

        if (failed > 0) {
          toast.error(
            `${failed} parcela${failed === 1 ? "" : "s"} no se pudo guardar${failed === 1 ? "" : "n"}${
              saved?.message ? `: ${saved.message}` : "."
            }${added > 0 ? ` Se agregaron ${added}.` : ""}`
          );
        } else if (invalidCount === 0) {
          toast.success(`${validRows.length} parcela${validRows.length === 1 ? "" : "s"} agregada${
              validRows.length === 1 ? "" : "s"
            } desde ${file.name}.`);
        } else if (validRows.length > 0) {
          toast.warning(`${validRows.length} fila(s) agregadas; ${invalidCount} fila(s) omitidas por datos faltantes o inválidos (se requieren: ${REQUIRED_FIELDS.join(", ")}).`);
        } else {
          toast.error(`Ninguna fila es válida. Columnas requeridas: ${REQUIRED_FIELDS.join(", ")}.`);
        }
      } catch (err) {
        toast.error(`No se pudo leer el archivo: ${err.message}`);
      }
    },
    [onParsed, busy, processGeometry]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(event.dataTransfer.files ?? []));
    },
    [processFiles]
  );

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-accent-500 *:pointer-events-none",
          busy
            ? "cursor-progress opacity-70"
            : isDragging
            ? "border-accent-500 bg-gray-50 dark:bg-gray-900"
            : "border-gray-300 hover:bg-gray-50/60 dark:border-gray-700 dark:hover:bg-gray-900/60",
        ].join(" ")}
      >
        {busy ? (
          <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400 dark:text-gray-500" />
        ) : (
          <UploadCloud size={20} strokeWidth={1.5} className="text-gray-400 dark:text-gray-500" />
        )}
        {busy ? (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Procesando archivo… sigue el avance en el aviso</p>
        ) : isDragging ? (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Suelta el archivo para subirlo
          </p>
        ) : (
          <p className="text-sm leading-snug text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 dark:text-gray-100 dark:decoration-gray-600">
              Sube el shapefile o CSV
            </span>{" "}
            de la parcela, o arrástralo aquí
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">SHP (.zip o .shp + .dbf + .prj), GeoJSON, KML/KMZ o CSV (máx. 20MB)</p>
        <input
          type="file"
          multiple
          accept=".csv,text/csv,.zip,.shp,.dbf,.prj,.shx,.cpg,.geojson,.json,.kml,.kmz"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            processFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>

    </div>
  );
}
