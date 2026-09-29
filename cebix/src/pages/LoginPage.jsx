import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  MailCheck,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
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

// Códigos que devuelve /api/verify-otp (ver src/services/otpApi.js).
function getResetErrorMessage(error) {
  if (!error) return "No pudimos actualizar la contraseña. Intenta de nuevo.";

  const code = error.message ?? "";
  if (code === "expired") {
    return "El código expiró. Pide uno nuevo.";
  }
  if (code === "invalid" || code === "no_code") {
    return "El código no es correcto. Revisa tu correo e inténtalo de nuevo.";
  }
  if (code === "invalid_password") {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (code === "network_error") {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }

  return "No pudimos actualizar la contraseña. Intenta de nuevo.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, sendPasswordResetOtp, verifyPasswordResetOtp } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // "login" = formulario normal · "forgot" = pedir el correo para
  // recuperar contraseña · "reset" = llegó el código, aquí se escribe y se
  // elige la contraseña nueva · "done" = contraseña actualizada.
  const [mode, setMode] = useState("login");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState({ password: "", confirmPassword: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const { error: signInError } = await signIn(form.email.trim(), form.password);
    if (signInError) {
      toast.error(getAuthErrorMessage(signInError));
      setSubmitting(false);
      return;
    }

    navigate("/", { replace: true });
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    // sendPasswordResetOtp nunca devuelve error (no revela si el correo
    // tiene cuenta o no); si algo falla en la red, avisamos genéricamente.
    const { error: resetError } = await sendPasswordResetOtp(recoveryEmail.trim());
    setSubmitting(false);

    if (resetError) {
      toast.error("No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.");
      return;
    }

    setMode("reset");
  }

  async function handleResendCode() {
    setResending(true);
    await sendPasswordResetOtp(recoveryEmail.trim());
    setResending(false);
    setResent(true);
    toast.success("Código reenviado. Revisa tu correo.");
    window.setTimeout(() => setResent(false), 5000);
  }

  async function handleResetSubmit(event) {
    event.preventDefault();

    if (newPassword.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword.password !== newPassword.confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const { error: verifyError } = await verifyPasswordResetOtp(
      recoveryEmail.trim(),
      resetCode.trim(),
      newPassword.password
    );
    setSubmitting(false);

    if (verifyError) {
      toast.error(getResetErrorMessage(verifyError));
      return;
    }

    setMode("done");
  }

  function backToLogin() {
    setMode("login");
    setResetCode("");
    setNewPassword({ password: "", confirmPassword: "" });
  }

  return (
    <AuthLayout title="Inicia sesión" subtitle="Accede a tu espacio de trabajo CEBIX.">
      <div className="border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black sm:p-8">

        {mode === "login" && (
          <>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <AuthField
                label="Correo electrónico"
                icon={Mail}
                required
                type="email"
                name="email"
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                value={form.email}
                onChange={handleChange}
              />

              <div>
                <AuthField
                  label="Contraseña"
                  icon={Lock}
                  required
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
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
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(form.email);
                    setMode("forgot");
                  }}
                  className="mt-1.5 block text-right text-xs font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              ¿Aún no tienes una cuenta?{" "}
              <Link className="font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400" to="/signup">
                Crear cuenta
              </Link>
            </p>
          </>
        )}

        {mode === "forgot" && (
          <>
            <form className="space-y-5" onSubmit={handleForgotSubmit}>
              <AuthField
                label="Correo electrónico"
                icon={Mail}
                required
                type="email"
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                value={recoveryEmail}
                onChange={(e) => {
                  setRecoveryEmail(e.target.value);
                }}
              />

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  "Enviar código"
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={backToLogin}
              className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft size={14} />
              Volver a iniciar sesión
            </button>
          </>
        )}

        {mode === "reset" && (
          <>
            <div className="mb-5 flex items-start gap-2.5 border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              <MailCheck size={16} className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400" />
              <span>
                Si <strong className="font-semibold">{recoveryEmail}</strong> tiene una cuenta, te enviamos un
                código de 6 dígitos. Escríbelo junto con tu contraseña nueva.
              </span>
            </div>

            <form className="space-y-5" onSubmit={handleResetSubmit}>
              <AuthField
                label="Código de verificación"
                icon={KeyRound}
                required
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={resetCode}
                onChange={(e) => {
                  setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                className="tracking-[0.5em]"
              />

              <AuthField
                label="Contraseña nueva"
                icon={Lock}
                required
                minLength={6}
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword.password}
                onChange={(e) => {
                  setNewPassword((current) => ({ ...current, password: e.target.value }));
                }}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <AuthField
                label="Confirmar contraseña"
                icon={Lock}
                required
                minLength={6}
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Escríbela de nuevo"
                value={newPassword.confirmPassword}
                onChange={(e) => {
                  setNewPassword((current) => ({ ...current, confirmPassword: e.target.value }));
                }}
              />

              <button
                type="submit"
                disabled={submitting || resetCode.length < 6}
                className="flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    Cambiar contraseña
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-gray-500 dark:text-gray-400">
              <span>¿No llegó el código?</span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending}
                className="font-semibold text-accent-600 hover:text-accent-700 disabled:opacity-60 dark:text-accent-400"
              >
                {resending ? "Enviando..." : resent ? "Reenviado ✓" : "Reenviar código"}
              </button>
            </p>

            <button
              type="button"
              onClick={backToLogin}
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft size={14} />
              Volver a iniciar sesión
            </button>
          </>
        )}

        {mode === "done" && (
          <>
            <div
              role="status"
              className="flex items-start gap-2.5 border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>Contraseña actualizada. Ya puedes iniciar sesión con tu contraseña nueva.</span>
            </div>

            <button
              type="button"
              onClick={backToLogin}
              className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft size={14} />
              Volver a iniciar sesión
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
