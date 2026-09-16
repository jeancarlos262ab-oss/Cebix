import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "cebix-preferences";

const DEFAULT_PREFS = {
  theme: "system", // "light" | "dark" | "system"
  accent: "brand", // "brand" | "mono" | "ndvi"
  density: "comoda", // "comoda" | "compacta"
};

function loadPrefs() {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function getSystemPrefersDark() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [systemDark, setSystemDark] = useState(getSystemPrefersDark);

  // Watch OS-level scheme changes so "Sistema" stays live.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  // Apply resolved theme + density to <html> and persist preferences.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.density = prefs.density;
    root.dataset.accent = prefs.accent;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable (private mode, etc.) — fail silently.
    }
  }, [prefs, resolvedTheme]);

  const value = useMemo(
    () => ({
      ...prefs,
      resolvedTheme,
      setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
      setAccent: (accent) => setPrefs((p) => ({ ...p, accent })),
      setDensity: (density) => setPrefs((p) => ({ ...p, density })),
    }),
    [prefs, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
