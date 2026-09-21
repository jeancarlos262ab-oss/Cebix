/**
 * ParcelMap — selector automático de motor de mapas.
 *
 * Decide según el equipo cuál motor cargar (sin intervención del usuario):
 *   - ParcelMapGL.jsx   → MapLibre GL (WebGL), equipos con GPU decente.
 *   - ParcelMapLite.jsx → Leaflet, equipos de bajos recursos.
 *
 * Las páginas siguen importando "../components/map/ParcelMap" sin cambios.
 */
import { lazy, memo, Suspense } from "react";
import { resolveMapEngine } from "../../utils/mapDevice";

const ParcelMapGL = lazy(() => import("./ParcelMapGL"));
const ParcelMapLite = lazy(() => import("./ParcelMapLite"));

function MapLoadingFallback({ height }) {
  return (
    <div
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      className="flex w-full items-center justify-center border border-gray-200 bg-gray-50 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900"
    >
      Cargando mapa…
    </div>
  );
}

function ParcelMap(props) {
  // resolveMapEngine() es un singleton: se decide una vez y se reutiliza en
  // todas las pantallas con mapa.
  const EngineComponent = resolveMapEngine() === "lite" ? ParcelMapLite : ParcelMapGL;

  return (
    // Si height es un porcentaje ("100%"), el contenedor también debe tenerlo
    // para que el mapa llene el alto disponible de su padre.
    <div
      className="relative w-full"
      style={typeof props.height === "string" ? { height: props.height } : undefined}
    >
      <Suspense fallback={<MapLoadingFallback height={props.height ?? 420} />}>
        <EngineComponent {...props} />
      </Suspense>
    </div>
  );
}

export default memo(ParcelMap);
