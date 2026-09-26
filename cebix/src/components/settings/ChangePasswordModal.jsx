import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../services/supabaseClient";

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
  const [requestError, setRequestError] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRequestError("");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: form.next });
    if (error) {
      setRequestError("No pudimos actualizar la contraseña. Inténtalo de nuevo.");
      setSubmitting(false);
      return;
    }

    onChanged?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Cambiar contraseña</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

        {requestError ? (
          <div
            role="alert"
            className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {requestError}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              Contraseña actual
              {errors.current && <span className="text-red-500">{errors.current}</span>}
            </span>
            <input
              type="password"
              value={form.current}
              onChange={(e) => set("current", e.target.value)}
              className={inputClass(errors.current)}
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              Nueva contraseña
              {errors.next && <span className="text-red-500">{errors.next}</span>}
            </span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={form.next}
                onChange={(e) => set("next", e.target.value)}
                className={inputClass(errors.next) + " pr-9"}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              Confirmar nueva contraseña
              {errors.confirm && <span className="text-red-500">{errors.confirm}</span>}
            </span>
            <input
              type={show ? "text" : "password"}
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              className={inputClass(errors.confirm)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Actualizando..." : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}

function inputClass(error) {
  return [
    "w-full border bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:bg-gray-800 dark:text-gray-200",
    error ? "border-red-400" : "border-gray-200 focus:border-accent-400 dark:border-gray-700",
  ].join(" ");
}
