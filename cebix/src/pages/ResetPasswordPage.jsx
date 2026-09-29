import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabaseClient";

function getUpdateErrorMessage(error) {
  if (!error) return "No pudimos actualizar la contraseña. Intenta de nuevo.";

  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  if (message.includes("session") || message.includes("token") || message.includes("expired")) {
    return 'El enlace expiró o ya se usó. Pide uno nuevo desde "¿Olvidaste tu contraseña?" en el login.';
  }

  return "No pudimos actualizar la contraseña. Intenta de nuevo.";
}

/**
 * Al abrir el enlace de recuperación, Supabase ya deja una sesión temporal
 * activa (por eso solo pedimos la contraseña nueva, no el correo). Al
 * terminar cerramos esa sesión y mandamos a /login para que la persona
 * entre limpio con la contraseña nueva.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: form.password });
    if (updateError) {
      toast.error(getUpdateErrorMessage(updateError));
      setSubmitting(false);
      return;
    }

    await signOut();
    setSubmitting(false);
    setSuccess(true);
    window.setTimeout(() => navigate("/login", { replace: true }), 1800);
  }

  return (
    <AuthLayout title="Restablece tu contraseña" subtitle="Elige una contraseña nueva para tu cuenta CEBIX.">
      <div className="border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black sm:p-8">

        {success ? (
          <div
            role="status"
            className="flex items-start gap-2.5 border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>Contraseña actualizada. Te llevamos a iniciar sesión...</span>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <AuthField
              label="Nueva contraseña"
              icon={Lock}
              required
              minLength={6}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={handleChange}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <AuthField
              label="Confirmar contraseña"
              icon={Lock}
              required
              minLength={6}
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Escríbela de nuevo"
              value={form.confirmPassword}
              onChange={handleChange}
            />

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  Guardar contraseña
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {!success && (
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link className="font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400" to="/login">
              Volver a iniciar sesión
            </Link>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
