import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const SidebarContext = createContext(null);

/**
 * Controla el menú lateral en pantallas angostas (drawer que se abre/cierra
 * con un botón de hamburguesa en TopBar). En pantallas grandes (lg+) el
 * sidebar siempre está visible y este estado no se usa.
 */
export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // sidebar contraído (solo escritorio)
  const location = useLocation();

  // Cierra el drawer automáticamente al navegar a otra pantalla.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const open = useCallback(() => setMobileOpen(true), []);
  const close = useCallback(() => setMobileOpen(false), []);
  const toggle = useCallback(() => setMobileOpen((v) => !v), []);

  // Valor memoizado: antes era un objeto nuevo en cada render, así que Sidebar,
  // TopBar y el mapa se volvían a renderizar con cualquier cambio del layout.
  const value = useMemo(
    () => ({ mobileOpen, collapsed, setCollapsed, open, close, toggle }),
    [mobileOpen, collapsed, open, close, toggle]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>");
  return ctx;
}
