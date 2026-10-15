import { useEffect, useState } from "react";
import { Palette, Bell, Globe2, RotateCcw, Save, Loader2 } from "lucide-react";
import { isToastSoundEnabled, setToastSoundEnabled, toast } from "../services/toast";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import ThemePreviewCard from "../components/settings/ThemePreviewCard";
import Toggle from "../components/settings/Toggle";
import { useTheme } from "../context/ThemeContext";
import useAccount from "../hooks/useAccount";
import { usePreferences } from "../context/PreferencesContext";
import { DEFAULT_REGION, timeZoneOffsetLabel } from "../utils/intl";

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

  // Nada de Ajustes se guarda solo: todo se edita en un BORRADOR y se aplica/guarda con "Guardar cambios".
  const { account, updateAccount } = useAccount();
  const savedPref = { theme, accent, idioma, formatoFecha, zonaHoraria };
  const savedNotifs = { email: account.notifEmail, riesgo: account.notifRisk, resumenSemanal: account.notifWeekly };
  const [pref, setPref] = useState(savedPref);
  const [notifs, setNotifs] = useState(savedNotifs);
  const [soundOn, setSoundOn] = useState(isToastSoundEnabled);
  const [saving, setSaving] = useState(false);
  const accentColor = swatchOf(ACCENTS.find((a) => a.id === pref.accent) ?? ACCENTS[0]);

  // Si la cuenta termina de cargar (o cambia en otro lado) el borrador de avisos se alinea con lo guardado.
  useEffect(() => {
    setNotifs({ email: account.notifEmail, riesgo: account.notifRisk, resumenSemanal: account.notifWeekly });
  }, [account.notifEmail, account.notifRisk, account.notifWeekly]);

  const dirty =
    Object.keys(savedPref).some((k) => pref[k] !== savedPref[k]) ||
    Object.keys(savedNotifs).some((k) => notifs[k] !== savedNotifs[k]) ||
    soundOn !== isToastSoundEnabled();

  // Aviso del navegador si hay cambios sin guardar.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    // Primero lo que vive en el servidor (perfil): si falla, no se aplica nada y el borrador sigue ahí.
    const patch = {};
    if (notifs.email !== account.notifEmail) patch.notifEmail = notifs.email;
    if (notifs.riesgo !== account.notifRisk) patch.notifRisk = notifs.riesgo;
    if (notifs.resumenSemanal !== account.notifWeekly) patch.notifWeekly = notifs.resumenSemanal;
    if (Object.keys(patch).length > 0) {
      const { error } = await updateAccount(patch);
      if (error) {
        setSaving(false);
        toast.error(t("No se pudieron guardar los ajustes. Intenta de nuevo."));
        return;
      }
    }
    setToastSoundEnabled(soundOn);
    if (pref.theme !== theme) setTheme(pref.theme);
    if (pref.accent !== accent) setAccent(pref.accent);
    if (pref.formatoFecha !== formatoFecha) setFormatoFecha(pref.formatoFecha);
    if (pref.zonaHoraria !== zonaHoraria) setZonaHoraria(pref.zonaHoraria);
    if (pref.idioma !== idioma) setIdioma(pref.idioma); // cambia el idioma de toda la app (vuelve a montar la pantalla)
    setSaving(false);
    toast.success(t("Ajustes guardados."));
  }

  function handleDiscard() {
    setPref(savedPref);
    setNotifs(savedNotifs);
    setSoundOn(isToastSoundEnabled());
  }

  // "Restablecer" solo carga los valores por defecto en el borrador; se aplican al pulsar "Guardar cambios".
  function handleReset() {
    setPref({ theme: "system", accent: "brand", ...DEFAULT_REGION });
    setNotifs({ email: true, riesgo: true, resumenSemanal: false });
    setSoundOn(true);
    toast.info(t("Valores por defecto cargados. Pulsa Guardar cambios para aplicarlos."));
  }

  return (
    <div className="pb-10">
      <TopBar
        title={t("Ajustes")}
        subtitle={t("Personaliza la apariencia y el comportamiento de CEBIX")}
        hideSearch
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t("Descartar")}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 rounded-full bg-accent-500 px-3.5 py-2 text-xs font-medium text-accent-contrast hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.75} />}
              {t("Guardar cambios")}
            </button>
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

      <div className="mt-8 max-w-4xl px-4 sm:mt-10 sm:px-6 lg:px-8">
        {/* Apariencia */}
        <SettingsSection
          icon={Palette}
          title={t("Apariencia")}
          description={t("Elige cómo se ve CEBIX en este dispositivo")}
        >
          <div className="-mx-5">
          <div className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <ThemePreviewCard
              label={t("Claro")}
              description={t("Ideal para exteriores")}
              variant="light"
              active={pref.theme === "light"}
              onSelect={() => setPref((p) => ({ ...p, theme: "light" }))}
              accentColor={accentColor}
            />
            <ThemePreviewCard
              label={t("Oscuro")}
              description={t("Menos fatiga visual")}
              variant="dark"
              active={pref.theme === "dark"}
              onSelect={() => setPref((p) => ({ ...p, theme: "dark" }))}
              accentColor={accentColor}
            />
            <ThemePreviewCard
              label={t("Sistema")}
              description={t("Sigue al dispositivo")}
              variant="split"
              active={pref.theme === "system"}
              onSelect={() => setPref((p) => ({ ...p, theme: "system" }))}
              accentColor={accentColor}
            />
          </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
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
                  onClick={() => setPref((p) => ({ ...p, accent: a.id }))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105"
                  style={{
                    borderColor: pref.accent === a.id ? swatchOf(a) : "transparent",
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
            onChange={(v) => setNotifs((n) => ({ ...n, email: v }))}
          />
          <Toggle
            label={t("Alertas de riesgo")}
            description={t("Cuando una parcela cambia a semáforo rojo o amarillo")}
            checked={notifs.riesgo}
            disabled={!notifs.email}
            onChange={(v) => setNotifs((n) => ({ ...n, riesgo: v }))}
          />
          <Toggle
            label={t("Resumen semanal")}
            description={t("Reporte cada lunes con el estado general del portafolio")}
            checked={notifs.resumenSemanal}
            disabled={!notifs.email}
            onChange={(v) => setNotifs((n) => ({ ...n, resumenSemanal: v }))}
          />
          <Toggle
            label={t("Sonido de notificaciones")}
            description={t("Reproduce un sonido cuando aparece un aviso en la esquina inferior derecha (solo en este dispositivo)")}
            checked={soundOn}
            onChange={(v) => setSoundOn(v)}
          />
        </SettingsSection>

        {/* Idioma y región */}
        <SettingsSection
          icon={Globe2}
          title={t("Idioma y región")}
          description={t("Formato de fecha, hora y zona horaria")}
        >
          <div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("Idioma")}
              </span>
              <select
                value={pref.idioma}
                onChange={(e) => setPref((p) => ({ ...p, idioma: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-accent-500 dark:focus:border-accent-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                value={pref.formatoFecha}
                onChange={(e) => setPref((p) => ({ ...p, formatoFecha: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-accent-500 dark:focus:border-accent-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                value={pref.zonaHoraria}
                onChange={(e) => setPref((p) => ({ ...p, zonaHoraria: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-accent-500 dark:focus:border-accent-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {TIME_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {idioma === "en-US" ? TIME_ZONE_CITY_EN[z.city] ?? z.city : z.city} ({timeZoneOffsetLabel(z.id, idioma)})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="py-4 text-xs text-gray-500 dark:text-gray-400">
            {t("Vista previa")}: {formatDate(new Date())} · {formatTime(new Date())} · {formatNumber(1234567.89)}
          </p>
        </SettingsSection>
      </div>
    </div>
  );
}
