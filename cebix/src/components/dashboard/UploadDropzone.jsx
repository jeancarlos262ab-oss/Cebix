import { useCallback, useState } from "react";
import { UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseCSV } from "../../utils/csv";

const REQUIRED_FIELDS = ["name", "municipio", "region", "area", "lat", "lng", "ndvi", "precip", "gdd", "yieldEstimate"];

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
 * @param {{onParsed?: (fields: object[]) => void}} props
 */
export default function UploadDropzone({ onParsed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success" | "error", message: string }

  const processFiles = useCallback(
    async (files) => {
      const file = files[0];
      if (!file) return;

      const isCSV = /\.csv$/i.test(file.name) || file.type === "text/csv";
      if (!isCSV) {
        setStatus({
          type: "error",
          message:
            "Por ahora se procesan archivos CSV directamente en el navegador. SHP/GeoJSON/KML requieren un backend de geoprocesamiento que este proyecto no incluye.",
        });
        return;
      }

      try {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setStatus({ type: "error", message: "El CSV no tiene filas de datos." });
          return;
        }

        const candidates = rowsToParcelFields(rows);
        const results = candidates.map((fields) => ({ fields, ...validateFields(fields) }));
        const validRows = results.filter((r) => r.valid).map((r) => r.fields);
        const invalidCount = results.length - validRows.length;

        if (validRows.length > 0) {
          onParsed?.(validRows);
        }

        if (invalidCount === 0) {
          setStatus({
            type: "success",
            message: `${validRows.length} parcela${validRows.length === 1 ? "" : "s"} agregada${
              validRows.length === 1 ? "" : "s"
            } desde ${file.name}.`,
          });
        } else if (validRows.length > 0) {
          setStatus({
            type: "error",
            message: `${validRows.length} fila(s) agregadas; ${invalidCount} fila(s) omitidas por datos faltantes o inválidos (se requieren: ${REQUIRED_FIELDS.join(", ")}).`,
          });
        } else {
          setStatus({
            type: "error",
            message: `Ninguna fila es válida. Columnas requeridas: ${REQUIRED_FIELDS.join(", ")}.`,
          });
        }
      } catch (err) {
        setStatus({ type: "error", message: `No se pudo leer el archivo: ${err.message}` });
      }
    },
    [onParsed]
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
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={
          isDragging
            ? {
                backgroundImage:
                  "repeating-linear-gradient(135deg, transparent 0 8px, var(--accent-100) 8px 16px)",
              }
            : undefined
        }
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 border px-6 py-8 text-center transition-colors [&>*]:pointer-events-none",
          isDragging
            ? "border-accent-400 bg-accent-50"
            : "border-gray-200 bg-white dark:border-gray-800 dark:bg-black",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-9 w-9 items-center justify-center border bg-white shadow-sm transition-transform dark:bg-black",
            isDragging
              ? "scale-110 border-accent-500"
              : "border-gray-200 dark:border-gray-800",
          ].join(" ")}
        >
          <UploadCloud
            size={16}
            className={isDragging ? "text-accent-600" : "text-gray-500 dark:text-gray-400"}
          />
        </span>
        {isDragging ? (
          <p className="text-sm font-semibold text-accent-600">Suelta el archivo para subirlo</p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-accent-600">Sube el shapefile o CSV</span> de
            la parcela, o arrástralo aquí
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">SHP, GeoJSON, CSV o KML (máx. 20MB)</p>
        <input
          type="file"
          multiple
          accept=".csv,text/csv,.shp,.geojson,.json,.kml"
          className="hidden"
          onChange={(e) => {
            processFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>

      {status && (
        <div
          className={[
            "mt-2 flex items-start gap-2 border px-3 py-2 text-xs",
            status.type === "success"
              ? "border-ndvi-400/40 bg-ndvi-50 text-ndvi-700 dark:border-ndvi-500/30 dark:bg-ndvi-500/10 dark:text-ndvi-400"
              : "border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
          ].join(" ")}
        >
          {status.type === "success" ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
          )}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
