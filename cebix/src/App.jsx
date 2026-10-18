import { lazy, memo, Suspense, useContext, useEffect, useLayoutEffect, useRef } from "react";
import {
  Navigate,
  Route,
  Routes,
  UNSAFE_LocationContext as LocationContext,
  useLocation,
  useOutlet,
} from "react-router-dom";
import AuthShell from "./components/auth/AuthShell";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Sidebar from "./components/layout/Sidebar";
import CornerGlow from "./components/layout/CornerGlow";
import UnsavedBar from "./components/ui/UnsavedBar";
import { SidebarProvider } from "./context/SidebarContext";
import { useParcels } from "./context/ParcelsContext";
import { getPageRegistry } from "./utils/pageRegistry";
import { prefetchMapEngine } from "./utils/mapLoaders";
import { PageActiveContext } from "./context/PageActiveContext";
import { FullScreenSkeleton, RouteSkeleton, pageKeyFromPath } from "./components/ui/PageSkeleton";

const pageLoaders = {
  dashboard: () => import("./pages/DashboardPage"),
  parcelas: () => import("./pages/ParcelasPage"),
  parcelaDetalle: () => import("./pages/ParcelaDetallePage"),
  parcelasHistorial: () => import("./pages/ParcelasHistorialPage"),
  modelo: () => import("./pages/ModeloPage"),
  mapa: () => import("./pages/MapaSatelitalPage"),
  satelite: () => import("./pages/SatelitePage"),
  predicciones: () => import("./pages/PrediccionesPage"),
  shap: () => import("./pages/ValidacionSHAPPage"),
  ajustes: () => import("./pages/AjustesPage"),
  perfil: () => import("./pages/PerfilPage"),
  acerca: () => import("./pages/AcercaPage"),
};

const DashboardPage = lazy(pageLoaders.dashboard);
const ParcelasPage = lazy(pageLoaders.parcelas);
const ParcelaDetallePage = lazy(pageLoaders.parcelaDetalle);
const ParcelasHistorialPage = lazy(pageLoaders.parcelasHistorial);
const ModeloPage = lazy(pageLoaders.modelo);
const MapaSatelitalPage = lazy(pageLoaders.mapa);
const SatelitePage = lazy(pageLoaders.satelite);
const PrediccionesPage = lazy(pageLoaders.predicciones);
const ValidacionSHAPPage = lazy(pageLoaders.shap);
const AjustesPage = lazy(pageLoaders.ajustes);
const PerfilPage = lazy(pageLoaders.perfil);
const AcercaPage = lazy(pageLoaders.acerca);
const loadLogin = () => import("./pages/LoginPage");
const loadSignup = () => import("./pages/SignupPage");
const LoginPage = lazy(loadLogin);
const SignupPage = lazy(loadSignup);

function RouteFallback({ pathname }) {
  const page = pageKeyFromPath(pathname ?? (typeof window !== "undefined" ? window.location.pathname : ""));
  return <RouteSkeleton page={page ?? "dashboard"} />;
}

function RootFallback() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (/^\/(login|signup)\/?$/.test(path)) return <div className="h-screen w-full bg-white dark:bg-black" />;
  return <FullScreenSkeleton page={pageKeyFromPath(path) ?? "dashboard"} />;
}

function usePrefetchPages() {
  useEffect(() => {
    const queue = [
      pageLoaders.parcelas,
      pageLoaders.predicciones,
      pageLoaders.modelo,
      pageLoaders.shap,
      pageLoaders.parcelaDetalle,
      pageLoaders.parcelasHistorial,
      pageLoaders.ajustes,
      pageLoaders.perfil,
      pageLoaders.acerca,
      pageLoaders.satelite,
      pageLoaders.mapa,
      prefetchMapEngine, 
    ];
    const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 600));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    let handle;
    let stopped = false;

    const next = () => {
      if (stopped) return;
      const load = queue.shift();
      if (!load) return;
      load()
        .catch(() => {})
        .finally(() => {
          handle = idle(next);
        });
    };
    handle = idle(next);

    return () => {
      stopped = true;
      cancel(handle);
    };
  }, []);
}

