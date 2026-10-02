import { createContext, Suspense, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Link, useLocation, useOutlet } from "react-router-dom";
import Logo from "../ui/Logo";
import BarleyEars from "./BarleyEars";
import "./auth.css";

const FACTS = [
  { title: "Monitoreo satelital", text: "NDVI y GDD actualizados por parcela." },
  { title: "Predicción de rendimiento", text: "Cosecha estimada con margen de error conocido." },
  { title: "Elegibilidad crediticia", text: "Score de riesgo para cada ciclo de cebada." },
];

const TABS = [
  { id: "login", label: "Iniciar sesión", to: "/login" },
  { id: "signup", label: "Crear cuenta", to: "/signup" },
];

export const AuthShellContext = createContext(null);

/**
 * Marco persistente de Login/Signup: panel de marca con las espigas, banda
 * móvil y pestañas. Se monta UNA sola vez como ruta de diseño (ver App.jsx),
 * así que al pasar de "Iniciar sesión" a "Crear cuenta" las espigas no se
 * vuelven a dibujar ni el panel parpadea: solo el contenido del formulario
 * hace la transición (salida + entrada) y el subrayado de la pestaña se desliza.
 *
 * Fondo negro, texto blanco y un solo color: la cebada (ver auth.css).
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
        <main className="auth-root flex min-h-screen w-full flex-col lg:flex-row">
          {/* Marca: banda compacta en móvil */}
          <header className="auth-brand px-5 py-6 sm:px-8 lg:hidden">
            <Logo size="lg" tone="inherit" />
            <p className="auth-brand-soft mt-2 text-sm">Parcelas de cebada y crédito agrícola, en un solo lugar.</p>
          </header>

          {/* Marca: panel completo en escritorio */}
          <aside className="auth-brand relative hidden flex-1 flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-16">
            <BarleyEars className="auth-ears pointer-events-none absolute inset-0 h-full w-full" />

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
          <div className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 lg:w-[540px] lg:flex-none lg:items-center xl:w-[600px]">
            <section className="w-full max-w-md">
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

              {children ?? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <Suspense fallback={null}>{outlet}</Suspense>
                  </motion.div>
                </AnimatePresence>
              )}
            </section>
          </div>
        </main>
      </MotionConfig>
    </AuthShellContext.Provider>
  );
}
