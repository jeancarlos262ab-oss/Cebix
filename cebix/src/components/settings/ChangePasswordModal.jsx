import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../services/supabaseClient";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_PRIMARY, ModalField, modalInput } from "../ui/Modal";

function validate(form) {
  const errors = {};
  if (!form.current) errors.current = "Requerido";
  if (form.next.length < 8) errors.next = "Mínimo 8 caracteres";
  if (form.next && !/[0-9]/.test(form.next)) errors.next = "Incluye al menos un número";
  if (form.confirm !== form.next) errors.confirm = "No coincide";
  return errors;
}

export default function ChangePasswordModal({ onClose, onChanged }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: form.next });
    if (error) {
      toast.error("No pudimos actualizar la contraseña. Inténtalo de nuevo.");
      setSubmitting(false);
      return;
    }

    onChanged?.();
    toast.success("Contraseña actualizada.");
    onClose();
  }

  return (
    <Modal
      as="form"
      onSubmit={handleSubmit}
      title="Cambiar contraseña"
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={MODAL_BTN_CANCEL}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className={MODAL_BTN_PRIMARY}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Actualizando..." : "Guardar contraseña"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ModalField label="Contraseña actual" error={errors.current}>
          <input
            type="password"
            value={form.current}
            onChange={(e) => set("current", e.target.value)}
            className={modalInput(errors.current)}
          />
        </ModalField>

        <ModalField label="Nueva contraseña" error={errors.next}>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={form.next}
              onChange={(e) => set("next", e.target.value)}
              className={modalInput(errors.next) + " pr-9"}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </ModalField>

        <ModalField label="Confirmar nueva contraseña" error={errors.confirm}>
          <input
            type={show ? "text" : "password"}
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            className={modalInput(errors.confirm)}
          />
        </ModalField>
      </div>
    </Modal>
  );
}
