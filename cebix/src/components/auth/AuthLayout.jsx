import { useContext, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthShellContext } from "./AuthShellContext";

/**
 * Contenido de una pantalla de acceso: encabezado + formulario.
 *
 * El marco (panel de marca, parcelas, pestañas) vive en AuthShell y no se
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

  // El marco (AuthShell) es único y vive en la ruta de diseño de App.jsx: esta
  // pantalla nunca se envuelve a sí misma en otro marco, solo aporta su
  // contenido. (Antes, si el contexto llegaba como null —p. ej. tras una
  // recarga en caliente— se montaba un segundo AuthShell dentro del primero.)
  return body;
}
