import { useEffect, useState } from "react";
import { Palette, Bell, Globe2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import ThemePreviewCard from "../components/settings/ThemePreviewCard";
import Toggle from "../components/settings/Toggle";
import { useTheme } from "../context/ThemeContext";
import useAccount from "../hooks/useAccount";
import { usePreferences } from "../context/PreferencesContext";
import { timeZoneOffsetLabel } from "../utils/intl";

const ACCENTS = [
  { id: "brand", label: "Ámbar", swatch: "#C08A2E" },
  { id: "cobre", label: "Cobre", swatch: "#B76637" },
  { id: "oliva", label: "Oliva", swatch: "#949F4F" },
  { id: "pizarra", label: "Pizarra", swatch: "#4A71A4" },
  { id: "ndvi", label: "NDVI", swatch: "#4C9A63" },
  { id: "mono", label: "Negro", swatch: "#111827", darkLabel: "Blanco", darkSwatch: "#FFFFFF" },
];

const TIME_ZONES = [
  { id: "America/Mexico_City", city: "Ciudad de México" },
  { id: "America/Cancun", city: "Cancún" },
  { id: "America/Chihuahua", city: "Chihuahua" },
  { id: "America/Hermosillo", city: "Hermosillo" },
  { id: "America/Tijuana", city: "Tijuana" },
  { id: "America/New_York", city: "Nueva York" },
  { id: "America/Los_Angeles", city: "Los Ángeles" },
  { id: "Europe/Madrid", city: "Madrid" },
];
const TIME_ZONE_CITY_EN = {
  "Ciudad de México": "Mexico City",
  Cancún: "Cancún",
  "Nueva York": "New York",
  "Los Ángeles": "Los Angeles",
};

export default function AjustesPage() {
  const {
    t, idioma, formatoFecha, zonaHoraria,
    setIdioma, setFormatoFecha, setZonaHoraria, resetRegion,
    formatDate, formatTime, formatNumber,
  } = usePreferences();
  const { theme, setTheme, accent, setAccent, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const swatchOf = (a) => (isDark && a.darkSwatch) || a.swatch;
  const accentColor = swatchOf(ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]);

  // Preferencias de correo: se guardan en el perfil (Supabase). El estado local se actualiza al
  // instante y se revierte si el guardado falla.
  const { account, updateAccount } = useAccount();
  const [notifs, setNotifs] = useState({
    email: account.notifEmail,
    riesgo: account.notifRisk,
    resumenSemanal: account.notifWeekly,
  });
  useEffect(() => {
    setNotifs({ email: account.notifEmail, riesgo: account.notifRisk, resumenSemanal: account.notifWeekly });
  }, [account.notifEmail, account.notifRisk, account.notifWeekly]);

  const NOTIF_FIELD = { email: "notifEmail", riesgo: "notifRisk", resumenSemanal: "notifWeekly" };
  async function saveNotif(key, value) {
    const previous = notifs[key];
    setNotifs((n) => ({ ...n, [key]: value }));
    const { error } = await updateAccount({ [NOTIF_FIELD[key]]: value });
    if (error) {
      setNotifs((n) => ({ ...n, [key]: previous }));
      toast.error(t("No se pudo guardar la preferencia. Intenta de nuevo."));
    } else {
      toast.success(value ? t("Aviso activado.") : t("Aviso desactivado."));
    }
  }

  function handleReset() {
    setTheme("system");
    setAccent("brand");
    setNotifs({ email: true, riesgo: true, resumenSemanal: false });
    updateAccount({ notifEmail: true, notifRisk: true, notifWeekly: false }).then(({ error }) => {
      if (error) toast.error(t("No se pudieron restablecer las notificaciones."));
    });
    resetRegion();
    toast.info(t("Ajustes restablecidos."));
  }

  return (
    <div className="pb-10">
      <TopBar
        title={t("Ajustes")}
        subtitle={t("Personaliza la apariencia y el comportamiento de CEBIX")}
        hideSearch
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw size={13} className="text-accent-600 dark:text-accent-400" />
              {t("Restablecer")}
            </button>
          </div>
        }
      />

      <div className="mt-2 max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Apariencia */}
        <SettingsSection
          icon={Palette}
          title={t("Apariencia")}
          description={t("Elige cómo se ve CEBIX en este dispositivo")}
        >
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            <ThemePreviewCard
              label={t("Claro")}
              description={t("Ideal para exteriores")}
              variant="light"
              active={theme === "light"}
              onSelect={() => setTheme("light")}
              accentColor={accentColor}
            />
            <ThemePreviewCard
              label={t("Oscuro")}
              description={t("Menos fatiga visual")}
              variant="dark"
              active={theme === "dark"}
              onSelect={() => setTheme("dark")}
              accentColor={accentColor}
            />
            <ThemePreviewCard
              label={t("Sistema")}
              description={t("Sigue al dispositivo")}
              variant="split"
              active={theme === "system"}
              onSelect={() => setTheme("system")}
              accentColor={accentColor}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                {t("Color de acento")}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {t("Se usa en botones, enlaces y gráficas principales")}
              </span>
            </span>
            <div className="flex items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={t((isDark && a.darkLabel) || a.label)}
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
          title={t("Notificaciones")}
          description={t("Elige qué avisos quieres recibir")}
        >
          <Toggle
            label={t("Alertas por correo")}
            description={t("Interruptor general: si lo apagas no recibirás ningún correo de CEBIX")}
            checked={notifs.email}
            onChange={(v) => saveNotif("email", v)}
          />
          <Toggle
            label={t("Alertas de riesgo")}
            description={t("Cuando una parcela cambia a semáforo rojo o amarillo")}
            checked={notifs.riesgo}
            disabled={!notifs.email}
            onChange={(v) => saveNotif("riesgo", v)}
          />
          <Toggle
            label={t("Resumen semanal")}
            description={t("Reporte cada lunes con el estado general del portafolio")}
            checked={notifs.resumenSemanal}
            disabled={!notifs.email}
            onChange={(v) => saveNotif("resumenSemanal", v)}
          />
        </SettingsSection>

        {/* Idioma y región */}
        <SettingsSection
          icon={Globe2}
          title={t("Idioma y región")}
          description={t("Formato de fecha, hora y zona horaria")}
        >
          <div className="grid grid-cols-1 gap-4 py-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("Idioma")}
              </span>
              <select
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-500 dark:focus:border-accent-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="es-MX">Español (México)</option>
                <option value="en-US">English (US)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("Formato de fecha")}
              </span>
              <select
                value={formatoFecha}
                onChange={(e) => setFormatoFecha(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-500 dark:focus:border-accent-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="dd/mm/aaaa">DD/MM/AAAA</option>
                <option value="mm/dd/aaaa">MM/DD/AAAA</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("Zona horaria")}
              </span>
              <select
                value={zonaHoraria}
                onChange={(e) => setZonaHoraria(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-500 dark:focus:border-accent-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {TIME_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {idioma === "en-US" ? TIME_ZONE_CITY_EN[z.city] ?? z.city : z.city} ({timeZoneOffsetLabel(z.id, idioma)})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="pb-1 text-xs text-gray-500 dark:text-gray-400">
            {t("Vista previa")}: {formatDate(new Date())} · {formatTime(new Date())} · {formatNumber(1234567.89)}
          </p>
        </SettingsSection>
      </div>
    </div>
  );
}
