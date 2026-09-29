import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Briefcase,
  Loader2,
  ArrowRight,
  KeyRound,
  MailCheck,
} from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
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

function SelectField({ label, icon: Icon, name, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
        )}
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="w-full appearance-none border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-black dark:text-white dark:focus:ring-accent-700"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
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
    <AuthLayout title="Crea tu cuenta" subtitle="Solicita acceso al espacio de trabajo CEBIX.">
      <div className="border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black sm:p-8">

        {step === "form" ? (
          <>
            <form className="space-y-5" onSubmit={handleSubmit}>
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
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Escríbela de nuevo"
                value={form.confirmPassword}
                onChange={handleChange}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField label="Región" icon={MapPin} name="region" value={form.region} onChange={handleChange} options={REGIONS} />
                <SelectField label="Rol solicitado" icon={Briefcase} name="role" value={form.role} onChange={handleChange} options={ROLES} />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              ¿Ya tienes una cuenta?{" "}
              <Link className="font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400" to="/login">
                Iniciar sesión
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-start gap-2.5 border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              <MailCheck size={16} className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400" />
              <span>
                Te enviamos un código de 6 dígitos a <strong className="font-semibold">{form.email}</strong>.
                Escríbelo para confirmar que ese correo es tuyo.
              </span>
            </div>

            <form className="space-y-5" onSubmit={handleVerify}>
              <AuthField
                label="Código de verificación"
                icon={KeyRound}
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
                className="tracking-[0.5em]"
              />

              <button
                type="submit"
                disabled={submitting || code.length < 6}
                className="flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Verificar y entrar
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-gray-500 dark:text-gray-400">
              <span>¿No llegó el código?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="font-semibold text-accent-600 hover:text-accent-700 disabled:opacity-60 dark:text-accent-400"
              >
                {resending ? "Enviando..." : resent ? "Reenviado ✓" : "Reenviar código"}
              </button>
            </p>
            <p className="mt-2 text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setCode("");
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ¿Correo incorrecto? Volver
              </button>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
