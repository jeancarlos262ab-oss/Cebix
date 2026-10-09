import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowLeft, MailCheck, CheckCircle2 } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import AuthField, { PasswordToggle } from "../components/auth/AuthField";
import AuthButton from "../components/auth/AuthButton";
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

// Título y subtítulo del layout según el paso en el que va el usuario.
const HEADINGS = {
  login: { title: "Inicia sesión", subtitle: "Accede a tu espacio de trabajo CEBIX." },
  forgot: { title: "Recupera tu contraseña", subtitle: "Te enviaremos un código de 6 dígitos a tu correo." },
  code: { title: "Revisa tu correo", subtitle: "Escribe el código de 6 dígitos que te enviamos." },
  reset: { title: "Elige una contraseña nueva", subtitle: "Código listo. Ahora escribe tu contraseña nueva." },
  done: { title: "Todo listo", subtitle: "Tu contraseña se actualizó correctamente." },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, sendPasswordResetOtp, verifyPasswordResetOtp, checkPasswordResetOtp } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // "login" = formulario normal · "forgot" = pedir el correo para
  // recuperar contraseña · "code" = escribir el código que llegó · "reset" =
  // elegir la contraseña nueva · "done" = contraseña actualizada.
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

    setMode("code");
  }

  // Paso 2: se valida el código en el servidor (sin consumirlo) y solo si es
  // correcto se muestran los campos de la contraseña nueva.
  async function handleCodeSubmit(event) {
    event.preventDefault();
    if (resetCode.length < 6) return;

    setSubmitting(true);
    const { error: checkError } = await checkPasswordResetOtp(recoveryEmail.trim(), resetCode.trim());
    setSubmitting(false);

    if (checkError) {
      toast.error(getResetErrorMessage(checkError));
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
      // Por si el código venció entre un paso y otro: volver al paso del código.
      if (["invalid", "no_code", "expired"].includes(verifyError.message)) {
        setResetCode("");
        setMode("code");
      }
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
    <AuthLayout
      title={HEADINGS[mode].title}
      subtitle={HEADINGS[mode].subtitle}
      activeTab={mode === "login" ? "login" : undefined}
    >
      {mode === "login" && (
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
              placeholder="Tu contraseña"
              value={form.password}
              onChange={handleChange}
              rightElement={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRecoveryEmail(form.email);
                  setMode("forgot");
                }}
                className="auth-link text-sm"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          <AuthButton loading={submitting} loadingLabel="Iniciando sesión...">
            Iniciar sesión
          </AuthButton>

          <p className="auth-muted pt-1 text-center text-sm">
            ¿Aún no tienes cuenta?{" "}
            <Link to="/signup" replace className="auth-link">
              Crea una
            </Link>
          </p>
        </form>
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

            <AuthButton loading={submitting} loadingLabel="Enviando código..." arrow={false}>
              Enviar código
            </AuthButton>
          </form>

          <BackToLogin onClick={backToLogin} />
        </>
      )}

      {mode === "code" && (
        <>
          <div className="auth-notice mb-6">
            <MailCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Si <strong className="font-semibold">{recoveryEmail}</strong> tiene una cuenta, te enviamos un código de
              6 dígitos. Escríbelo para continuar.
            </span>
          </div>

          <form className="space-y-5" onSubmit={handleCodeSubmit}>
            <AuthField
              label="Código de verificación"
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
              className="auth-code"
              autoFocus
            />

            <AuthButton loading={submitting} loadingLabel="Verificando..." disabled={resetCode.length < 6}>
              Continuar
            </AuthButton>
          </form>

          <p className="auth-muted mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm">
            <span>¿No llegó el código?</span>
            <button type="button" onClick={handleResendCode} disabled={resending} className="auth-link disabled:opacity-60">
              {resending ? "Enviando..." : resent ? "Reenviado ✓" : "Reenviar código"}
            </button>
          </p>
          <p className="mt-3 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setResetCode("");
                setMode("forgot");
              }}
              className="auth-quiet"
            >
              ¿Correo incorrecto? Volver
            </button>
          </p>

          <BackToLogin onClick={backToLogin} />
        </>
      )}

      {mode === "reset" && (
        <>
          <form className="space-y-5" onSubmit={handleResetSubmit}>
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
              rightElement={<PasswordToggle shown={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)} />}
              autoFocus
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
              hint={
                newPassword.confirmPassword && newPassword.password !== newPassword.confirmPassword
                  ? "Las contraseñas no coinciden."
                  : undefined
              }
            />

            <AuthButton loading={submitting} loadingLabel="Guardando...">
              Cambiar contraseña
            </AuthButton>
          </form>

          <p className="mt-6 text-center text-sm">
            <button type="button" onClick={() => setMode("code")} className="auth-quiet">
              Cambiar el código
            </button>
          </p>

          <BackToLogin onClick={backToLogin} />
        </>
      )}

      {mode === "done" && (
        <>
          <div role="status" className="auth-notice">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Contraseña actualizada. Ya puedes iniciar sesión con tu contraseña nueva.</span>
          </div>

          <BackToLogin onClick={backToLogin} />
        </>
      )}
    </AuthLayout>
  );
}

function BackToLogin({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="auth-quiet mt-6 flex w-full items-center justify-center gap-1.5 text-sm">
      <ArrowLeft size={14} aria-hidden="true" />
      Volver a iniciar sesión
    </button>
  );
}
