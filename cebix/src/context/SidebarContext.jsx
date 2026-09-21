import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const SidebarContext = createContext(null);

/**
 * Controla el menú lateral en pantallas angostas (drawer que se abre/cierra
 * con un botón de hamburguesa en TopBar). En pantallas grandes (lg+) el
 * sidebar siempre está visible y este estado no se usa.
 */
export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Cierra el drawer automáticamente al navegar a otra pantalla.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const value = {
    mobileOpen,
    open: () => setMobileOpen(true),
    close: () => setMobileOpen(false),
    toggle: () => setMobileOpen((v) => !v),
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>");
  return ctx;
}
