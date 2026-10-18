function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convierte un arreglo de objetos en texto CSV.
 * @param {{key: string, label: string, format?: (row: any) => any}[]} columns
 * @param {any[]} rows
 */
function toCSV(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.format ? c.format(row) : row[c.key]))
      .join(",")
  );
  return [header, ...lines].join("\r\n");
}

/** Dispara la descarga de un archivo de texto en el navegador. */
function downloadTextFile(filename, content, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename, columns, rows) {
  downloadTextFile(filename, toCSV(columns, rows));
}

const PARCEL_CSV_COLUMNS = [
  { key: "polygonId", label: "ID" },
  { key: "name", label: "Parcela" },
  { key: "municipio", label: "Municipio" },
  { key: "region", label: "Región" },
  { key: "area", label: "Superficie" },
  { key: "yieldEstimate", label: "Rendimiento (ton/ha)", format: (r) => r.yieldEstimate.toFixed(2) },
  { key: "confidence", label: "± ton/ha", format: (r) => r.confidence.toFixed(2) },
  { key: "score", label: "Índice de rendimiento" },
  { key: "risk", label: "Nivel de rendimiento" },
  { key: "ndvi", label: "NDVI pico", format: (r) => r.ndvi.toFixed(3) },
  { key: "evi", label: "EVI", format: (r) => r.evi.toFixed(3) },
  { key: "precip", label: "Precipitación (mm)" },
  { key: "gdd", label: "GDD acumulados" },
  { key: "lat", label: "Latitud" },
  { key: "lng", label: "Longitud" },
];

export function exportParcelsCSV(parcels, filename = "cebix-parcelas.csv") {
  downloadCSV(filename, PARCEL_CSV_COLUMNS, parcels);
}

/** Parser CSV mínimo con soporte de comillas dobles (suficiente para archivos generados por Excel/Sheets). */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}