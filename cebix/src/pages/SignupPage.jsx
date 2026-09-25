import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";

const REGIONS = ["Nacional", "Hidalgo", "Tlaxcala", "Puebla"];
const ROLES = ["Administradora", "Analista de crédito", "Agrónomo de campo"];

function getSignUpErrorMessage(error) {
  if (!error) return "No pudimos crear la cuenta. Intenta de nuevo.";

  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Ya existe una cuenta con ese correo. Intenta iniciar sesión.";
  }
  if (message.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  if (message.includes("invalid email")) {
    return "Escribe un correo electrónico válido.";
  }

  return "No pudimos crear la cuenta. Revisa tus datos e inténtalo de nuevo.";
}

export default function SignupPage() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    region: "Nacional",
    role: "Agrónomo de campo",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    const { error: signUpError } = await signUp({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
    });

    if (signUpError) {
      setError(getSignUpErrorMessage(signUpError));
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo size="lg" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Gestión inteligente de parcelas y crédito agrícola
          </p>
        </div>

        <div className="border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Crea tu cuenta</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Solicita acceso al espacio de trabajo CEBIX.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-5 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              role="status"
              className="mb-5 border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
            >
              Cuenta creada. Revisa tu correo para confirmar la dirección. Después, una Administradora activará tu acceso.
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Nombre completo
              </span>
              <input
                required
                type="text"
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                className="w-full border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-accent-700"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Correo electrónico
              </span>
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-accent-700"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Contraseña
              </span>
              <input
                required
                minLength={6}
                type="password"
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className="w-full border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-accent-700"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Región
                </span>
                <select
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  className="w-full border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-accent-700"
                >
                  {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Rol solicitado
                </span>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-accent-700"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || success}
              className="w-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            ¿Ya tienes una cuenta?{" "}
            <Link className="font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400" to="/login">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
