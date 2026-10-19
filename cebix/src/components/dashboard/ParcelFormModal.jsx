import { userMessage } from "../../utils/userMessages";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import LocationPickerMap from "../map/LocationPickerMap";
import { detectEstado } from "../../utils/polygon";
import { reverseLocation } from "../../utils/reverseGeocode";
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

const METADATA_FIELDS = ["lat", "lng"];

function validate(form, metadataOnly = false) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Requerido";
  if (!form.municipio.trim()) errors.municipio = "Requerido";
  if (!form.area.trim() || Number.isNaN(Number(form.area))) errors.area = "Número de hectáreas";
  for (const field of metadataOnly ? METADATA_FIELDS : NUMERIC_FIELDS) {
    if (form[field] === "" || Number.isNaN(Number(form[field]))) {
      errors[field] = field === "lat" || field === "lng" ? "Marca el mapa" : "Requerido";
    }
  }
  if (form.lat && (Number(form.lat) < 14 || Number(form.lat) > 33)) {
    errors.lat = "Fuera de México: mueve el pin";
  }
  if (!metadataOnly && form.ndvi && (Number(form.ndvi) < -1 || Number(form.ndvi) > 1)) {
    errors.ndvi = "NDVI está entre -1 y 1";
  }
  return errors;
}

export default function ParcelFormModal({ parcel, onClose, onSubmit }) {
  const [form, setForm] = useState(() => toFormState(parcel));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const isEdit = Boolean(parcel);
  const metadataOnly = Boolean(parcel?.fromModelRun);

  
  const [locating, setLocating] = useState(false);
  // Municipio y región se bloquean al marcar el punto; solo se liberan si no
  // se pudieron obtener automáticamente (sin red, fuera de las 3 regiones…).
  const [manual, setManual] = useState(() => ({ municipio: Boolean(parcel) && !parcel.municipio, region: false }));
  const geoRequest = useRef(null);
  useEffect(() => () => geoRequest.current?.abort(), []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handlePick(lat, lng) {
    const estado = detectEstado(lat, lng);
    // El lugar siempre sale del punto marcado: se limpia el municipio anterior
    // para que nunca quede uno que no corresponda con el pin.
    setForm((f) => ({
      ...f,
      lat: String(lat),
      lng: String(lng),
      municipio: "",
      ...(estado && !metadataOnly ? { region: estado } : {}),
    }));
    setManual({ municipio: false, region: false });
    setErrors((e) => ({ ...e, lat: undefined, lng: undefined, municipio: undefined }));

    geoRequest.current?.abort();
    const controller = new AbortController();
    geoRequest.current = controller;
    setLocating(true);
    reverseLocation(lat, lng, { signal: controller.signal })
      .then(({ municipio, estado: geoEstado }) => {
        if (controller.signal.aborted) return;
        const finalEstado = estado || geoEstado;
        if (!estado && geoEstado && !metadataOnly) setForm((f) => ({ ...f, region: geoEstado }));
        if (municipio) setForm((f) => ({ ...f, municipio }));
        setManual({ municipio: !municipio, region: !finalEstado });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setManual({ municipio: true, region: !estado });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLocating(false);
      });
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
        setSubmitError(userMessage(result.error, "No se pudo guardar la parcela. Inténtalo de nuevo."));
        setSaving(false);
        return;
      }
      onClose();
    } catch (err) {
      setSubmitError(userMessage(err, "No se pudo guardar la parcela. Inténtalo de nuevo."));
      setSaving(false);
    }
  }

  const hasPoint = form.lat !== "" && form.lng !== "" && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng));
  const municipioLocked = hasPoint && !manual.municipio;
  const regionLocked = hasPoint && !manual.region;

  return (
    <Modal
      as="form"
      onSubmit={handleSubmit}
      size="lg"
      busy={saving}
      onClose={onClose}
      splitScroll
      asideSide="right"
      asideFlush
      aside={
        <div className="relative h-80 md:absolute md:inset-0 md:h-auto">
          <LocationPickerMap lat={form.lat} lng={form.lng} onChange={handlePick} height="100%" bare />
          {locating && (
            <span className="pointer-events-none absolute left-2.5 top-2.5 z-1000 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1 text-xs text-gray-100">
              <Loader2 size={11} className="animate-spin" /> Buscando región y municipio…
            </span>
          )}
        </div>
      }
      title={isEdit ? "Editar parcela" : "Registrar nueva parcela"}
      description={
        metadataOnly
          ? "Esta parcela viene de la corrida del modelo: aquí solo se editan sus datos descriptivos. Rendimiento, score y SHAP los calculó el modelo."
          : "Score y semáforo de rendimiento se calculan automáticamente a partir de estos valores."
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
      <div>
        <section className="grid grid-cols-2 content-start gap-3">
          <SectionTitle>Datos de la parcela</SectionTitle>
          <p className="col-span-2 -mt-1 text-xs text-gray-500 dark:text-gray-400">
            Marca la parcela en el mapa: la ubicación, el municipio y la región se llenan solos y quedan bloqueados para evitar errores.
          </p>

          <Field label="Nombre" span2 error={errors.name}>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Parcela AGC_198"
              className={inputClass(errors.name)}
            />
          </Field>

          <Field label={<LockedLabel locked={municipioLocked}>Municipio</LockedLabel>} error={errors.municipio}>
            <input
              value={form.municipio}
              onChange={(e) => set("municipio", e.target.value)}
              readOnly={municipioLocked}
              aria-readonly={municipioLocked}
              placeholder={locating ? "Buscando…" : hasPoint && manual.municipio ? "Escríbelo, no se pudo detectar" : "Se llena al marcar el mapa"}
              className={municipioLocked ? lockedClass : inputClass(errors.municipio)}
            />
          </Field>

          {!metadataOnly ? (
            <Field label={<LockedLabel locked={regionLocked}>Región</LockedLabel>}>
              <select
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                disabled={regionLocked}
                className={regionLocked ? lockedClass : inputClass()}
              >
                {(REGIONS.includes(form.region) || !form.region ? REGIONS : [...REGIONS, form.region]).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Superficie (ha)" error={errors.area}>
              <input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="7.5" className={inputClass(errors.area)} />
            </Field>
          )}

          <Field label={<LockedLabel locked>Latitud</LockedLabel>} error={errors.lat}>
            <input value={form.lat} readOnly aria-readonly placeholder="Marca el mapa" className={errors.lat ? `${lockedClass} border-red-400!` : lockedClass} />
          </Field>

          <Field label={<LockedLabel locked>Longitud</LockedLabel>} error={errors.lng}>
            <input value={form.lng} readOnly aria-readonly placeholder="Marca el mapa" className={errors.lng ? `${lockedClass} border-red-400!` : lockedClass} />
          </Field>

        </section>

        {!metadataOnly && (
          <section className="mt-3 grid grid-cols-2 content-start gap-3">
            <SectionTitle>Superficie y rendimiento</SectionTitle>

            <Field label="Superficie (ha)" error={errors.area}>
              <input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="7.5" className={inputClass(errors.area)} />
            </Field>

            <Field label="Rendimiento esperado (ton/ha)" error={errors.yieldEstimate}>
              <input
                value={form.yieldEstimate}
                onChange={(e) => set("yieldEstimate", e.target.value)}
                placeholder="3.9"
                className={inputClass(errors.yieldEstimate)}
              />
            </Field>

            <Field label="Margen de error (± ton/ha)" span2 error={errors.confidence}>
              <input
                value={form.confidence}
                onChange={(e) => set("confidence", e.target.value)}
                placeholder="0.7"
                className={inputClass(errors.confidence)}
              />
            </Field>

            <SectionTitle className="mt-2">Índices y clima</SectionTitle>

            <Field label="NDVI pico" error={errors.ndvi}>
              <input value={form.ndvi} onChange={(e) => set("ndvi", e.target.value)} placeholder="0.68" className={inputClass(errors.ndvi)} />
            </Field>

            <Field label="EVI" error={errors.evi}>
              <input value={form.evi} onChange={(e) => set("evi", e.target.value)} placeholder="0.35" className={inputClass(errors.evi)} />
            </Field>

            <Field label="Precipitación (mm)" error={errors.precip}>
              <input value={form.precip} onChange={(e) => set("precip", e.target.value)} placeholder="1100" className={inputClass(errors.precip)} />
            </Field>

            <Field label="GDD acumulados" error={errors.gdd}>
              <input value={form.gdd} onChange={(e) => set("gdd", e.target.value)} placeholder="2900" className={inputClass(errors.gdd)} />
            </Field>
          </section>
        )}
      </div>

      {submitError && (
        <div role="alert" className="mt-4 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <p>{submitError}</p>
        </div>
      )}
    </Modal>
  );
}

const inputClass = modalInput;

const lockedClass = `${modalInput()} cursor-not-allowed bg-gray-100! text-gray-500! focus:border-gray-300! focus:ring-0! dark:bg-gray-900! dark:text-gray-400! dark:focus:border-gray-700!`;

function LockedLabel({ locked, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {locked && <Lock size={10} strokeWidth={2} className="text-gray-400 dark:text-gray-500" aria-label="Bloqueado" />}
    </span>
  );
}

function SectionTitle({ className = "", children }) {
  return (
    <h3 className={`col-span-2 border-b border-gray-100 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400 ${className}`}>
      {children}
    </h3>
  );
}

function Field({ span2, ...props }) {
  return <ModalField className={span2 ? "col-span-2" : ""} {...props} />;
}