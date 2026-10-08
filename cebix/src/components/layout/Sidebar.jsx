import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getPageRegistry } from "../../utils/pageRegistry";
import { ChevronRight, ChevronsUpDown, LogOut, Settings, X, Menu, PanelLeft } from "lucide-react";
import { generalNav, workspaceNav } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import Logo from "../ui/Logo";

function NavSection({ title, items, collapsed }) {
  // Re-renderiza al navegar para que cada enlace apunte a la pantalla tal
  // como se dejó (pestaña, filtro...), leyendo el registro singleton.
  const { pathname, search } = useLocation();
  const saved = getPageRegistry().search;
  return (
    <div className="mt-6 first:mt-0">
      {title && (
        <p
          aria-hidden={collapsed || undefined}
          className={[
            // Siempre ocupa su lugar (una sola línea) para que la separación
            // vertical sea idéntica con el sidebar contraído.
            "overflow-hidden whitespace-nowrap px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 transition-colors duration-300 ease-out",
            collapsed ? "invisible" : "",
          ].join(" ")}
        >
          {title}
        </p>
      )}
      <ul className="mt-2 space-y-0.5">
        {items.map(({ label, icon: Icon, to, badge }) => (
          <li key={label}>
            <NavLink
              to={to + (pathname === to ? search : saved.get(to) ?? "")}
              end={to === "/"}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                [
                  // Alto fijo: idéntico con el sidebar expandido y contraído.
                  "flex h-[34px] w-full items-center text-sm font-medium transition-colors duration-300 ease-out",
                  collapsed ? "justify-center px-0" : "gap-2.5 px-4",
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
                    className="shrink-0"
                  />
                  {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
                  {!collapsed && badge && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300 mr-1 transition-colors duration-300 ease-out">
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
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4"
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
            className="rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-contrast shadow-xs transition-colors hover:bg-accent-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-gray-900"
          >
            {loading ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ floating = false }) {
  // floating: en escritorio el sidebar sale del flujo y flota sobre el contenido
  // (lo usa el mapa satelital, que ocupa toda la pantalla por detrás).
  const { mobileOpen, close, collapsed: collapsedPref, setCollapsed } = useSidebar();
  // El modo "solo iconos" existe únicamente en escritorio (lg+). En móvil/tablet el
  // drawer siempre se muestra completo, aunque se haya contraído antes en escritorio.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const collapsed = collapsedPref && isDesktop;
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
          "fixed inset-y-3 left-3 z-50 flex shrink-0 flex-col overflow-hidden rounded-2xl duration-300 ease-out",
          // Transición suave al pasar de/al mapa satelital (fondo, borde y sombra). En móvil además
          // anima el deslizamiento del drawer; en escritorio no hay deslizamiento (lg:translate-x-0).
          "transition-[transform,background-color,border-color,box-shadow] lg:transition-[background-color,border-color,box-shadow]",
          // Sobre el mapa satelital: mismo fondo y borde que la barra vertical de
          // zoom (bg-black/90 + border-white/15, ver mapUi.js). La clase "dark"
          // fuerza los colores de texto/hover oscuros dentro del sidebar aunque
          // la app esté en modo claro, para que se lea sobre ese fondo.
          floating
            ? "dark border border-white/15 bg-black/90"
            : "border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-black",
          collapsed ? "lg:w-20" : "lg:w-[264px]",
          "w-[264px] max-w-[calc(100vw-1.5rem)]",
          floating
            ? "lg:absolute lg:inset-y-3 lg:left-3 lg:m-0 lg:translate-x-0"
            : "lg:static lg:inset-auto lg:m-3 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+0.75rem)]",
        ].join(" ")}
      >
        <div
          className={[
            "relative flex h-[61px] items-center gap-2.5 border-b border-gray-100 py-4 dark:border-gray-800 transition-colors duration-300 ease-out",
            collapsed ? "justify-center px-0" : "px-4",
          ].join(" ")}
        >
          {/* Mismo logo y misma posición en ambos estados: al contraer solo se oculta el texto. */}
          {/* Sobre el mapa satelital el fondo es siempre oscuro: logo (isotipo + texto) en blanco. */}
          <Logo size="sm" showText={!collapsed} tone={floating ? "white" : "auto"} />
          {collapsed && (
            // Al pasar el cursor, el icono del logo se cambia por el de expandir
            // (sin mover nada: va encima del logo, centrado en él).
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expandir menú"
              title="Expandir menú"
              className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white text-gray-600 opacity-0 transition-[opacity,color,background-color] duration-300 hover:opacity-100 focus-visible:opacity-100 dark:bg-black dark:text-gray-300"
            >
              <PanelLeft size={18} />
            </button>
          )}
          {isDesktop && !collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Contraer menú"
              title="Contraer menú"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors duration-300 ease-out"
            >
              <Menu size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors duration-300 ease-out lg:hidden"
          >
            <X size={16} />
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

        <div className="border-t border-gray-100 py-2 dark:border-gray-800 transition-colors duration-300 ease-out">
          <NavLink
            to="/perfil"
            title={collapsed ? profile?.name || user?.email || "Perfil" : undefined}
            className={[
              "flex w-full items-center py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors duration-300 ease-out",
              collapsed ? "justify-center px-0" : "gap-3 px-4",
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
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900 transition-colors duration-300 ease-out" />
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white transition-colors duration-300 ease-out">
                    {profile?.name || user?.email || "Perfil"}
                  </span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300 ease-out">
                    {user?.email || ""}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-gray-500 dark:text-gray-400 transition-colors duration-300 ease-out" />
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={[
              "flex h-[34px] w-full items-center text-left text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white transition-colors duration-300 ease-out",
              collapsed ? "justify-center px-0" : "gap-3 px-4",
            ].join(" ")}
          >
            <LogOut size={18} className="shrink-0" />
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