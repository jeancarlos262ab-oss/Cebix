import { createContext } from "react";

/**
 * Contexto del marco de Login/Signup (AuthShell).
 *
 * Vive en su propio archivo a propósito: si se exporta desde AuthShell.jsx
 * junto con el componente, Vite/React Fast Refresh recarga ese módulo al
 * guardar y AuthLayout se queda con una copia vieja del contexto (valor null),
 * por lo que se envuelve en OTRO AuthShell y todo el login aparece anidado
 * dentro del panel derecho.
 */
export const AuthShellContext = createContext(null);
