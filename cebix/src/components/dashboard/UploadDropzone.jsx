import { SHOW_REAL_ERRORS, realError, userMessage } from "../../utils/userMessages";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "../../services/toast";
import { parseCSV } from "../../utils/csv";
import { detectEstado } from "../../utils/polygon";
import { predictFromGeometry } from "../../services/sateliteApi";
import { isCicloMode } from "../../data/satelite";
import { isGeoFile, parseGeometryFiles } from "../../services/geoApi";
import BatchSizeDialog from "./BatchSizeDialog";
import StagedParcelsDialog from "./StagedParcelsDialog";
import Dropzone from "../ui/Dropzone";
import { detectKind } from "../../utils/csvKind";
import { Z90, scoreFromInputs } from "../../context/ParcelsContext";

const REQUIRED_FIELDS = ["name", "municipio", "region", "area", "lat", "lng", "ndvi", "precip", "gdd", "yieldEstimate"];

const GEO_YEAR = 2025; 

const finite = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : 0);

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
    
    ndvi: finite(f.bas_ndvi_emergencia_macollamiento),
    evi: finite(f.bas_evi_emergencia_macollamiento),
    precip: finite(f.precip_acum_emergencia_macollamiento_mm),
    gdd: 0,
    modo: data.modo ?? null,
    satelite: data.modo
      ? {
          version: 1,
          modo: data.modo,
          anio: GEO_YEAR,
          features: f,
          ...(isCicloMode(data.modo) && { etapas: { enc: f.precip_acum_encanado_mm ?? null, esp: f.precip_acum_espigado_llenado_mm ?? null } }),
        }
      : null,
    yieldEstimate: data.yieldEstimate,
    confidence: Number.isFinite(half) ? half : undefined,
    
    ...(Number.isFinite(half) && { score: scoreFromInputs({ yieldEstimate: data.yieldEstimate, confidence: half / Z90 }) }),
  };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

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

export default function UploadDropzone({ onParsed, onModelCsv }) {
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const [pendingBatch, setPendingBatch] = useState(null); 
  
  const [staged, setStaged] = useState([]);
  const [saving, setSaving] = useState(false);
  const [stagedOpen, setStagedOpen] = useState(false); 

  useEffect(() => () => abortRef.current?.abort(), []);

  
  useEffect(() => {
    if (!busy && staged.length === 0) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, staged.length]);

  const stage = useCallback((records) => {
    setStaged((prev) => [...prev, ...records]);
    setStagedOpen(true); 
  }, []);

  
  const renameStaged = useCallback(
    (index, name) =>
      setStaged((prev) => prev.map((r, i) => (i === index ? { ...r, _origName: r._origName ?? r.name, name } : r))),
    []
  );
  
  const commitStagedName = useCallback(
    (index) =>
      setStaged((prev) =>
        prev.map((r, i) => (i === index ? { ...r, name: r.name.trim() || (r._origName ?? "Parcela sin nombre") } : r))
      ),
    []
  );

  async function handleSaveStaged() {
    if (staged.length === 0 || saving) return;
    setSaving(true);
    try {
      
      const result = await onParsed?.(staged.map(({ _origName, ...record }) => record));
      const failedRecords = result?.failedRecords ?? [];
      const failed = result?.failed ?? failedRecords.length;
      const saved = staged.length - failed;
      
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

  
  const askBatchSize = useCallback(
    (total, omitted, fileName) => new Promise((resolve) => setPendingBatch({ total, omitted, fileName, resolve })),
    []
  );

  

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

  
  const runModel = useCallback(
    async (file, kind, fallbackMessage) => {
      setBusy(true);
      const id = toast.loading(
        kind === "planet"
          ? "Archivo de Planet detectado: ejecutando el modelo…"
          : "Ejecutando el modelo con tu archivo…"
      );
      try {
        await onModelCsv(file, kind);
        toast.success('Modelo ejecutado. Pulsa "Guardar corrida" para conservar los resultados.', { id });
      } catch (err) {
        toast.error(
          (fallbackMessage ?? userMessage(err, "No se pudo ejecutar el modelo con el archivo.")) + (SHOW_REAL_ERRORS && fallbackMessage ? ` [${realError(err)}]` : ""),
          { id, duration: 12000 }
        );
      } finally {
        setBusy(false);
      }
    },
    [onModelCsv]
  );

  const processFiles = useCallback(
    async (files) => {
      if (busy || files.length === 0) return;

      
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

      
      if (onModelCsv) {
        const kind = await detectKind(file);
        if (kind !== "otro") {
          await runModel(file, kind);
          return;
        }
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

        
        if (validRows.length > 0) stage(validRows);

        if (invalidCount === 0 && validRows.length > 0) {
          toast.success(`${plural(validRows.length, "fila lista", "filas listas")} desde ${file.name}. Pulsa "Guardar" para agregarlas.`);
        } else if (validRows.length > 0) {
          toast.warning(`${validRows.length} fila(s) listas para guardar; ${invalidCount} fila(s) omitidas por datos faltantes o inválidos (se requieren: ${REQUIRED_FIELDS.join(", ")}).`);
        } else if (onModelCsv) {
          
          await runModel(file, "otro", `Ninguna fila es válida. Columnas requeridas: ${REQUIRED_FIELDS.join(", ")}.`);
        } else {
          toast.error(`Ninguna fila es válida. Columnas requeridas: ${REQUIRED_FIELDS.join(", ")}.`);
        }
      } catch (err) {
        toast.error(userMessage(err, "No se pudo leer el archivo. Revisa que sea un CSV válido."));
      }
    },
    [busy, processGeometry, stage, onModelCsv, runModel]
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
            <p className="text-xs text-gray-400 dark:text-gray-500">Shapefile (.zip o solo el .shp) · GeoJSON · KML/KMZ · CSV</p>
          </>
        )}
      </Dropzone>

      {staged.length > 0 && !stagedOpen && (
        <button
          type="button"
          onClick={() => setStagedOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-white"
        >
          {plural(staged.length, "parcela sin guardar", "parcelas sin guardar")} · Revisar y guardar
        </button>
      )}

      {staged.length > 0 && stagedOpen && (
        <StagedParcelsDialog
          staged={staged}
          saving={saving}
          onRename={renameStaged}
          onCommitName={commitStagedName}
          onSave={handleSaveStaged}
          onDiscard={() => {
            setStaged([]);
            setStagedOpen(false);
          }}
          onClose={() => setStagedOpen(false)}
        />
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