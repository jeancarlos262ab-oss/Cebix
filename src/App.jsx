import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";

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
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));
const AjustesPage = lazy(() => import("./pages/AjustesPage"));

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-accent-500 dark:border-gray-700" />
    </div>
  );
}

export default function App() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-black">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/parcelas" element={<ParcelasPage />} />
            <Route path="/parcelas/:id" element={<ParcelaDetallePage />} />
            <Route path="/modelo" element={<ModeloPage />} />
            <Route path="/mapa" element={<MapaSatelitalPage />} />
            <Route path="/predicciones" element={<PrediccionesPage />} />
            <Route path="/shap" element={<ValidacionSHAPPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/ajustes" element={<AjustesPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
