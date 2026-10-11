import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_PRIMARY, ModalField, modalInput } from "../ui/Modal";

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
    <Modal
      as="form"
      onSubmit={handleSubmit}
      size="lg"
      busy={saving}
      onClose={onClose}
      title={isEdit ? "Editar parcela" : "Registrar nueva parcela"}
      description={
        metadataOnly
          ? "Esta parcela viene de la corrida del modelo: aquí solo se editan sus datos descriptivos. Rendimiento, score y SHAP los calculó el modelo."
          : "Score y semáforo de elegibilidad se calculan automáticamente a partir de estos valores."
      }
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={MODAL_BTN_CANCEL}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={MODAL_BTN_PRIMARY}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Guardar cambios" : "Agregar parcela"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
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
    </Modal>
  );
}

const inputClass = modalInput;

function Field({ span2, ...props }) {
  return <ModalField className={span2 ? "col-span-2" : ""} {...props} />;
}
