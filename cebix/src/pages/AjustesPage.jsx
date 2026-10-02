import { useState } from "react";
import { Palette, Bell, Globe2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import ThemePreviewCard from "../components/settings/ThemePreviewCard";
import Toggle from "../components/settings/Toggle";
import { useTheme } from "../context/ThemeContext";

const ACCENTS = [
  { id: "brand", label: "Ámbar", swatch: "#C08A2E" },
  { id: "cobre", label: "Cobre", swatch: "#B76637" },
  { id: "oliva", label: "Oliva", swatch: "#949F4F" },
  { id: "pizarra", label: "Pizarra", swatch: "#4A71A4" },
  { id: "ndvi", label: "NDVI", swatch: "#4C9A63" },
  { id: "mono", label: "Negro", swatch: "#111827", darkLabel: "Blanco", darkSwatch: "#FFFFFF" },
];

export default function AjustesPage() {
  const { theme, setTheme, accent, setAccent, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const swatchOf = (a) => (isDark && a.darkSwatch) || a.swatch;
  const accentColor = swatchOf(ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]);

  const [notifs, setNotifs] = useState({
    email: true,
    riesgo: true,
    resumenSemanal: false,
  });

  const [prefs, setPrefs] = useState({
    idioma: "es-MX",
    formatoFecha: "dd/mm/aaaa",
    zonaHoraria: "America/Mexico_City",
  });

  function handleReset() {
    setTheme("system");
    setAccent("brand");
    setNotifs({ email: true, riesgo: true, resumenSemanal: false });
    setPrefs({
      idioma: "es-MX",
      formatoFecha: "dd/mm/aaaa",
      zonaHoraria: "America/Mexico_City",
    });
    toast.info("Ajustes restablecidos.");
  }

  return (
    <div className="pb-10">
      <TopBar
        title="Ajustes"
        subtitle="Personaliza la apariencia y el comportamiento de CEBIX"
        hideSearch
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw size={13} className="text-accent-600 dark:text-accent-400" />
              Restablecer
            </button>
          </div>
        }
      />

      <div className="mt-2 max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Apariencia */}
        <SettingsSection
          icon={Palette}
          title="Apariencia"
          description="Elige cómo se ve CEBIX en este dispositivo"
        >
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            <ThemePreviewCard
              label="Claro"
              description="Ideal para exteriores"
              variant="light"
              active={theme === "light"}
              onSelect={() => setTheme("light")}
              accentColor={accentColor}
            />
            <ThemePreviewCard
              label="Oscuro"
              description="Menos fatiga visual"
              variant="dark"
              active={theme === "dark"}
              onSelect={() => setTheme("dark")}
              accentColor={accentColor}
            />
            <ThemePreviewCard
              label="Sistema"
              description="Sigue al dispositivo"
              variant="split"
              active={theme === "system"}
              onSelect={() => setTheme("system")}
              accentColor={accentColor}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Color de acento
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Se usa en botones, enlaces y gráficas principales
              </span>
            </span>
            <div className="flex items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={(isDark && a.darkLabel) || a.label}
                  onClick={() => setAccent(a.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105"
                  style={{
                    borderColor: accent === a.id ? swatchOf(a) : "transparent",
                  }}
                >
                  <span
                    className="rounded-full"
                    style={{ backgroundColor: swatchOf(a), height: "22px", width: "22px" }}
                  />
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* Notificaciones */}
        <SettingsSection
          icon={Bell}
          title="Notificaciones"
          description="Elige qué avisos quieres recibir"
        >
          <Toggle
            label="Alertas por correo"
            description="Cambios importantes en tus parcelas"
            checked={notifs.email}
            onChange={(v) => setNotifs((n) => ({ ...n, email: v }))}
          />
          <Toggle
            label="Alertas de riesgo"
            description="Cuando una parcela cambia a semáforo rojo o amarillo"
            checked={notifs.riesgo}
            onChange={(v) => setNotifs((n) => ({ ...n, riesgo: v }))}
          />
          <Toggle
            label="Resumen semanal"
            description="Reporte cada lunes con el estado general del portafolio"
            checked={notifs.resumenSemanal}
            onChange={(v) => setNotifs((n) => ({ ...n, resumenSemanal: v }))}
          />
        </SettingsSection>

        {/* Idioma y región */}
        <SettingsSection
          icon={Globe2}
          title="Idioma y región"
          description="Formato de fecha, hora y zona horaria"
        >
          <div className="grid grid-cols-1 gap-4 py-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Idioma
              </span>
              <select
                value={prefs.idioma}
                onChange={(e) => setPrefs((p) => ({ ...p, idioma: e.target.value }))}
                className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="es-MX">Español (México)</option>
                <option value="en-US">English (US)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Formato de fecha
              </span>
              <select
                value={prefs.formatoFecha}
                onChange={(e) => setPrefs((p) => ({ ...p, formatoFecha: e.target.value }))}
                className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="dd/mm/aaaa">DD/MM/AAAA</option>
                <option value="mm/dd/aaaa">MM/DD/AAAA</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Zona horaria
              </span>
              <select
                value={prefs.zonaHoraria}
                onChange={(e) => setPrefs((p) => ({ ...p, zonaHoraria: e.target.value }))}
                className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                <option value="America/Tijuana">Tijuana (GMT-8)</option>
              </select>
            </label>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
