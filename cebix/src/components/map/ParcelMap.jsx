import { lazy, memo, Suspense, useCallback, useState } from "react";
import { BlockSkeleton } from "../ui/PageSkeleton";
import { reportGLFailure, resolveMapEngine } from "../../utils/mapDevice";
import { loadParcelMapGL, loadParcelMapLite } from "../../utils/mapLoaders";

const ParcelMapGL = lazy(loadParcelMapGL);
const ParcelMapLite = lazy(loadParcelMapLite);

function MapLoadingFallback({ height, rounded }) {
  return (
    <div className={`app-skeleton w-full ${rounded ? "overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800" : ""}`} style={{ height: typeof height === "number" ? `${height}px` : height }}>
      <BlockSkeleton height="100%" rounded={!!rounded} />
    </div>
  );
}

function ParcelMap(props) {
  
  
  
  
  const [, setGlFailed] = useState(false);
  const handleWebGLError = useCallback(() => {
    reportGLFailure();
    setGlFailed(true);
  }, []);

  const engine = resolveMapEngine();
  const EngineComponent = engine === "lite" ? ParcelMapLite : ParcelMapGL;
  const engineProps = engine === "lite" ? props : { ...props, onWebGLError: handleWebGLError };

  return (
    
    
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