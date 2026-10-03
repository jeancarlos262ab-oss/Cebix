import { Suspense, useMemo, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { Link, useLocation, useOutlet } from "react-router-dom";
import Logo from "../ui/Logo";
import ParcelsSky from "./ParcelsSky";
import AuthThemeToggle from "./AuthThemeToggle";
import { AuthShellContext } from "./AuthShellContext";
import "./auth.css";

const FACTS = [
  { title: "Monitoreo satelital", text: "Índices de vegetación y precipitación por parcela." },
  { title: "Predicción de rendimiento", text: "Cosecha estimada con margen de error conocido." },
  { title: "Elegibilidad crediticia", text: "Score de riesgo para cada ciclo de cebada." },
];

const TABS = [
  { id: "login", label: "Iniciar sesión", to: "/login" },
  { id: "signup", label: "Crear cuenta", to: "/signup" },
];

/**
 * Marco persistente de Login/Signup: panel de marca con las parcelas, banda
 * móvil y pestañas. Se monta UNA sola vez como ruta de diseño (ver App.jsx),
 * así que al pasar de "Iniciar sesión" a "Crear cuenta" las parcelas no se
 * vuelven a dibujar ni el panel parpadea: solo el contenido del formulario
 * hace la transición (salida + entrada) y el subrayado de la pestaña se desliza.
 *
 * Oscuro (negro/blanco) o claro (blanco/negro) según el tema de la app, con un solo color: el dorado de la cebada (ver auth.css).
 *
 * Si no se usa como ruta de diseño, puede envolver una página directamente
 * con `children` (pantallas sueltas como restablecer contraseña).
 */
export default function AuthShell({ children }) {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const [showTabs, setShowTabs] = useState(true);
  const contextValue = useMemo(() => ({ setShowTabs }), []);

  const activeTab = pathname.startsWith("/signup") ? "signup" : pathname.startsWith("/login") ? "login" : null;

  return (
    <AuthShellContext.Provider value={contextValue}>
      <MotionConfig reducedMotion="user">
        <main className="auth-root relative flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
          {/* Cambiar tema: esquina superior derecha de la pantalla */}
          <AuthThemeToggle className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6" />

          {/* Marca: banda compacta en móvil */}
          <header className="auth-brand py-6 pl-5 pr-16 sm:pl-8 sm:pr-20 lg:hidden">
            <Logo size="lg" tone="inherit" />
            <p className="auth-brand-soft mt-2 text-sm">Parcelas de cebada y crédito agrícola, en un solo lugar.</p>
          </header>

          {/* Marca: panel completo en escritorio */}
          <aside className="auth-brand relative hidden flex-1 flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-16">
            <ParcelsSky className="auth-parcels pointer-events-none absolute inset-0 h-full w-full" />
            {/* Sol de cebada: resplandor metido en la esquina superior derecha, junto al formulario */}
            <div className="auth-sun pointer-events-none absolute" aria-hidden="true" />

            <Logo size="xl" tone="inherit" className="relative" />

            <div className="relative max-w-lg">
              <h2 className="font-display text-3xl font-bold leading-tight xl:text-4xl">
                Del dato satelital a la decisión financiera.
              </h2>
              <p className="auth-brand-soft mt-3 max-w-md text-base leading-relaxed">
                Gestión de parcelas de cebada y crédito agrícola en un solo espacio de trabajo.
              </p>
            </div>

            <div className="relative">
              <ul className="max-w-sm">
                {FACTS.map(({ title: factTitle, text }) => (
                  <li key={factTitle} className="auth-brand-rule border-t py-3">
                    <p className="font-display text-sm font-semibold">{factTitle}</p>
                    <p className="auth-brand-soft mt-0.5 text-sm">{text}</p>
                  </li>
                ))}
              </ul>
              <p className="auth-brand-soft mt-4 text-xs">© {new Date().getFullYear()} CEBIX</p>
            </div>
          </aside>

          {/* Formulario */}
          <motion.div layoutScroll className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 lg:w-[540px] lg:flex-none lg:overflow-y-auto lg:py-16 xl:w-[600px]">
            <section className="w-full max-w-md">
              {activeTab && (
                <div className="mb-12 flex h-[4.5rem] justify-center lg:h-20 xl:h-24">
                  <Logo size="display" tone="inherit" showText={false} className="opacity-40 dark:opacity-20" />
                </div>
              )}

              {showTabs && activeTab && (
                <nav aria-label="Acceso" className="auth-tabs mb-8">
                  {TABS.map((tab) => (
                    <Link
                      key={tab.id}
                      to={tab.to}
                      replace
                      aria-current={tab.id === activeTab ? "page" : undefined}
                      className="auth-tab"
                    >
                      {tab.label}
                      {tab.id === activeTab && (
                        <motion.span
                          layoutId="auth-tab-bar"
                          className="auth-tab-bar"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                    </Link>
                  ))}
                </nav>
              )}

              {/* Solo cambia el contenido: el marco (panel, logo, pestañas) se queda
                  tal cual. Sin transición de salida/entrada entre pantallas. */}
              {children ?? <Suspense fallback={null}>{outlet}</Suspense>}
            </section>
          </motion.div>
        </main>
      </MotionConfig>
    </AuthShellContext.Provider>
  );
}
