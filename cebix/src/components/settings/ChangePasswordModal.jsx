import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "../../services/toast";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { userMessage } from "../../utils/userMessages";
import Modal, { MODAL_COLS, MODAL_BTN_CANCEL, MODAL_BTN_PRIMARY, ModalField, modalInput } from "../ui/Modal";
import { PASSWORD_MIN_LENGTH } from "../../utils/passwordRules";

function validate(form) {
  const errors = {};
  if (!form.current) errors.current = "Requerido";
  if (form.next.length < PASSWORD_MIN_LENGTH) errors.next = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  else if (!/[0-9]/.test(form.next)) errors.next = "Incluye al menos un número";
  if (form.confirm !== form.next) errors.confirm = "No coincide";
  return errors;
}

export default function ChangePasswordModal({ onClose, onChanged }) {
  const { user } = useAuth();
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

    
    const email = user?.email;
    if (email) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: form.current });
      if (verifyError) {
        const wrong = verifyError.status === 400 || /invalid login credentials/i.test(verifyError.message ?? "");
        if (wrong) setErrors({ current: "Contraseña incorrecta" });
        else toast.error(userMessage(verifyError, "No se pudo verificar tu contraseña actual. Inténtalo de nuevo."));
        setSubmitting(false);
        return;
      }
    }

    
    const { error } = await supabase.auth.updateUser({ password: form.next });
    if (error) {
      console.error("[updateUser password]", error);
      const code = error.code ?? "";
      const msg = String(error.message ?? "");
      if (code === "same_password" || /different from the old password/i.test(msg)) {
        setErrors({ next: "Debe ser distinta de la actual" });
      } else if (code === "weak_password" || /password should|weak|at least|characters/i.test(msg)) {
        setErrors({ next: "Contraseña demasiado débil. Usa más caracteres, mayúsculas y símbolos." });
      } else {
        toast.error(userMessage(error, "No se pudo actualizar la contraseña. Inténtalo de nuevo."));
      }
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
            {submitting ? "Actualizando…" : "Guardar contraseña"}
          </button>
        </>
      }
    >
      <div className={MODAL_COLS}>
        <div className="space-y-4">
          <ModalField label="Contraseña actual" error={errors.current}>
            <input
              type="password"
              value={form.current}
              onChange={(e) => set("current", e.target.value)}
              className={modalInput(errors.current)}
            />
          </ModalField>
          <ul className="space-y-1 rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <li>• Mínimo {PASSWORD_MIN_LENGTH} caracteres.</li>
            <li>• Incluye al menos un número.</li>
          </ul>
        </div>

        <div className="space-y-4">
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
      </div>
    </Modal>
  );
}