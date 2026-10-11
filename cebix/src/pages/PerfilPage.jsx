import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, Pencil, KeyRound, ShieldCheck, CalendarDays, Mail } from "lucide-react";
import Avatar from "../components/ui/Avatar";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import Toggle from "../components/settings/Toggle";
import EditProfileModal from "../components/settings/EditProfileModal";
import ChangePasswordModal from "../components/settings/ChangePasswordModal";
import { useAuth } from "../context/AuthContext";
import { useParcels } from "../context/ParcelsContext";
import useAccount from "../hooks/useAccount";
import { usePreferences } from "../context/PreferencesContext";
import { formatMonthYear, getLocale } from "../utils/intl";

function monthsAgo(iso) {
  const english = getLocale().startsWith("en");
  if (!iso) return english ? "3 months ago" : "hace 3 meses"; // valor por defecto del dataset semilla
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return english ? "today" : "hoy";
  if (days < 30) {
    return english ? `${days} day${days === 1 ? "" : "s"} ago` : `hace ${days} día${days === 1 ? "" : "s"}`;
  }
  const months = Math.floor(days / 30);
  return english ? `${months} month${months === 1 ? "" : "s"} ago` : `hace ${months} mes${months === 1 ? "" : "es"}`;
}

function memberSince(iso) {
  if (!iso) return "—";
  return formatMonthYear(iso);
}

export default function PerfilPage() {
  const { t } = usePreferences();
  const { user } = useAuth();
  const { account, updateAccount } = useAccount();
  const { parcels, isCustomParcel, regionSummary } = useParcels();
  const fullPhoto = account.avatarFull || account.avatar;
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Precarga y decodifica la foto grande en segundo plano: al tocarla ya está en memoria y el
  // visor abre al instante en vez de mostrar un spinner y trabarse decodificando.
  useEffect(() => {
    if (!fullPhoto) return undefined;
    const img = new Image();
    img.decoding = "async";
    img.src = fullPhoto;
    img.decode?.().catch(() => {});
    return () => {
      img.src = "";
    };
  }, [fullPhoto]);

  const stats = [
    { label: "Parcelas activas", value: parcels.length },
    { label: "Agregadas por ti", value: parcels.filter(isCustomParcel).length },
    { label: "Regiones cubiertas", value: regionSummary.length },
  ];

  return (
    <div className="pb-10">
      <TopBar title="Mi perfil" subtitle="Tu información de cuenta en CEBIX" hideSearch />

      <div className="mt-8 max-w-4xl px-4 sm:mt-10 sm:px-6 lg:px-8">
        {/* Identidad */}
        <SettingsSection icon={User} title="Identidad" description="Cómo te ven los demás dentro de CEBIX">
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            {account.avatar ? (
              <PhotoProvider
                maskOpacity={0.9}
                speed={() => 260}
                easing={() => "cubic-bezier(0.22, 1, 0.36, 1)"}
                overlayRender={({ overlay }) => overlay}
              >
                <PhotoView
                  src={fullPhoto}
                  overlay={
                    <div className="absolute inset-x-0 top-0 truncate bg-gradient-to-b from-black/60 to-transparent px-4 py-3 pr-16 text-sm font-semibold text-white">
                      {account.name || account.email}
                    </div>
                  }
                >
                  <button
                    type="button"
                    aria-label="Ver foto de perfil en grande"
                    className="shrink-0 cursor-zoom-in rounded-full transition-transform hover:scale-[1.02] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
                  >
                    <Avatar
                      src={fullPhoto}
                      name={account.name || account.email}
                      className="h-44 w-44 sm:h-56 sm:w-56"
                      textClass="text-5xl sm:text-6xl"
                    />
                  </button>
                </PhotoView>
              </PhotoProvider>
            ) : (
              <Avatar
                src=""
                name={account.name || account.email}
                className="h-44 w-44 sm:h-56 sm:w-56"
                textClass="text-5xl sm:text-6xl"
              />
            )}

            <div className="min-w-0 max-w-full">
              <p className="truncate font-display text-2xl font-bold text-gray-900 dark:text-white">
                {account.name || "Sin nombre"}
              </p>
              <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                <Mail size={14} className="shrink-0 text-accent-600 dark:text-accent-400" />
                <span className="truncate">{account.email}</span>
              </p>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                <CalendarDays size={14} className="shrink-0 text-accent-600 dark:text-accent-400" />
                {t("Miembro desde")} {memberSince(user?.created_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEditProfile(true)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Pencil size={14} className="text-accent-600 dark:text-accent-400" />
              Editar perfil
            </button>
          </div>

          {/* Stats: mismas líneas divisorias que el resto de la pantalla, sin
              tarjetas — solo se separan con una raya vertical entre columnas. */}
          <div className="grid grid-cols-3 divide-x divide-gray-200 py-5 text-center dark:divide-gray-800">
            {stats.map(({ label, value }) => (
              <div key={label} className="px-2 sm:px-4">
                <p className="font-display text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Seguridad de la cuenta */}
        <SettingsSection icon={ShieldCheck} title="Seguridad" description="Protege el acceso a tu cuenta">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">Contraseña</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {t("Última actualización")} {monthsAgo(account.passwordUpdatedAt)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <KeyRound size={13} className="text-accent-600 dark:text-accent-400" />
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
          onSave={async (fields) => {
            const { error } = await updateAccount(fields);
            if (error) {
              toast.error(error.message || "No se pudo actualizar el perfil.");
              return false;
            }
            toast.success("Perfil actualizado.");
            return true;
          }}
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
