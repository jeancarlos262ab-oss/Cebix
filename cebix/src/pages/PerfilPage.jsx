import { useState } from "react";
import { toast } from "sonner";
import { User, Pencil, KeyRound, ShieldCheck, CalendarDays, Mail } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import SettingsSection from "../components/settings/SettingsSection";
import Toggle from "../components/settings/Toggle";
import EditProfileModal from "../components/settings/EditProfileModal";
import ChangePasswordModal from "../components/settings/ChangePasswordModal";
import { useAuth } from "../context/AuthContext";
import { useParcels } from "../context/ParcelsContext";
import useAccount from "../hooks/useAccount";

function monthsAgo(iso) {
  if (!iso) return "hace 3 meses"; // valor por defecto del dataset semilla
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "hoy";
  if (days < 30) return `hace ${days} día${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? "" : "es"}`;
}

function memberSince(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "long" });
}

export default function PerfilPage() {
  const { user } = useAuth();
  const { account, updateAccount } = useAccount();
  const { parcels, isCustomParcel, regionSummary } = useParcels();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const stats = [
    { label: "Parcelas activas", value: parcels.length },
    { label: "Agregadas por ti", value: parcels.filter(isCustomParcel).length },
    { label: "Regiones cubiertas", value: regionSummary.length },
  ];

  return (
    <div className="pb-10">
      <TopBar title="Mi perfil" subtitle="Tu información de cuenta en CEBIX" hideSearch />

      <div className="mt-2 max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Identidad */}
        <SettingsSection icon={User} title="Identidad" description="Cómo te ven los demás dentro de CEBIX">
          <div className="flex flex-col items-start gap-5 py-3 sm:flex-row sm:items-center">
            <img
              src={account.avatar || `https://i.pravatar.cc/128?u=${user?.id ?? "cebix"}`}
              alt={account.name || "Foto de perfil"}
              loading="lazy"
              decoding="async"
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {account.name || "Sin nombre"}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <Mail size={12} className="shrink-0 text-accent-600 dark:text-accent-400" />
                <span className="truncate">{account.email}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <CalendarDays size={12} className="shrink-0 text-accent-600 dark:text-accent-400" />
                Miembro desde {memberSince(user?.created_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEditProfile(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Pencil size={13} className="text-accent-600 dark:text-accent-400" />
              Editar perfil
            </button>
          </div>

          {/* Stats: mismas líneas divisorias que el resto de la pantalla, sin
              tarjetas — solo se separan con una raya vertical entre columnas. */}
          <div className="grid grid-cols-3 py-3 text-center sm:text-left">
            {stats.map(({ label, value }) => (
              <div key={label} className="px-2 first:pl-0 sm:px-4">
                <p className="font-display text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Seguridad de la cuenta */}
        <SettingsSection icon={ShieldCheck} title="Seguridad" description="Protege el acceso a tu cuenta">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">Contraseña</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Última actualización {monthsAgo(account.passwordUpdatedAt)}
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
          onSave={(fields) => {
            updateAccount(fields);
            toast.success("Perfil actualizado.");
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
