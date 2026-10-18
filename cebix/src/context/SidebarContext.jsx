import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false); 
  const location = useLocation();

  
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const open = useCallback(() => setMobileOpen(true), []);
  const close = useCallback(() => setMobileOpen(false), []);
  const toggle = useCallback(() => setMobileOpen((v) => !v), []);

  
  
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