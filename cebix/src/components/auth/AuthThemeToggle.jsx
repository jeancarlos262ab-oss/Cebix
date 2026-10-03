import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import "./auth.css";

/**
 * Botón para cambiar entre tema claro y oscuro desde Login/Signup (esquina
 * superior derecha de la pantalla). Usa el mismo ThemeContext que Ajustes,
 * así que la elección se guarda y se mantiene dentro de la app.
 *
 * Muestra el icono del tema al que se pasará: sol en oscuro, luna en claro.
 */
export default function AuthThemeToggle({ className = "" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`auth-theme-btn ${className}`}
    >
      {isDark ? <Sun size={18} strokeWidth={2} aria-hidden="true" /> : <Moon size={18} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
