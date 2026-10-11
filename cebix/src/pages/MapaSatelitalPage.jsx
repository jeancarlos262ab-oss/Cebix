import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import ParcelMap from "../components/map/ParcelMap";
import ParcelStrip from "../components/map/explorer/ParcelStrip";
import RegionBars from "../components/map/explorer/RegionBars";
import RegionPills from "../components/map/explorer/RegionPills";
import RiskLegend from "../components/map/explorer/RiskLegend";
import ScrollColumn from "../components/map/explorer/ScrollColumn";
import RiskTiles from "../components/map/explorer/RiskTiles";
import SelectedParcelCard from "../components/map/explorer/SelectedParcelCard";
import YieldCard from "../components/map/explorer/YieldCard";
import RequireAnalysis from "../components/ui/RequireAnalysis";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { useSidebar } from "../context/SidebarContext";

// Solo satelital real y oscuro, sin importar el tema de la app.
const BASEMAP_KEYS = ["satellite", "oscuro"];

function MapaSatelitalPageContent() {
  const { parcels } = useParcels();
  const { toggle, collapsed } = useSidebar();
  const mappable = useMemo(() => parcels.filter(hasCoords), [parcels]); // sin lat/lng no se dibuja (no se inventan ubicaciones)
  const [region, setRegion] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  // En escritorio el sidebar flota sobre el mapa (12px de margen + 264px, o 80px contraído).
  // La barra de capas va a 12px de él (42px de ancho) y el resto del contenido a 12px de la barra.
  const pillsLeft = collapsed ? "lg:left-[340px]" : "lg:left-[524px]"; // tras el título (más chico)
  const contentLeft = collapsed ? "lg:left-[108px]" : "lg:left-[292px]";

  const regionOptions = useMemo(() => {
    const counts = new Map();
    for (const p of mappable) counts.set(p.region, (counts.get(p.region) ?? 0) + 1);
    const regions = [...counts].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: key, count }));
    return { regions, pills: [{ key: "all", label: "Todas", count: mappable.length }, ...regions] };
  }, [mappable]);

  const visible = useMemo(
    () => (region === "all" ? mappable : mappable.filter((p) => p.region === region)),
    [mappable, region]
  );
  const selected = useMemo(() => visible.find((p) => p.id === selectedId) ?? null, [visible, selectedId]);

  const riskCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    for (const p of visible) if (p.riskColor in counts) counts[p.riskColor] += 1;
    return counts;
  }, [visible]);

  const scale = useMemo(() => {
    const values = visible.flatMap((p) => [p.yieldEstimate, ...(p.ic90 ?? [])]).filter(Number.isFinite);
    return values.length ? [Math.min(...values), Math.max(...values)] : [0, 1];
  }, [visible]);

  const ranked = useMemo(() => [...visible].sort((a, b) => b.yieldEstimate - a.yieldEstimate), [visible]);

  const handleSelect = useCallback((parcel) => setSelectedId(parcel?.id ?? null), []);
  const clearSelection = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => e.key === "Escape" && clearSelection();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, clearSelection]);

  const hidden = parcels.length - mappable.length;

  return (
    // El mapa ocupa TODA la pantalla, también por detrás del sidebar, que flota
    // encima (ver Sidebar floating), con un degradado oscuro detrás de él.
    <div className="map-flat flex h-full flex-col">
      <div className="relative isolate flex flex-1 flex-col">
        <div className="relative min-h-[420px] flex-1">
          <div className="absolute inset-0">
            <ParcelMap
              parcels={visible}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              showPopup={false}
              showLegend={false}
              height="100%"
              basemap="satellite"
              basemapKeys={BASEMAP_KEYS}
              controlsLeftClassName={`left-3 ${contentLeft}`}
              controlsTopClassName="top-[62px] lg:top-[104px]"
            />
          </div>

          {/* Degradado a la izquierda, DETRÁS del sidebar: oscurece el borde del mapa y se
              desvanece hacia la derecha. Solo escritorio; su ancho sigue al del sidebar. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-0 z-900 hidden transition-[width] duration-200 ease-out lg:block ${
              collapsed ? "w-[390px]" : "w-[650px]"
            }`}
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.7) 20%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0.28) 65%, rgba(0,0,0,0.1) 85%, rgba(0,0,0,0) 100%)",
            }}
          />

          {/* Degradado inferior a todo el ancho de la ventana. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-900 h-[240px]"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 22%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0) 100%)",
            }}
          />

          {/* Menú: solo móvil/tablet (en escritorio el sidebar siempre está visible). */}
          <div className="pointer-events-none absolute left-3 top-3 z-1000 lg:hidden">
            <button
              type="button"
              onClick={toggle}
              aria-label="Abrir menú"
              className="pointer-events-auto flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-black/65 text-gray-200 hover:bg-white/10"
            >
              <Menu size={20} strokeWidth={1.75} />
            </button>
          </div>

          {/* Título sobre el mapa */}
          <div className={`pointer-events-none absolute left-[66px] top-2 z-1000 lg:top-4 ${contentLeft}`}>
            <h1 className="text-xl font-thin leading-none tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.7)] lg:text-[28px]">
              Mapa satelital
            </h1>
            <p className="mt-1.5 text-[11px] text-white/60 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)] lg:text-xs">
              Sentinel-2 · {visible.length} parcela{visible.length === 1 ? "" : "s"}
              {region !== "all" ? ` en ${region}` : ""}
            </p>
          </div>
        </div>

        {/* En celular estos bloques van uno tras otro bajo el mapa, sobre fondo negro. En
            escritorio (lg:contents) cada uno flota sobre el mapa con su propia posición. */}
        <div className="flex flex-col gap-3 bg-black px-4 py-4 lg:contents">
          <div className={`pointer-events-none lg:absolute lg:top-4 lg:z-1000 lg:flex lg:justify-center lg:right-[364px] ${pillsLeft}`}>
            <div className="pointer-events-auto max-w-full">
              <RegionPills options={regionOptions.pills} value={region} onChange={setRegion} />
            </div>
          </div>

          {/* Columna derecha: leyenda, detalle y panel de resumen. Si no caben, se desplaza y las flechas van mostrando el resto. */}
          <ScrollColumn className="lg:absolute lg:bottom-[176px] lg:right-0 lg:top-0 lg:z-1000 lg:w-[352px]">
            <RiskLegend className="shrink-0" />

            {selected && (
              <SelectedParcelCard parcel={selected} scale={scale} onClose={clearSelection} className="shrink-0" />
            )}

            <>
              <RiskTiles counts={riskCounts} />
              <YieldCard parcels={visible} selected={selected} />
              <RegionBars
                regions={regionOptions.regions}
                total={mappable.length}
                value={region}
                onChange={setRegion}
              />
              {hidden > 0 && (
                <p className="px-2 pb-1 text-[11px] leading-relaxed text-white/40">
                  {hidden} parcela{hidden === 1 ? "" : "s"} sin coordenadas no se dibuja{hidden === 1 ? "" : "n"} en el mapa.
                </p>
              )}
            </>
          </ScrollColumn>

          <ParcelStrip
            parcels={ranked}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            className={`min-w-0 lg:absolute lg:bottom-4 lg:right-[96px] lg:z-1000 ${contentLeft}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function MapaSatelitalPage() {
  return (
    <RequireAnalysis title="Mapa satelital" subtitle="Sentinel-2 sobre tus parcelas.">
      <MapaSatelitalPageContent />
    </RequireAnalysis>
  );
}
