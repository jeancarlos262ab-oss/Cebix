import { useState } from "react";
import { X } from "lucide-react";

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Requerido";
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Correo inválido";
  return errors;
}

export default function EditProfileModal({ account, onClose, onSave }) {
  const [form, setForm] = useState({ name: account.name, email: account.email, role: account.role });
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(form);
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Editar perfil</h2>
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
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Rol</span>
            <input value={form.role} onChange={(e) => set("role", e.target.value)} className={inputClass()} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button type="submit" className="bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-600">
            Guardar
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
