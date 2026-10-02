import { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
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

  const processFiles = useCallback(
    async (files) => {
      const file = files[0];
      if (!file) return;

      const isCSV = /\.csv$/i.test(file.name) || file.type === "text/csv";
      if (!isCSV) {
        toast.error("Por ahora se procesan archivos CSV directamente en el navegador. SHP/GeoJSON/KML requieren un backend de geoprocesamiento que este proyecto no incluye.");
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

        if (validRows.length > 0) {
          onParsed?.(validRows);
        }

        if (invalidCount === 0) {
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
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-accent-500 [&>*]:pointer-events-none",
          isDragging
            ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10"
            : "border-gray-300 hover:bg-gray-50/60 dark:border-gray-700 dark:hover:bg-gray-900/60",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full border transition-transform",
            isDragging
              ? "scale-110 border-accent-500"
              : "border-gray-200 dark:border-gray-800",
          ].join(" ")}
        >
          <UploadCloud
            size={18}
            className="text-accent-600 dark:text-accent-400"
          />
        </span>
        {isDragging ? (
          <p className="text-sm font-semibold text-accent-600 dark:text-accent-400">
            Suelta el archivo para subirlo
          </p>
        ) : (
          <p className="text-sm leading-snug text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-accent-600 dark:text-accent-400">
              Sube el shapefile o CSV
            </span>{" "}
            de la parcela, o arrástralo aquí
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">SHP, GeoJSON, CSV o KML (máx. 20MB)</p>
        <input
          type="file"
          multiple
          accept=".csv,text/csv,.shp,.geojson,.json,.kml"
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
