import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import Avatar from "../ui/Avatar";
import { useAuth } from "../../context/AuthContext";
import {
  ACCEPTED_TYPES,
  avatarErrorMessage,
  deleteAvatar,
  prepareAvatar,
  uploadAvatar,
  validateAvatarFile,
} from "../../services/avatarApi";

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Requerido";
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Correo inválido";
  return errors;
}

export default function EditProfileModal({ account, onClose, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: account.name, email: account.email });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // Foto: se elige y se previsualiza aquí, pero NO se sube hasta pulsar «Guardar»
  // (así «Cancelar» no deja nada en el servidor).
  const [photoFile, setPhotoFile] = useState(null); // archivo original elegido, sin tocar
  const [photoBlob, setPhotoBlob] = useState(null); // miniatura 256x256 para la barra lateral
  const [photoPreview, setPhotoPreview] = useState(null); // URL local para mostrarla
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const shownPhoto = removePhoto ? "" : photoPreview || account.avatar;
  const hasPhoto = Boolean(shownPhoto);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    const problem = validateAvatarFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      const blob = await prepareAvatar(file);
      setPhotoFile(file);
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
      setRemovePhoto(false);
    } catch (err) {
      toast.error(err.message || "No se pudo procesar la imagen.");
    }
  }

  function handleRemove() {
    setPhotoFile(null);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    const fields = { ...form };
    try {
      if (photoBlob && photoFile) {
        const { thumbUrl, fullUrl } = await uploadAvatar(user.id, photoBlob, photoFile);
        fields.avatar = thumbUrl;
        fields.avatarFull = fullUrl;
      } else if (removePhoto && account.avatar) {
        await deleteAvatar(user.id);
        fields.avatar = null;
        fields.avatarFull = null;
      }
    } catch (err) {
      toast.error(avatarErrorMessage(err));
      setSaving(false);
      return;
    }

    const ok = await onSave(fields);
    setSaving(false);
    if (ok !== false) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-white">Editar perfil</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} className="text-accent-600 dark:text-accent-400" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Cambiar foto de perfil"
            className="group relative shrink-0 rounded-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <Avatar src={shownPhoto} name={form.name || account.email} className="h-20 w-20" textClass="text-xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={20} />
            </span>
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Camera size={13} className="text-accent-600 dark:text-accent-400" />
                {hasPhoto ? "Cambiar foto" : "Subir foto"}
              </button>
              {hasPhoto && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Trash2 size={13} className="text-accent-600 dark:text-accent-400" />
                  Quitar
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">JPG, PNG o WebP. Se guarda con su calidad original.</p>
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(",")} onChange={handleFile} className="hidden" />
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              Nombre
              {errors.name && <span className="text-red-500">{errors.name}</span>}
            </span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass(errors.name)} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              Correo
              {errors.email && <span className="text-red-500">{errors.email}</span>}
            </span>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass(errors.email)} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-xs hover:bg-accent-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function inputClass(error) {
  return [
    "w-full rounded-full border bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-hidden dark:bg-gray-800 dark:text-gray-200",
    error ? "border-red-400" : "border-gray-200 focus:border-accent-500 dark:focus:border-accent-500 dark:border-gray-700",
  ].join(" ");
}
