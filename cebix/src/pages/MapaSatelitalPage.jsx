import { useState } from "react";
import TopBar from "../components/layout/TopBar";
import ParcelMap from "../components/map/ParcelMap";
import { useParcels } from "../context/ParcelsContext";

export default function MapaSatelitalPage() {
  const { parcels, regionSummary } = useParcels();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <>
      <TopBar
        title="Mapa satelital"
        subtitle="Imagen satelital de Hidalgo, Tlaxcala y Puebla sobre las parcelas evaluadas."
        hideSearch
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 px-8 py-6 lg:grid-cols-[240px_1px_1fr] lg:gap-8">
        {/* Rail izquierdo: solo cobertura. Capas, mapa base y leyenda viven dentro del mapa. */}
        <aside className="bg-white dark:bg-black">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Regiones cubiertas</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {parcels.length} parcelas activas con imagen Sentinel-2 procesada en Earth Engine.
          </p>
          <dl className="mt-3 space-y-2.5 text-sm">
            {regionSummary.map((r) => (
              <div key={r.region} className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
                  {r.region}
                </dt>
                <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">
                  {r.parcelCount} parcela{r.parcelCount === 1 ? "" : "s"}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">
            Usa el panel de <span className="font-medium text-gray-700 dark:text-gray-300">Visualización</span> dentro
            del mapa para cambiar de capa, mapa base o mostrar el contorno de los estados.
          </p>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Mapa: capas, mapa base, límites estatales y leyenda se controlan desde adentro */}
        <div>
          <ParcelMap
            parcels={parcels}
            selectedId={selectedId}
            onSelect={setSelectedId}
            height={640}
            basemap="satellite"
          />
        </div>
      </div>
    </>
  );
}
