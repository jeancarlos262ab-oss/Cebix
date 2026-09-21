import { useState } from "react";
import { Menu } from "lucide-react";
import ParcelMap from "../components/map/ParcelMap";
import { useParcels } from "../context/ParcelsContext";
import { useSidebar } from "../context/SidebarContext";

export default function MapaSatelitalPage() {
  const { parcels, regionSummary } = useParcels();
  const { toggle } = useSidebar();
  const [selectedId, setSelectedId] = useState(null);

  return (
    // Sin TopBar: cualquier encabezado, aunque esté "vacío", reserva su propio
    // alto y deja un espacio muerto arriba del mapa. Al quitarlo, este
    // contenedor pasa a ocupar exactamente el alto disponible (h-full, no
    // min-h-full) y el mapa sí llega a ser de todo lo alto de la pantalla.
    <div className="flex h-full flex-col">
      {/* Mapa a todo el ancho y alto disponible. En pantallas grandes "Regiones
          cubiertas" flota dentro del mapa; en celulares va debajo, sin tapar nada.
          El título vive dentro del mapa, arriba, en vez de en el encabezado. */}
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

          {/* right-[10rem] deja libre la leyenda de arriba a la derecha: si el
              título y la descripción no caben en horizontal, se acomodan en
              varias líneas en vez de encimarse con ella o salirse del mapa. */}
          {/* Mismo espaciado (left-3 / top-3) que usa la barra vertical de
              controles del mapa (esquina superior izquierda) y que "Regiones
              cubiertas" usa abajo. El padding-left dentro de este contenedor
              corre el título justo después de esa barra para que nunca quede
              encimado con ella. */}
          <div className="pointer-events-none absolute left-3 right-[10rem] top-3 z-[1000] flex items-start gap-2 pl-[3.75rem]">
            {/* Botón de menú: solo hace falta en móvil/tablet, donde el
                sidebar vive detrás de un drawer (en escritorio ya está
                siempre visible, así que aquí se oculta con lg:hidden). */}
            <button
              type="button"
              onClick={toggle}
              aria-label="Abrir menú"
              className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-200 bg-white/90 text-gray-500 shadow-lg backdrop-blur hover:bg-gray-50 dark:border-white/10 dark:bg-black/70 dark:text-gray-400 dark:hover:bg-white/10 lg:hidden"
            >
              <Menu size={18} />
            </button>

            <div className="pointer-events-auto min-w-0 max-w-xl rounded bg-white/90 px-3.5 py-2.5 shadow-lg backdrop-blur dark:bg-black/70">
              <h1 className="break-words font-sora text-xl font-bold text-gray-900 dark:text-white">
                Mapa satelital
              </h1>
              <p className="mt-0.5 break-words text-sm text-gray-500 dark:text-gray-400">
                Imagen satelital de Hidalgo, Tlaxcala y Puebla sobre las parcelas evaluadas.
              </p>
            </div>
          </div>
        </div>

        <section className="w-full border-t border-gray-200 bg-white px-4 py-3 text-gray-800 dark:border-gray-800 dark:bg-black dark:text-gray-100 sm:px-6 lg:absolute lg:bottom-3 lg:left-3 lg:z-[1000] lg:w-64 lg:rounded lg:border lg:border-gray-200 lg:bg-white/90 lg:px-3 lg:py-2.5 lg:shadow-lg lg:backdrop-blur lg:dark:border-white/10 lg:dark:bg-black/70">
          <h2 className="text-sm font-semibold">Regiones cubiertas</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {parcels.length} parcelas activas con imagen Sentinel-2 procesada en Earth Engine.
          </p>
          <dl className="mt-2.5 space-y-2 text-xs">
            {regionSummary.map((r) => (
              <div key={r.region} className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
                  {r.region}
                </dt>
                <dd className="font-sora font-bold">
                  {r.parcelCount} parcela{r.parcelCount === 1 ? "" : "s"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
