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
import { BlockSkeleton } from "../ui/PageSkeleton";
import { reportGLFailure, resolveMapEngine } from "../../utils/mapDevice";
import { loadParcelMapGL, loadParcelMapLite } from "../../utils/mapLoaders";

const ParcelMapGL = lazy(loadParcelMapGL);
const ParcelMapLite = lazy(loadParcelMapLite);

function MapLoadingFallback({ height, rounded }) {
  return (
    <div className="app-skeleton w-full" style={{ height: typeof height === "number" ? `${height}px` : height }}>
      <BlockSkeleton height="100%" rounded={!!rounded} />
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
