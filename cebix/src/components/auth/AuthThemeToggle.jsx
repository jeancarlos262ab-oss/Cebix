import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import "./auth.css";

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