/**
 * ParcelMap — selector automático de motor de mapas.
 *
 * Decide según el equipo cuál motor cargar (sin intervención del usuario):
 *   - ParcelMapGL.jsx   → MapLibre GL (WebGL), si el equipo acepta WebGL.
 *   - ParcelMapLite.jsx → Leaflet, si no hay WebGL (o si MapLibre falla al iniciar).
 *
 * Las páginas siguen importando "../components/map/ParcelMap" sin cambios.
 */
import { lazy, memo, Suspense, useCallback, useState } from "react";
import { reportGLFailure, resolveMapEngine } from "../../utils/mapDevice";

const ParcelMapGL = lazy(() => import("./ParcelMapGL"));
const ParcelMapLite = lazy(() => import("./ParcelMapLite"));

function MapLoadingFallback({ height, rounded }) {
  return (
    <div
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className={`flex w-full items-center justify-center bg-black text-sm text-gray-400 ${rounded ? "rounded-2xl" : ""}`}
    >
      Cargando mapa…
    </div>
  );
}

function ParcelMap(props) {
  // resolveMapEngine() es un singleton: se decide una vez y se reutiliza en
  // todas las pantallas con mapa.
  // Si MapLibre GL no logra iniciar (WebGL no disponible, contexto perdido...), se cambia
  // automáticamente al mapa Leaflet.
  const [, setGlFailed] = useState(false);
  const handleWebGLError = useCallback(() => {
    reportGLFailure();
    setGlFailed(true);
  }, []);

  const engine = resolveMapEngine();
  const EngineComponent = engine === "lite" ? ParcelMapLite : ParcelMapGL;
  const engineProps = engine === "lite" ? props : { ...props, onWebGLError: handleWebGLError };

  return (
    // Si height es un porcentaje ("100%"), el contenedor también debe tenerlo
    // para que el mapa llene el alto disponible de su padre.
    <div
      className="relative w-full"
      style={typeof props.height === "string" ? { height: props.height } : undefined}
    >
      <Suspense fallback={<MapLoadingFallback height={props.height ?? 420} rounded={props.rounded} />}>
        <EngineComponent {...engineProps} />
      </Suspense>
    </div>
  );
}

export default memo(ParcelMap);
