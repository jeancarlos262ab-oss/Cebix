import { useState } from "react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import { useParcels } from "../context/ParcelsContext";

export default function MapaSatelitalPage() {
  const { parcels, regionSummary } = useParcels();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      <TopBar
        title="Mapa satelital"
        subtitle="Imagen satelital de Hidalgo, Tlaxcala y Puebla sobre las parcelas evaluadas."
        hideSearch
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      {/* Mapa a todo el ancho y alto disponible; "Regiones cubiertas" vive dentro */}
      <div className="relative min-h-0 flex-1">
        <ParcelMap
          parcels={parcels}
          selectedId={selectedId}
          onSelect={setSelectedId}
          height="100%"
          basemap="satellite"
          bordered={false}
        />

        <section className="absolute bottom-3 left-3 z-[1000] w-64 rounded border border-gray-200 bg-white/90 px-3 py-2.5 text-gray-800 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/70 dark:text-gray-100">
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
