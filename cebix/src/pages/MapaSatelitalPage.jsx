import { useState } from "react";
import { Menu } from "lucide-react";
import ParcelMap from "../components/map/ParcelMap";
import { useParcels } from "../context/ParcelsContext";
import { useSidebar } from "../context/SidebarContext";

export default function MapaSatelitalPage() {
  const { parcels, regionSummary } = useParcels();
  const { toggle } = useSidebar();
  const [selectedId, setSelectedId] = useState(null);
  const total = regionSummary.reduce((sum, r) => sum + r.parcelCount, 0);

  return (
    // Sin TopBar: cualquier encabezado, aunque esté "vacío", reserva su propio
    // alto y deja un espacio muerto arriba del mapa. Al quitarlo, este
    // contenedor pasa a ocupar exactamente el alto disponible (h-full, no
    // min-h-full) y el mapa sí llega a ser de todo lo alto de la pantalla.
    <div className="flex h-full flex-col">
      {/* Mapa a todo el ancho y alto disponible. En pantallas grandes "Regiones
          cubiertas" flota dentro del mapa; en celulares va debajo, sin tapar nada.
          Sin título ni encabezado: el mapa ocupa toda la pantalla. */}
      <div className="relative isolate flex flex-1 flex-col">
        <div className="relative min-h-[420px] flex-1">
          <div className="absolute inset-0">
            <ParcelMap
              parcels={parcels}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height="100%"
              basemap="satellite"
              bordered={false}
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
              className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-200 bg-white/90 text-gray-500 shadow-lg backdrop-blur hover:bg-gray-50 dark:border-white/10 dark:bg-black/70 dark:text-gray-400 dark:hover:bg-white/10"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        <section
          aria-labelledby="regiones-title"
          className="w-full border-t border-gray-200 bg-white px-4 py-4 text-gray-800 dark:border-gray-800 dark:bg-black dark:text-gray-100 sm:px-6 lg:absolute lg:bottom-3 lg:left-3 lg:z-[1000] lg:w-72 lg:rounded lg:border lg:border-gray-200 lg:bg-white/90 lg:p-4 lg:shadow-lg lg:backdrop-blur lg:dark:border-white/10 lg:dark:bg-black/70"
        >
          <h2 id="regiones-title" className="text-sm font-semibold">
            Regiones cubiertas
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {parcels.length} parcelas activas con imagen Sentinel-2 procesada en Earth Engine.
          </p>

          <dl className="mt-4 space-y-3 border-t border-gray-200 pt-4 text-xs dark:border-white/10">
            {regionSummary.map((r) => {
              const share = total ? (r.parcelCount / total) * 100 : 0;
              return (
                <div key={r.region}>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
                      {r.region}
                    </dt>
                    <dd className="font-sora text-sm font-bold tabular-nums">
                      {r.parcelCount}
                      <span className="ml-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        parcela{r.parcelCount === 1 ? "" : "s"}
                      </span>
                    </dd>
                  </div>
                  <div className="mt-1.5 h-1 w-full bg-gray-200 dark:bg-white/10" aria-hidden="true">
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