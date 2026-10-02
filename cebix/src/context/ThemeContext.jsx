import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { appStorage } from "../services/AppStorage";

const STORAGE_KEY = "cebix-preferences";

const DEFAULT_PREFS = {
  theme: "system", // "light" | "dark" | "system"
  accent: "brand", // "brand" | "cobre" | "oliva" | "pizarra" | "mono" | "ndvi" — por defecto: Ámbar (acento 1)
};

function loadPrefs() {
  const saved = appStorage.getJSON(STORAGE_KEY, null);
  if (!saved) return DEFAULT_PREFS;
  // Ignora la preferencia "density" que pudo guardarse antes de quitar ese ajuste.
  const { density: _density, ...rest } = saved;
  return { ...DEFAULT_PREFS, ...rest };
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

  // Apply resolved theme + accent to <html> and persist preferences.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.accent = prefs.accent;
    appStorage.setJSON(STORAGE_KEY, prefs);
  }, [prefs, resolvedTheme]);

  const value = useMemo(
    () => ({
      ...prefs,
      resolvedTheme,
      setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
      setAccent: (accent) => setPrefs((p) => ({ ...p, accent })),
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
