import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";

function getAuthErrorMessage(error) {
  if (!error) return "No pudimos iniciar sesión. Intenta de nuevo.";

  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("email not confirmed")) {
    return "Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.";
  }
  if (message.includes("invalid login credentials")) {
    return "El correo o la contraseña no son correctos.";
  }
  if (message.includes("too many requests")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }

  return "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: signInError } = await signIn(form.email.trim(), form.password);
    if (signInError) {
      setError(getAuthErrorMessage(signInError));
      setSubmitting(false);
      return;
    }

    navigate("/", { replace: true });
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
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Inicia sesión</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Accede a tu espacio de trabajo CEBIX.
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

          <form className="space-y-5" onSubmit={handleSubmit}>
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
                type="password"
                name="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                className="w-full border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-accent-700"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            ¿Aún no tienes una cuenta?{" "}
            <Link className="font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400" to="/signup">
              Crear cuenta
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
