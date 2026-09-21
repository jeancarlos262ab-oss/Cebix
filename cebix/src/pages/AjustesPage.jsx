import { useState } from "react";
import {
  Palette,
  Bell,
  Globe2,
  ShieldCheck,
  LayoutGrid,
  Satellite,
  Check,
  RotateCcw,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import ThemePreviewCard from "../components/settings/ThemePreviewCard";
import Toggle from "../components/settings/Toggle";
import EditProfileModal from "../components/settings/EditProfileModal";
import ChangePasswordModal from "../components/settings/ChangePasswordModal";
import { useTheme } from "../context/ThemeContext";
import useAccount from "../hooks/useAccount";

const ACCENTS = [
  { id: "brand", label: "Ámbar", swatch: "#C08A2E" },
  { id: "mono", label: "Negro", swatch: "#111827", darkLabel: "Blanco", darkSwatch: "#FFFFFF" },
  { id: "ndvi", label: "NDVI", swatch: "#4C9A63" },
];

function monthsAgo(iso) {
  if (!iso) return "hace 3 meses"; // valor por defecto del dataset semilla
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "hoy";
  if (days < 30) return `hace ${days} día${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? "" : "es"}`;
}

export default function AjustesPage() {
  const { theme, setTheme, accent, setAccent, density, setDensity, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const swatchOf = (a) => (isDark && a.darkSwatch) || a.swatch;
  const { account, updateAccount } = useAccount();
  const accentColor = swatchOf(ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [notifs, setNotifs] = useState({
    email: true,
    riesgo: true,
    resumenSemanal: false,
    producto: false,
  });

  const [prefs, setPrefs] = useState({
    idioma: "es-MX",
    formatoFecha: "dd/mm/aaaa",
    zonaHoraria: "America/Mexico_City",
    capaMapa: "NDVI",
  });

  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function handleReset() {
    setTheme("system");
    setAccent("mono");
    setDensity("comoda");
    setNotifs({ email: true, riesgo: true, resumenSemanal: false, producto: false });
    setPrefs({
      idioma: "es-MX",
      formatoFecha: "dd/mm/aaaa",
      zonaHoraria: "America/Mexico_City",
      capaMapa: "NDVI",
    });
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
              className="flex items-center gap-1.5 border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw size={13} />
              Restablecer
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-accent-500 px-3.5 py-2 text-xs font-semibold text-accent-contrast shadow-sm hover:bg-accent-600"
            >
              {saved ? <Check size={13} /> : null}
              {saved ? "Guardado" : "Guardar cambios"}
            </button>
          </div>
        }
      />

      <div className="mt-2 max-w-4xl divide-y divide-gray-200 px-4 sm:px-6 lg:px-8 dark:divide-gray-800">
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
                  className="flex h-8 w-8 items-center justify-center border-2 transition-transform hover:scale-105"
                  style={{
                    borderColor: accent === a.id ? swatchOf(a) : "transparent",
                  }}
                >
                  <span
                    className="h-5.5 w-5.5"
                    style={{ backgroundColor: swatchOf(a), height: "22px", width: "22px" }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Densidad de interfaz
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Compacta muestra más información por pantalla
              </span>
            </span>
            <div className="flex border border-gray-200 bg-white p-0.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-800">
              {[
                { id: "comoda", label: "Cómoda" },
                { id: "compacta", label: "Compacta" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDensity(opt.id)}
                  className={[
                    " px-3 py-1.5 transition-colors",
                    density === opt.id
                      ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400",
                  ].join(" ")}
                >
                  {opt.label}
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
          <Toggle
            label="Novedades del producto"
            description="Nuevas funciones y mejoras del modelo"
            checked={notifs.producto}
            onChange={(v) => setNotifs((n) => ({ ...n, producto: v }))}
          />
        </SettingsSection>

        {/* Mapa y modelo */}
        <SettingsSection
          icon={Satellite}
          title="Mapa y modelo"
          description="Preferencias por defecto al abrir el mapa satelital"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Capa por defecto
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Capa que se muestra al entrar al mapa satelital
              </span>
            </span>
            <select
              value={prefs.capaMapa}
              onChange={(e) => setPrefs((p) => ({ ...p, capaMapa: e.target.value }))}
              className=" border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="NDVI">NDVI</option>
              <option value="RGB">RGB (color natural)</option>
              <option value="Humedad">Humedad de suelo</option>
            </select>
          </div>
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
                className="w-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                className="w-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                className="w-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                <option value="America/Tijuana">Tijuana (GMT-8)</option>
              </select>
            </label>
          </div>
        </SettingsSection>

        {/* Cuenta */}
        <SettingsSection
          icon={LayoutGrid}
          title="Cuenta"
          description="Información de tu perfil en CEBIX"
        >
          <div className="flex items-center gap-4 py-3">
            <img
              src={account.avatar}
              alt={account.name}
              loading="lazy"
              decoding="async"
              className="h-14 w-14 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {account.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {account.email} · {account.role}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditProfile(true)}
              className=" border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Editar perfil
            </button>
          </div>
        </SettingsSection>

        {/* Seguridad */}
        <SettingsSection
          icon={ShieldCheck}
          title="Seguridad"
          description="Protege el acceso a tu cuenta"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Contraseña
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Última actualización {monthsAgo(account.passwordUpdatedAt)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className=" border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cambiar
            </button>
          </div>
          <Toggle
            label="Verificación en dos pasos"
            description="Añade una capa extra de seguridad al iniciar sesión"
            checked={Boolean(account.twoFactor)}
            onChange={(v) => updateAccount({ twoFactor: v })}
          />
        </SettingsSection>
      </div>

      {showEditProfile && (
        <EditProfileModal
          account={account}
          onClose={() => setShowEditProfile(false)}
          onSave={(fields) => updateAccount(fields)}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onChanged={() => updateAccount({ passwordUpdatedAt: new Date().toISOString() })}
        />
      )}
    </div>
  );
}
