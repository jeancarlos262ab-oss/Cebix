import { motion } from "framer-motion";
import { Satellite, TrendingUp, ShieldCheck } from "lucide-react";
import Logo from "../ui/Logo";

const FEATURES = [
  {
    icon: Satellite,
    title: "Monitoreo satelital",
    text: "Datos NDVI y GDD actualizados por parcela, sin salir de campo.",
  },
  {
    icon: TrendingUp,
    title: "Predicción de rendimiento",
    text: "Modelos validados espacialmente para estimar cosecha con margen de error conocido.",
  },
  {
    icon: ShieldCheck,
    title: "Score de elegibilidad",
    text: "Evaluación de riesgo crediticio automatizada para cada ciclo.",
  },
];

/**
 * Layout compartido de Login/Signup: panel izquierdo de marca (visible en
 * escritorio) + panel derecho con el formulario. Usa la misma paleta que el
 * resto del dashboard (negro/blanco puros, bordes gray-200/800, sin radios).
 *
 * @param {{title: string, subtitle: string, children: React.ReactNode}} props
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen bg-white dark:bg-black">
      {/* Panel de marca — oculto en móvil, igual que el sidebar del dashboard.
          Ancho automático (se ajusta al contenido, acotado por max-w-sm más
          el padding) en vez de un porcentaje fijo, y fondo animado con los
          tonos de acento del tema activo — jerárquicamente por encima del
          panel de formulario en vez de separarse solo con un borde. */}
      <aside className="auth-aside-bg relative hidden shrink-0 flex-col justify-between px-10 py-10 lg:flex xl:px-14">
        <Logo size="hero" tone="contrast" />

        <div className="max-w-sm">
          <h2 className="font-sora text-3xl font-bold leading-tight text-[color:var(--accent-contrast)]">
            Del dato satelital a la decisión financiera.
          </h2>
          <p className="mt-3 text-sm text-[color:var(--accent-contrast)] opacity-80">
            Gestión inteligente de parcelas y crédito agrícola en un solo espacio de trabajo.
          </p>

          <div className="mt-9 space-y-5">
            {FEATURES.map(({ icon: Icon, title: featTitle, text }, index) => (
              <motion.div
                key={featTitle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 * index, ease: "easeOut" }}
                className="flex items-start gap-3.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--accent-contrast)] opacity-90">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--accent-contrast)]">{featTitle}</p>
                  <p className="mt-0.5 text-sm text-[color:var(--accent-contrast)] opacity-75">{text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[color:var(--accent-contrast)] opacity-60">
          © {new Date().getFullYear()} CEBIX
        </p>
      </aside>

      {/* Panel de formulario */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center lg:hidden">
            <Logo size="lg" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Gestión inteligente de parcelas y crédito agrícola
            </p>
          </div>

          <div className="mb-7">
            <h1 className="font-sora text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>

          {children}
        </motion.section>
      </div>
    </main>
  );
}
