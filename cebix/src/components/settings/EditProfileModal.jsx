import { userMessage } from "../../utils/userMessages";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "../../services/toast";
import Avatar from "../ui/Avatar";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_PRIMARY, MODAL_BTN_SMALL, ModalField, modalInput } from "../ui/Modal";
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

  
  
  const [photoFile, setPhotoFile] = useState(null); 
  const [photoBlob, setPhotoBlob] = useState(null); 
  const [photoPreview, setPhotoPreview] = useState(null); 
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const shownPhoto = removePhoto ? "" : photoPreview || account.avatar;
  const hasPhoto = Boolean(shownPhoto);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; 
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
      toast.error(userMessage(err, "No se pudo procesar la imagen."));
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
    <Modal
      as="form"
      onSubmit={handleSubmit}
      title="Editar perfil"
      aside={
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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
                className={MODAL_BTN_SMALL}
              >
                <Camera size={13} className="text-gray-400 dark:text-gray-500" />
                {hasPhoto ? "Cambiar foto" : "Subir foto"}
              </button>
              {hasPhoto && (
                <button type="button" onClick={handleRemove} className={MODAL_BTN_SMALL}>
                  <Trash2 size={13} className="text-gray-400 dark:text-gray-500" />
                  Quitar
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">JPG, PNG o WebP. Se guarda con su calidad original.</p>
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(",")} onChange={handleFile} className="hidden" />
        </div>
      }
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={MODAL_BTN_CANCEL}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={MODAL_BTN_PRIMARY}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          <ModalField label="Nombre" error={errors.name}>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={modalInput(errors.name)} />
          </ModalField>
          <ModalField label="Correo" error={errors.email}>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} className={modalInput(errors.email)} />
          </ModalField>
        </div>
    </Modal>
  );
}