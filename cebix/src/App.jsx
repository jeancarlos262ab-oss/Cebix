import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
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
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-accent-500 dark:border-gray-700" />
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden supports-[height:100dvh]:h-dvh bg-white dark:bg-black">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/parcelas" element={<ParcelasPage />} />
          <Route path="/parcelas/:id" element={<ParcelaDetallePage />} />
          <Route path="/modelo" element={<ModeloPage />} />
          <Route path="/mapa" element={<MapaSatelitalPage />} />
          <Route path="/predicciones" element={<PrediccionesPage />} />
          <Route path="/shap" element={<ValidacionSHAPPage />} />
          <Route path="/ajustes" element={<AjustesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
