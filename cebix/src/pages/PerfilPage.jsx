import { userMessage } from "../utils/userMessages";
import { useEffect, useState } from "react";
import { toast } from "../services/toast";
import { Pencil, KeyRound, ShieldCheck, CalendarDays, Mail } from "lucide-react";
import Avatar from "../components/ui/Avatar";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import EditProfileModal from "../components/settings/EditProfileModal";
import ChangePasswordModal from "../components/settings/ChangePasswordModal";
import { useAuth } from "../context/AuthContext";
import { useParcels } from "../context/ParcelsContext";
import useAccount from "../hooks/useAccount";
import { formatMonthYear } from "../utils/intl";

function monthsAgo(iso) {
  if (!iso) return "hace 3 meses";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "hoy";
  if (days < 30) return `hace ${days} día${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? "" : "es"}`;
}

function memberSince(iso) {
  if (!iso) return "—";
  return formatMonthYear(iso);
}

export default function PerfilPage() {
  const { user } = useAuth();
  const { account, updateAccount } = useAccount();
  const { parcels, isCustomParcel, regionSummary } = useParcels();
  const fullPhoto = account.avatarFull || account.avatar;
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  
  
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

  const displayName = account.name || account.email;
  const avatarClass = "h-44 w-44 sm:h-52 sm:w-52 lg:h-56 lg:w-56";
  const avatarText = "text-5xl sm:text-6xl";

  return (
    <div className="pb-10">
      <TopBar title="Mi perfil" subtitle="Tu información de cuenta en CEBIX" hideSearch />

      <div className="mt-8 grid max-w-5xl grid-cols-1 items-start gap-x-14 gap-y-12 px-4 sm:mt-10 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-8">
        {}
        <section className="flex min-w-0 flex-col items-center text-center lg:sticky lg:top-6">
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
                    {displayName}
                  </div>
                }
              >
                <button
                  type="button"
                  aria-label="Ver foto de perfil en grande"
                  className="shrink-0 cursor-zoom-in rounded-full overflow-hidden border border-gray-200 transition-transform hover:scale-[1.02] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:border-gray-800 dark:focus-visible:ring-offset-black"
                >
                  <Avatar src={fullPhoto} name={displayName} className={avatarClass} textClass={avatarText} />
                </button>
              </PhotoView>
            </PhotoProvider>
          ) : (
            <span className="shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
              <Avatar src="" name={displayName} className={avatarClass} textClass={avatarText} />
            </span>
          )}

          <div className="mt-7 min-w-0 max-w-full">
            <h2 className="truncate font-display text-2xl font-bold text-gray-900 dark:text-white">
              {account.name || "Sin nombre"}
            </h2>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Mail size={14} className="shrink-0 text-accent-600 dark:text-accent-400" />
              <span className="truncate">{account.email}</span>
            </p>
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
              <CalendarDays size={14} className="shrink-0 text-accent-600 dark:text-accent-400" />
              Miembro desde {memberSince(user?.created_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowEditProfile(true)}
            className="mt-6 flex shrink-0 items-center gap-2 rounded-lg bg-accent-500 px-5 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
          >
            <Pencil size={14} />
            Editar perfil
          </button>
        </section>

        <div className="min-w-0 space-y-12">
          {}
          <dl className="grid grid-cols-3 gap-6">
            {stats.map(({ label, value }) => (
              <div key={label}>
                <dd className="font-display text-2xl font-bold tabular-nums text-gray-900 dark:text-white sm:text-3xl">
                  {value}
                </dd>
                <dt className="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{label}</dt>
              </div>
            ))}
          </dl>

          {}
          <SettingsSection icon={ShieldCheck} title="Seguridad" description="Protege el acceso a tu cuenta">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">Contraseña</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  Última actualización {monthsAgo(account.passwordUpdatedAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <KeyRound size={13} className="text-accent-600 dark:text-accent-400" />
                Cambiar
              </button>
            </div>
          </SettingsSection>
        </div>
      </div>

      {showEditProfile && (
        <EditProfileModal
          account={account}
          onClose={() => setShowEditProfile(false)}
          onSave={async (fields) => {
            const { error } = await updateAccount(fields);
            if (error) {
              toast.error(userMessage(error, "No se pudo actualizar el perfil. Inténtalo de nuevo."));
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