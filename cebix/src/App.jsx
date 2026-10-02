import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AuthShell from "./components/auth/AuthShell";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Sidebar from "./components/layout/Sidebar";
import { SidebarProvider } from "./context/SidebarContext";

// Cada página se separa en su propio chunk: el navegador solo descarga (y
// cachea) el código de la pantalla que se visita, en vez de todo el bundle
// de una sola vez.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ParcelasPage = lazy(() => import("./pages/ParcelasPage"));
const ParcelaDetallePage = lazy(() => import("./pages/ParcelaDetallePage"));
const ModeloPage = lazy(() => import("./pages/ModeloPage"));
const MapaSatelitalPage = lazy(() => import("./pages/MapaSatelitalPage"));
const PrediccionesPage = lazy(() => import("./pages/PrediccionesPage"));
const ValidacionSHAPPage = lazy(() => import("./pages/ValidacionSHAPPage"));
const AjustesPage = lazy(() => import("./pages/AjustesPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
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

function AuthenticatedLayout() {
  // En el mapa satelital el contenido ocupa toda la pantalla, también detrás
  // del sidebar (que sigue al frente por su z-index).
  const fullBleed = useLocation().pathname === "/mapa";

  return (
    <SidebarProvider>
      <div className="relative isolate flex h-screen w-full overflow-hidden supports-[height:100dvh]:h-dvh bg-white dark:bg-black">
        {/* Degradado fijo de la esquina superior izquierda: va detrás del panel y de todas las pantallas. */}
        <div className="app-corner-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <Sidebar />

        <main
          id="app-scroll"
          className={fullBleed ? "absolute inset-0 overflow-hidden" : "min-w-0 flex-1 overflow-y-auto"}
        >
          <Outlet />
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
