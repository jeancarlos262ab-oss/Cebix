import { NavLink } from "react-router-dom";
import { ChevronsUpDown, LogOut, Settings, X } from "lucide-react";
import { generalNav, workspaceNav } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import Logo from "../ui/Logo";

function NavSection({ title, items }) {
  return (
    <div className="mt-6 first:mt-0">
      {title && (
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title}
        </p>
      )}
      <ul className="mt-2 space-y-0.5">
        {items.map(({ label, icon: Icon, to, badge }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                [
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={17} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className=" bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  {badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar() {
  const { mobileOpen, close } = useSidebar();
  const { user, profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    close();
  }

  return (
    <>
      {/* Fondo oscuro detrás del menú cuando está abierto en móvil/tablet */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-full w-[264px] shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-out dark:border-gray-800 dark:bg-black",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <Logo size="md" />
          <ChevronsUpDown size={14} className="ml-auto text-gray-400 dark:text-gray-500" />
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
            className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-none py-4">
          <NavSection title="General" items={generalNav} />
          <NavSection title="Reto AgroCebada" items={workspaceNav} />
          <NavSection
            title="Sistema"
            items={[{ label: "Ajustes", icon: Settings, to: "/ajustes" }]}
          />
        </nav>

        <div className="border-t border-gray-100 py-2 dark:border-gray-800">
          <NavLink
            to="/ajustes"
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="relative h-9 w-9 shrink-0 rounded-full bg-gray-200">
              <img
                src={profile?.avatar_url || `https://i.pravatar.cc/72?u=${user?.id ?? "cebix"}`}
                alt={profile?.name || user?.email || "Perfil"}
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                {profile?.name || user?.email || "Perfil"}
              </span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                {user?.email || ""}
              </span>
            </span>
            <Settings size={16} className="shrink-0 text-gray-400 dark:text-gray-500" />
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <LogOut size={17} className="shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
