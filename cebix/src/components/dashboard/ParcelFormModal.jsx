import { useState } from "react";
import { Loader2, X } from "lucide-react";

const REGIONS = ["Hidalgo", "Tlaxcala", "Puebla"];

const EMPTY = {
  name: "",
  municipio: "",
  region: "Hidalgo",
  area: "",
  lat: "",
  lng: "",
  ndvi: "",
  evi: "",
  precip: "",
  gdd: "",
  yieldEstimate: "",
  confidence: "0.7",
};

function toFormState(parcel) {
  if (!parcel) return EMPTY;
  return {
    name: parcel.name ?? "",
    municipio: parcel.municipio ?? "",
    region: parcel.region ?? "Hidalgo",
    area: (parcel.area ?? "").replace(/\s*ha\s*$/i, ""),
    lat: parcel.lat ?? "",
    lng: parcel.lng ?? "",
    ndvi: parcel.ndvi ?? "",
    evi: parcel.evi ?? "",
    precip: parcel.precip ?? "",
    gdd: parcel.gdd ?? "",
    yieldEstimate: parcel.yieldEstimate ?? "",
    confidence: parcel.confidence ?? "0.7",
  };
}

const NUMERIC_FIELDS = ["lat", "lng", "ndvi", "evi", "precip", "gdd", "yieldEstimate", "confidence"];

// Campos que se pueden editar en una parcela que viene de la corrida del modelo.
const METADATA_FIELDS = ["lat", "lng"];

function validate(form, metadataOnly = false) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Requerido";
  if (!form.municipio.trim()) errors.municipio = "Requerido";
  if (!form.area.trim() || Number.isNaN(Number(form.area))) errors.area = "Número de hectáreas";
  for (const field of metadataOnly ? METADATA_FIELDS : NUMERIC_FIELDS) {
    if (form[field] === "" || Number.isNaN(Number(form[field]))) {
      errors[field] = "Requerido";
    }
  }
  if (form.lat && (Number(form.lat) < 14 || Number(form.lat) > 33)) {
    errors.lat = "Fuera de México";
  }
  if (!metadataOnly && form.ndvi && (Number(form.ndvi) < -1 || Number(form.ndvi) > 1)) {
    errors.ndvi = "NDVI está entre -1 y 1";
  }
  return errors;
}

/**
 * @param {{
 *   parcel?: object,
 *   onClose: () => void,
 *   onSubmit: (fields: object) => Promise<{error?: Error|null}|void>|void,
 * }} props
 * - Sin `parcel`: crea. Con `parcel` capturada a mano: edita todos los campos.
 * - Con `parcel` de la corrida del modelo (`fromModelRun`): solo se editan los datos
 *   descriptivos; rendimiento, score y SHAP los calculó el modelo y no se modifican.
 * - `onSubmit` puede devolver `{ error }`: el formulario se queda abierto y lo muestra.
 */
export default function ParcelFormModal({ parcel, onClose, onSubmit }) {
  const [form, setForm] = useState(() => toFormState(parcel));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const isEdit = Boolean(parcel);
  const metadataOnly = Boolean(parcel?.fromModelRun);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(form, metadataOnly);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const result = await onSubmit({
        ...form,
        area: `${form.area} ha`,
      });
      if (result?.error) {
        setSubmitError(result.error.message || "No se pudo guardar la parcela.");
        setSaving(false);
        return;
      }
      onClose();
    } catch (err) {
      setSubmitError(err?.message || "No se pudo guardar la parcela.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-white">
              {isEdit ? "Editar parcela" : "Registrar nueva parcela"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {metadataOnly
                ? "Esta parcela viene de la corrida del modelo: aquí solo se editan sus datos descriptivos. Rendimiento, score y SHAP los calculó el modelo."
                : "Score y semáforo de elegibilidad se calculan automáticamente a partir de estos valores."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} className="text-accent-600 dark:text-accent-400" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Nombre" span2 error={errors.name}>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Parcela AGC_198"
              className={inputClass(errors.name)}
            />
          </Field>

          <Field label="Municipio" error={errors.municipio}>
            <input
              value={form.municipio}
              onChange={(e) => set("municipio", e.target.value)}
              className={inputClass(errors.municipio)}
            />
          </Field>

          {!metadataOnly && (
            <Field label="Región">
              <select value={form.region} onChange={(e) => set("region", e.target.value)} className={inputClass()}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Superficie (ha)" error={errors.area}>
            <input
              value={form.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="7.5"
              className={inputClass(errors.area)}
            />
          </Field>

          {!metadataOnly && (
            <Field label="Rendimiento esperado (ton/ha)" error={errors.yieldEstimate}>
              <input
                value={form.yieldEstimate}
                onChange={(e) => set("yieldEstimate", e.target.value)}
                placeholder="3.9"
                className={inputClass(errors.yieldEstimate)}
              />
            </Field>
          )}

          <Field label="Latitud" error={errors.lat}>
            <input value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="19.85" className={inputClass(errors.lat)} />
          </Field>

          <Field label="Longitud" error={errors.lng}>
            <input value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="-98.30" className={inputClass(errors.lng)} />
          </Field>

          {!metadataOnly && (
            <Field label="NDVI pico" error={errors.ndvi}>
              <input value={form.ndvi} onChange={(e) => set("ndvi", e.target.value)} placeholder="0.68" className={inputClass(errors.ndvi)} />
            </Field>
          )}

          {!metadataOnly && (
            <Field label="EVI" error={errors.evi}>
              <input value={form.evi} onChange={(e) => set("evi", e.target.value)} placeholder="0.35" className={inputClass(errors.evi)} />
            </Field>
          )}

          {!metadataOnly && (
            <Field label="Precipitación (mm)" error={errors.precip}>
              <input value={form.precip} onChange={(e) => set("precip", e.target.value)} placeholder="1100" className={inputClass(errors.precip)} />
            </Field>
          )}

          {!metadataOnly && (
            <Field label="GDD acumulados" error={errors.gdd}>
              <input value={form.gdd} onChange={(e) => set("gdd", e.target.value)} placeholder="2900" className={inputClass(errors.gdd)} />
            </Field>
          )}

          {!metadataOnly && (
            <Field label="Margen de error (± ton/ha)" error={errors.confidence}>
              <input
                value={form.confidence}
                onChange={(e) => set("confidence", e.target.value)}
                placeholder="0.7"
                className={inputClass(errors.confidence)}
              />
            </Field>
          )}
        </div>

        {submitError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {submitError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-xs hover:bg-accent-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Guardar cambios" : "Agregar parcela"}
          </button>
        </div>
      </form>
    </div>
  );
}

function inputClass(error) {
  return [
    "w-full rounded-full border bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-accent-100 dark:bg-gray-800 dark:text-gray-200",
    error ? "border-red-400" : "border-gray-200 focus:border-accent-400 dark:border-gray-700",
  ].join(" ");
}

function Field({ label, children, error, span2 }) {
  return (
    <label className={`block ${span2 ? "col-span-2" : ""}`}>
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
        {error && <span className="text-red-500">{error}</span>}
      </span>
      {children}
    </label>
  );
}
