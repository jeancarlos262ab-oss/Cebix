import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import ParcelMap from "../components/map/ParcelMap";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { useSidebar } from "../context/SidebarContext";
import RequireAnalysis from "../components/ui/RequireAnalysis";

function MapaSatelitalPageContent() {
  const { parcels, regionSummary } = useParcels();
  const { toggle } = useSidebar();
  const mappable = parcels.filter(hasCoords); // sin lat/lng no se dibuja (no se inventan ubicaciones)
  const [selectedId, setSelectedId] = useState(null);

  // En pantalla completa se quitan los degradados de los bordes.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const total = regionSummary.reduce((sum, r) => sum + r.parcelCount, 0);

  return (
    // El mapa ocupa todo el espacio a la derecha del sidebar (arriba, abajo y
    // derecha hasta el borde de la ventana) y nunca pasa por detrás de él.
    <div className="flex h-full flex-col">
      {/* Mapa a todo el ancho y alto disponible. En pantallas grandes "Regiones
          cubiertas" flota dentro del mapa; en celulares va debajo, sin tapar nada.
          Sin título ni encabezado: el mapa ocupa toda la pantalla. */}
      <div className="relative isolate flex flex-1 flex-col">
        <div className="relative min-h-[420px] flex-1">
          <div className="absolute inset-0">
            <ParcelMap
              parcels={mappable}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height="100%"
              basemap="satellite"
              edgeFade={!isFullscreen}
              controlsLeftClassName="left-3"
            />
          </div>

          {/* Botón de menú: solo hace falta en móvil/tablet, donde el
              sidebar vive detrás de un drawer (en escritorio ya está
              siempre visible, así que aquí se oculta con lg:hidden).
              pl-[3.75rem] lo corre después de la barra vertical de capas
              (left-3/top-3, ver ParcelMapGL/ParcelMapLite) para que nunca
              quede encimado con ella. */}
          <div className="pointer-events-none absolute left-3 top-3 z-[1000] pl-[3.75rem] lg:hidden">
            <button
              type="button"
              onClick={toggle}
              aria-label="Abrir menú"
              className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/85 text-gray-400 shadow-lg hover:bg-white/10"
            >
              <Menu size={18} className="text-accent-400" />
            </button>
          </div>
        </div>

        <section
          aria-labelledby="regiones-title"
          className="w-full border-t border-gray-800 bg-black px-4 py-4 text-gray-100 sm:px-6 lg:absolute lg:bottom-3 lg:left-3 lg:z-[1000] lg:w-72 lg:rounded-2xl lg:border lg:border-white/10 lg:bg-black/85 lg:p-4 lg:shadow-lg"
        >
          <h2 id="regiones-title" className="font-display text-sm font-semibold">
            Regiones cubiertas
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            {parcels.length} parcelas activas con imagen Sentinel-2 procesada en Earth Engine.
          </p>

          <dl className="mt-4 space-y-3 pt-4 text-xs">
            {regionSummary.map((r) => {
              const share = total ? (r.parcelCount / total) * 100 : 0;
              return (
                <div key={r.region}>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-gray-200">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
                      {r.region}
                    </dt>
                    <dd className="font-display text-sm font-bold tabular-nums">
                      {r.parcelCount}
                      <span className="ml-1 text-[11px] font-medium text-gray-500">
                        parcela{r.parcelCount === 1 ? "" : "s"}
                      </span>
                    </dd>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div className="h-full" style={{ width: `${share}%`, backgroundColor: r.color }} />
                  </div>
                </div>
              );
            })}
          </dl>
        </section>
      </div>
    </div>
  );
}

export default function MapaSatelitalPage() {
  return (
    <RequireAnalysis >
      <MapaSatelitalPageContent />
    </RequireAnalysis>
  );
}
