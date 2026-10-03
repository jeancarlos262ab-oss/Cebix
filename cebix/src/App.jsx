import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useRef } from "react";
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
import { SidebarProvider } from "./context/SidebarContext";
import { getPageRegistry } from "./utils/pageRegistry";
import { PageActiveContext } from "./context/PageActiveContext";

// Cada página se separa en su propio chunk: el navegador solo descarga (y
// cachea) el código de la pantalla que se visita, en vez de todo el bundle
// de una sola vez.
const pageLoaders = {
  dashboard: () => import("./pages/DashboardPage"),
  parcelas: () => import("./pages/ParcelasPage"),
  parcelaDetalle: () => import("./pages/ParcelaDetallePage"),
  parcelasHistorial: () => import("./pages/ParcelasHistorialPage"),
  modelo: () => import("./pages/ModeloPage"),
  mapa: () => import("./pages/MapaSatelitalPage"),
  predicciones: () => import("./pages/PrediccionesPage"),
  shap: () => import("./pages/ValidacionSHAPPage"),
  ajustes: () => import("./pages/AjustesPage"),
  perfil: () => import("./pages/PerfilPage"),
};

const DashboardPage = lazy(pageLoaders.dashboard);
const ParcelasPage = lazy(pageLoaders.parcelas);
const ParcelaDetallePage = lazy(pageLoaders.parcelaDetalle);
const ParcelasHistorialPage = lazy(pageLoaders.parcelasHistorial);
const ModeloPage = lazy(pageLoaders.modelo);
const MapaSatelitalPage = lazy(pageLoaders.mapa);
const PrediccionesPage = lazy(pageLoaders.predicciones);
const ValidacionSHAPPage = lazy(pageLoaders.shap);
const AjustesPage = lazy(pageLoaders.ajustes);
const PerfilPage = lazy(pageLoaders.perfil);
const loadLogin = () => import("./pages/LoginPage");
const loadSignup = () => import("./pages/SignupPage");
const LoginPage = lazy(loadLogin);
const SignupPage = lazy(loadSignup);

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-accent-500 dark:border-gray-700" />
    </div>
  );
}

// Con la sesión iniciada, descarga el resto de pantallas cuando el navegador
// está ocioso (una a una, sin competir con la pantalla actual). Así al navegar
// el chunk ya está en caché y el cambio es instantáneo. El mapa (MapLibre,
// el más pesado) queda al final.
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
      pageLoaders.mapa,
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


// ── Keep-alive de pantallas ─────────────────────────────────────────────────
// Cada pantalla visitada se queda MONTADA (solo se oculta con display:none).
// Al volver se muestra exactamente como se dejó: estado local, filtros,
// pestañas, formularios, mapa (zoom/capas/selección) y scroll.
// Se vacía sola al cerrar sesión (AuthenticatedLayout se desmonta).

// pathname → clave de caché. Las rutas que solo redirigen (/ejecutar-modelo,
// "*") devuelven null y no se cachean.
function pageKey(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (["/", "/parcelas", "/parcelas/historial", "/modelo", "/mapa", "/predicciones", "/shap", "/ajustes", "/perfil"].includes(path)) {
    return path;
  }
  // (/parcelas/historial es una ruta fija: se evalúa antes que el detalle por id.)
  // Todas las parcelas comparten un solo slot de detalle (evita acumular un
  // mapa por cada parcela abierta).
  if (/^\/parcelas\/[^/]+$/.test(path)) return "/parcelas/:id";
  return null;
}

function KeepAliveOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigationType = useContext(LocationContext).navigationType;
  const key = pageKey(location.pathname);

  // Singleton compartido: una sola instancia por pantalla para toda la app.
  const registry = getPageRegistry();
  const entriesRef = { current: registry.entries };
  const scrollRef = { current: registry.scroll };
  const searchRef = { current: registry.search };
  const activeKeyRef = registry.active;

  // La pantalla activa siempre guarda su versión más reciente; las demás
  // conservan la última que tuvieron (React no las vuelve a renderizar).
  if (key) entriesRef.current.set(key, { outlet, location, navigationType });

  // Guarda el scroll de la pantalla activa (el <main> es compartido).
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
    // Al llegar de otra pantalla se restaura su scroll ANTES de pintar.
    if (activeKeyRef.key !== key) {
      activeKeyRef.key = key;
      const el = document.getElementById("app-scroll");
      if (el) el.scrollTop = scrollRef.current.get(key) ?? 0;
    }
    // El Sidebar usa esto para volver a /modelo?tab=... tal como estaba.
    searchRef.current.set(key, location.search);
  });

  return (
    <>
      {[...entriesRef.current].map(([k, entry]) => (
        // En rutas de redirección (key null) se deja visible la pantalla
        // anterior para no parpadear en blanco.
        <PageSlot key={k} active={k === (key ?? activeKeyRef.key)} entry={entry} />
      ))}
      {/* Rutas de redirección (no cacheadas). */}
      {!key && outlet}
    </>
  );
}

// La pantalla activa usa `display: contents` (el wrapper no existe visualmente,
// el layout es idéntico al de antes). Las ocultas NO usan display:none: eso les
// quitaba su tamaño y al volver mapas y gráficas se redimensionaban y
// parpadeaban. Se quedan con el mismo tamaño que el <main>, apiladas encima e
// invisibles (visibility:hidden), así que al mostrarse no cambia nada.
// La ubicación se "congela" en las ocultas: useSearchParams/useParams de una
// pantalla en segundo plano no cambian cuando navegas a otra.
const HIDDEN_STYLE = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  visibility: "hidden",
  pointerEvents: "none",
  // El navegador omite por completo layout y pintado de la pantalla oculta
  // (conservando su estado): no resta fluidez al scroll ni a las animaciones.
  contentVisibility: "hidden",
};

function PageSlot({ active, entry }) {
  const frozen = useRef(null);
  if (active || !frozen.current) {
    frozen.current = { location: entry.location, navigationType: entry.navigationType };
  }
  return (
    <div style={active ? { display: "contents" } : HIDDEN_STYLE} aria-hidden={active ? undefined : true}>
      {/* Suspense por pantalla: al cargar por primera vez una página, las
          demás (ya montadas) no se tocan. */}
      <Suspense fallback={<RouteFallback />}>
        <PageActiveContext.Provider value={active}>
          <LocationContext.Provider value={frozen.current}>{entry.outlet}</LocationContext.Provider>
        </PageActiveContext.Provider>
      </Suspense>
    </div>
  );
}

function AuthenticatedLayout() {
  usePrefetchPages();
  // En el mapa satelital se oculta el degradado de la esquina superior izquierda.
  const onMap = useLocation().pathname === "/mapa";

  return (
    <SidebarProvider>
      <div className="relative isolate flex h-screen w-full overflow-hidden supports-[height:100dvh]:h-dvh bg-white dark:bg-black">
        {/* Degradado fijo de la esquina superior izquierda: va detrás del panel y de todas las pantallas. */}
        <div className={`app-corner-glow pointer-events-none absolute inset-0 -z-10 ${onMap ? "hidden" : ""}`} aria-hidden="true" />
        <Sidebar />

        <main
          id="app-scroll"
          className="relative min-w-0 flex-1 overflow-y-auto"
        >
          {/* Suspense propio: al abrir una pantalla por primera vez solo cambia el
              contenido; el sidebar ya no desaparece detrás del spinner global. */}
          <Suspense fallback={<RouteFallback />}>
            <KeepAliveOutlet />
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  // Login y Signup comparten marco: precargamos ambas para que el cambio de
  // pestaña sea instantáneo y no deje un hueco mientras baja el chunk.
  useEffect(() => {
    loadLogin();
    loadSignup();
  }, []);

  return (
    <Suspense fallback={<RouteFallback />}>
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
          <Route path="/shap" element={<ValidacionSHAPPage />} />
          <Route path="/ejecutar-modelo" element={<Navigate to="/modelo?tab=ejecutar" replace />} />
          <Route path="/ajustes" element={<AjustesPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
