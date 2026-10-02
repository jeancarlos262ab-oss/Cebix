import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, ChevronsUpDown, LogOut, Settings, X, Menu, PanelLeft } from "lucide-react";
import { generalNav, workspaceNav } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import Logo from "../ui/Logo";

function NavSection({ title, items, collapsed }) {
  return (
    <div className="mt-6 first:mt-0">
      {title && !collapsed && (
        <p className="px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title}
        </p>
      )}
      <ul className="mt-2 space-y-0.5">
        {items.map(({ label, icon: Icon, to, badge }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={to === "/"}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                [
                  "flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "",
                  isActive
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.25 : 2}
                    className={[
                      "shrink-0",
                      isActive
                        ? "text-accent-700 dark:text-accent-400"
                        : "text-accent-600 dark:text-accent-400",
                    ].join(" ")}
                  />
                  {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
                  {!collapsed && badge && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300 mr-1">
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignOutConfirm({ onCancel, onConfirm, loading }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={loading ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        aria-describedby="signout-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <LogOut size={17} className="text-accent-600 dark:text-accent-400" />
          </span>
          <div className="min-w-0">
            <h2 id="signout-title" className="font-display text-sm font-semibold text-gray-900 dark:text-white">
              ¿Cerrar sesión?
            </h2>
            <p id="signout-desc" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tendrás que iniciar sesión de nuevo para volver a entrar.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-sm transition-colors hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-gray-900"
          >
            {loading ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { mobileOpen, close, collapsed, setCollapsed } = useSidebar();
  const { user, profile, signOut } = useAuth();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
      close();
    }
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-3 left-3 z-50 flex shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card transition-all duration-200 ease-out dark:border-gray-800 dark:bg-black",
          collapsed ? "lg:w-20" : "lg:w-[264px]",
          "w-[264px] max-w-[calc(100vw-1.5rem)]",
          "lg:static lg:inset-auto lg:m-3 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+0.75rem)]",
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          {!collapsed && <Logo size="md" />}
          {collapsed && (
            <div className="mx-auto">
              <PanelLeft
                size={20}
                className="cursor-pointer text-accent-600 dark:text-accent-400"
                onClick={() => setCollapsed(false)}
                title="Expandir menú"
              />
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Contraer menú"
              title="Contraer menú"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <Menu size={18} className="text-accent-600 dark:text-accent-400" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
            className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 lg:hidden"
          >
            <X size={16} className="text-accent-600 dark:text-accent-400" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-none py-4">
          <NavSection title="General" items={generalNav} collapsed={collapsed} />
          <NavSection title="Reto AgroCebada" items={workspaceNav} collapsed={collapsed} />
          <NavSection
            title="Sistema"
            items={[{ label: "Ajustes", icon: Settings, to: "/ajustes" }]}
            collapsed={collapsed}
          />
        </nav>

        <div className="border-t border-gray-100 py-2 dark:border-gray-800">
          <NavLink
            to="/perfil"
            title={collapsed ? profile?.name || user?.email || "Perfil" : undefined}
            className={[
              "flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900",
              collapsed ? "justify-center px-0" : "",
            ].join(" ")}
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
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {profile?.name || user?.email || "Perfil"}
                  </span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {user?.email || ""}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-accent-600 dark:text-accent-400" />
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={[
              "flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white",
              collapsed ? "justify-center px-0" : "",
            ].join(" ")}
          >
            <LogOut size={18} className="shrink-0 text-accent-600 dark:text-accent-400" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {confirmOpen && (
        <SignOutConfirm
          loading={signingOut}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleSignOut}
        />
      )}
    </>
  );
}