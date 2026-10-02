import { useContext, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AuthShell, { AuthShellContext } from "./AuthShell";

/**
 * Contenido de una pantalla de acceso: encabezado + formulario.
 *
 * El marco (panel de marca, espigas, pestañas) vive en AuthShell y no se
 * vuelve a montar al cambiar de pantalla. Aquí solo se anima lo que cambia:
 * al pasar entre pasos de una misma pantalla (p. ej. iniciar sesión →
 * recuperar contraseña) el encabezado y los campos salen y entran con un
 * fundido corto.
 *
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   activeTab?: "login" | "signup",
 *   children: React.ReactNode,
 * }} props
 * `activeTab` muestra las pestañas Iniciar sesión / Crear cuenta (la pestaña
 * activa la define la ruta); omítelo en pasos intermedios (recuperar
 * contraseña, verificar código) para ocultarlas.
 */
export default function AuthLayout({ title, subtitle, activeTab, children }) {
  const shell = useContext(AuthShellContext);

  useLayoutEffect(() => {
    shell?.setShowTabs(Boolean(activeTab));
  }, [shell, activeTab]);

  const body = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="mb-7">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="auth-muted mt-1.5 text-sm">{subtitle}</p>
        </div>

        {children}
      </motion.div>
    </AnimatePresence>
  );

  // Pantalla suelta (sin ruta de diseño): se envuelve en su propio marco.
  if (!shell) return <AuthShell>{body}</AuthShell>;

  return body;
}
