import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, MapPin, Briefcase, MailCheck } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import AuthField, { PasswordToggle } from "../components/auth/AuthField";
import AuthSelect from "../components/auth/AuthSelect";
import AuthButton from "../components/auth/AuthButton";
import { useAuth } from "../context/AuthContext";

const REGIONS = ["Nacional", "Hidalgo", "Tlaxcala", "Puebla"];
const ROLES = ["Administradora", "Analista de crédito", "Agrónomo de campo"];

// Los mensajes de error ahora vienen de nuestras funciones /api/send-otp y
// /api/verify-otp (ver src/services/otpApi.js), no de Supabase, así que los
// códigos son los que definimos ahí mismo.
function getSignUpErrorMessage(error) {
  if (!error) return "No pudimos crear la cuenta. Intenta de nuevo.";

  const code = error.message ?? "";
  if (code === "already_registered") {
    return "Ya existe una cuenta con ese correo. Intenta iniciar sesión.";
  }
  if (code === "invalid_password") {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (code === "invalid_email") {
    return "Escribe un correo electrónico válido.";
  }
  if (code === "network_error") {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }

  return "No pudimos crear la cuenta. Revisa tus datos e inténtalo de nuevo.";
}

function getVerifyErrorMessage(error) {
  if (!error) return "No pudimos verificar el código. Intenta de nuevo.";

  const code = error.message ?? "";
  if (code === "expired") {
    return "El código expiró. Pide uno nuevo con \"Reenviar código\".";
  }
  if (code === "invalid" || code === "no_code") {
    return "El código no es correcto. Revisa tu correo e inténtalo de nuevo.";
  }
  if (code === "network_error") {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  // Si el código era correcto pero falló el inicio de sesión posterior
  // (signIn), el mensaje ya viene traducido por getAuthErrorMessage de
  // LoginPage; aquí solo caemos al genérico.
  return "No pudimos verificar el código. Inténtalo de nuevo.";
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, verifySignupOtp, resendSignupOtp } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    region: "Nacional",
    role: "Agrónomo de campo",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // "form" = datos de la cuenta · "verify" = código de 6 dígitos que llegó
  // al correo. Este segundo paso es lo que evita que alguien se registre
  // con un correo que no controla: sin el código no hay cuenta activa.
  const [step, setStep] = useState("form");
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await signUp({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
    });

    if (signUpError) {
      toast.error(getSignUpErrorMessage(signUpError));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    toast.success("Te enviamos un código de verificación a tu correo.");
    setStep("verify");
  }

  async function handleVerify(event) {
    event.preventDefault();
    setSubmitting(true);

    const { error: verifyError } = await verifySignupOtp(form.email.trim(), code.trim(), form.password);
    if (verifyError) {
      toast.error(getVerifyErrorMessage(verifyError));
      setSubmitting(false);
      return;
    }

    navigate("/", { replace: true });
  }

  async function handleResend() {
    setResending(true);
    const { error: resendError } = await resendSignupOtp(form.email.trim());
    setResending(false);

    if (resendError) {
      toast.error("No pudimos reenviar el código. Espera unos segundos e inténtalo de nuevo.");
      return;
    }
    setResent(true);
    toast.success("Código reenviado. Revisa tu correo.");
    window.setTimeout(() => setResent(false), 5000);
  }

  return (
    <AuthLayout
      title={step === "form" ? "Crea tu cuenta" : "Verifica tu correo"}
      subtitle={
        step === "form"
          ? "Solicita acceso al espacio de trabajo CEBIX."
          : "Un último paso para activar tu cuenta."
      }
      activeTab={step === "form" ? "signup" : undefined}
    >
      {step === "form" ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            label="Nombre completo"
            icon={User}
            required
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Nombre y apellido"
            value={form.name}
            onChange={handleChange}
          />

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

          <AuthField
            label="Contraseña"
            icon={Lock}
            required
            minLength={6}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={form.password}
            onChange={handleChange}
            rightElement={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          />

          <AuthField
            label="Confirmar contraseña"
            icon={Lock}
            required
            minLength={6}
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Escríbela de nuevo"
            value={form.confirmPassword}
            onChange={handleChange}
            rightElement={
              <PasswordToggle shown={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
            }
            hint={
              form.confirmPassword && form.password !== form.confirmPassword
                ? "Las contraseñas no coinciden."
                : undefined
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthSelect label="Región" icon={MapPin} name="region" value={form.region} onChange={handleChange} options={REGIONS} />
            <AuthSelect label="Rol solicitado" icon={Briefcase} name="role" value={form.role} onChange={handleChange} options={ROLES} />
          </div>

          <div className="pt-2">
            <AuthButton loading={submitting} loadingLabel="Creando cuenta...">
              Crear cuenta
            </AuthButton>
          </div>

          <p className="auth-muted pt-1 text-center text-sm">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" replace className="auth-link">
              Inicia sesión
            </Link>
          </p>
        </form>
      ) : (
        <>
          <div className="auth-notice mb-6">
            <MailCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Te enviamos un código de 6 dígitos a <strong className="font-semibold">{form.email}</strong>. Escríbelo
              para confirmar que ese correo es tuyo.
            </span>
          </div>

          <form className="space-y-5" onSubmit={handleVerify}>
            <AuthField
              label="Código de verificación"
              required
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              className="auth-code"
            />

            <AuthButton loading={submitting} loadingLabel="Verificando..." disabled={code.length < 6}>
              Verificar y entrar
            </AuthButton>
          </form>

          <p className="auth-muted mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm">
            <span>¿No llegó el código?</span>
            <button type="button" onClick={handleResend} disabled={resending} className="auth-link disabled:opacity-60">
              {resending ? "Enviando..." : resent ? "Reenviado ✓" : "Reenviar código"}
            </button>
          </p>
          <p className="mt-3 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setCode("");
              }}
              className="auth-quiet"
            >
              ¿Correo incorrecto? Volver
            </button>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
