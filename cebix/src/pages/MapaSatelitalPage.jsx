import { useState } from "react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import { useParcels } from "../context/ParcelsContext";

export default function MapaSatelitalPage() {
  const { parcels, regionSummary } = useParcels();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        title="Mapa satelital"
        subtitle="Imagen satelital de Hidalgo, Tlaxcala y Puebla sobre las parcelas evaluadas."
        hideSearch
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      {/* Mapa a todo el ancho y alto disponible. En pantallas grandes "Regiones
          cubiertas" flota dentro del mapa; en celulares va debajo, sin tapar nada. */}
      <div className="relative flex flex-1 flex-col">
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