function pageKey(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (["/", "/parcelas", "/parcelas/historial", "/modelo", "/mapa", "/predicciones", "/satelite", "/shap", "/acerca", "/ajustes", "/perfil"].includes(path)) {
    return path;
  }
  
  
  
  if (/^\/parcelas\/[^/]+$/.test(path)) return "/parcelas/:id";
  return null;
}

const KeepAliveOutlet = memo(function KeepAliveOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigationType = useContext(LocationContext).navigationType;
  const key = pageKey(location.pathname);

  
  const registry = getPageRegistry();
  const entriesRef = { current: registry.entries };
  const scrollRef = { current: registry.scroll };
  const searchRef = { current: registry.search };
  const activeKeyRef = registry.active;

  
  
  if (key) entriesRef.current.set(key, { outlet, location, navigationType });

  
  useEffect(() => {
    const el = document.getElementById("app-scroll");
    if (!el) return;
    const onScroll = () => {
      if (activeKeyRef.key) scrollRef.current.set(activeKeyRef.key, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!key) return;
    
    if (activeKeyRef.key !== key) {
      activeKeyRef.key = key;
      const el = document.getElementById("app-scroll");
      if (el) el.scrollTop = scrollRef.current.get(key) ?? 0;
    }
    
    searchRef.current.set(key, location.search);
  });

  return (
    <>
      {[...entriesRef.current].map(([k, entry]) => (
        
        
        <PageSlot key={k} active={k === (key ?? activeKeyRef.key)} entry={entry} />
      ))}
      {}
      {!key && outlet}
    </>
  );
});

const HIDDEN_STYLE = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  visibility: "hidden",
  pointerEvents: "none",
  
  
  contentVisibility: "hidden",
};

const PageSlot = memo(function PageSlot({ active, entry }) {
  const frozen = useRef(null);
  if (active || !frozen.current) {
    frozen.current = { location: entry.location, navigationType: entry.navigationType };
  }
  return (
    <div style={active ? { display: "contents" } : HIDDEN_STYLE} aria-hidden={active ? undefined : true}>
      {
}
      <Suspense fallback={<RouteFallback pathname={entry.location.pathname} />}>
        <PageActiveContext.Provider value={active}>
          <LocationContext.Provider value={frozen.current}>{entry.outlet}</LocationContext.Provider>
        </PageActiveContext.Provider>
      </Suspense>
    </div>
  );
});

function AuthenticatedLayout() {
  usePrefetchPages();
  
  
  
  
  const { parcels } = useParcels();
  const pathname = useLocation().pathname;
  const onMap = pathname.replace(/\/+$/, "") === "/mapa" && parcels.length > 0;

  
  
  useEffect(() => {
    const id = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => window.cancelAnimationFrame(id);
  }, [onMap]);

  return (
    <SidebarProvider>
      <div className="relative isolate flex h-screen w-full overflow-hidden supports-[height:100dvh]:h-dvh bg-white dark:bg-black">
        {
}
        <CornerGlow className={`-z-10 ${onMap ? "hidden" : ""}`} />
        <Sidebar floating={onMap} />

        <main
          id="app-scroll"
          className={`min-w-0 overflow-y-auto ${onMap ? "absolute inset-0" : "relative flex-1"}`}
        >
          {
}
          <Suspense fallback={<RouteFallback pathname={pathname} />}>
            <KeepAliveOutlet />
          </Suspense>
        </main>
        <UnsavedBar />
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  
  
  useEffect(() => {
    loadLogin();
    loadSignup();
  }, []);

  return (
    <Suspense fallback={<RootFallback />}>
      <Routes>
        <Route element={<AuthShell />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/parcelas" element={<ParcelasPage />} />
          <Route path="/parcelas/historial" element={<ParcelasHistorialPage />} />
          <Route path="/parcelas/:id" element={<ParcelaDetallePage />} />
          <Route path="/modelo" element={<ModeloPage />} />
          <Route path="/mapa" element={<MapaSatelitalPage />} />
          <Route path="/predicciones" element={<PrediccionesPage />} />
          <Route path="/satelite" element={<SatelitePage />} />
          <Route path="/shap" element={<ValidacionSHAPPage />} />
          <Route path="/acerca" element={<AcercaPage />} />
          <Route path="/ejecutar-modelo" element={<Navigate to="/modelo?tab=ejecutar" replace />} />
          <Route path="/ajustes" element={<AjustesPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}