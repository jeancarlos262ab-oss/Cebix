import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarRange, ChevronRight, CloudRain, ImageIcon, MapPin, Network, Satellite, Sprout } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import { useParcels } from "../context/ParcelsContext";
import { RISK_COLORS } from "../utils/riskColors";
import { WINDOWS } from "../data/satelite";
import { Card, CHIP, DIVIDE, Fact, Heading, HERO_MASK, ImageShade, LINE, Reveal, useHeroSize } from "../components/ui/PageKit";

const FILES = import.meta.glob("../assets/acerca/imagen-*.webp", { eager: true, import: "default" });
const imageFor = (n) => Object.entries(FILES).find(([path]) => new RegExp(`/imagen-${n}\\.[a-z]+$`).test(path))?.[1];

const SLOTS = {
  1: { title: "Espiga de cebada en el campo", hint: "Foto de día con la espiga bien visible. Es la imagen principal de la pantalla.", size: "1600 × 1200" },
  3: { title: "Cebada recién emergida", hint: "Plántulas o macollos de cebada, cerca del suelo.", size: "1200 × 900" },
  4: { title: "Cebada en encañado", hint: "Tallos alargándose, cultivo verde y alto, aún sin espiga.", size: "1200 × 900" },
  5: { title: "Cebada espigada", hint: "Espigas formadas y grano llenándose, color dorado verdoso.", size: "1200 × 900" },
  6: { title: "Parcelas vistas desde satélite", hint: "Vista cenital de parcelas, o una captura de 'Parcela satelital' con su malla.", size: "1600 × 1000" },
  7: { title: "Zona de estudio desde el aire", hint: "Vista aérea o satelital de Hidalgo, Puebla y Tlaxcala.", size: "1200 × 900" },
};

const Photo = memo(function Photo({ src, alt, className, position, eager, badge, zoom }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-900 ${zoom ? "group" : ""} ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-gray-200/70 transition-opacity duration-500 dark:bg-gray-800/60 ${loaded ? "opacity-0" : "animate-pulse motion-reduce:animate-none"}`}
      />
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`absolute inset-0 size-full transform-gpu object-cover transition-[opacity,scale] duration-700 ease-out will-change-transform motion-reduce:transition-none ${
          loaded ? `scale-100 opacity-100 ${zoom ? "group-hover:scale-[1.05] motion-reduce:group-hover:scale-100" : ""}` : "scale-[1.02] opacity-0"
        }`}
        style={{ objectPosition: position }}
      />
      <ImageShade />
      {badge && (
        <span
          className={`absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
});

function ImageSlot({ n, className = "", position = "center", eager = false, badge, zoom }) {
  const src = imageFor(n);
  const slot = SLOTS[n];
  if (src) return <Photo src={src} alt={slot.title} className={className} position={position} eager={eager} badge={badge} zoom={zoom} />;
  return (
    <div className={`flex flex-col items-center justify-center gap-2 bg-gray-50 px-6 py-8 text-center dark:bg-gray-900/60 ${className}`}>
      <ImageIcon size={20} strokeWidth={1.5} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Imagen {n}: {slot.title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">{slot.hint}</p>
      <p className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{slot.size} px</p>
    </div>
  );
}

const MONTHS = ["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"];

const STAGES = [
  { key: "emergencia", name: "Emergencia", img: 3, from: 1, chip: "bg-ndvi-400 text-ndvi-700", text: "Nace la planta y forma sus primeros hijuelos (macollos). La lluvia de esta etapa es la que más pesa en el rendimiento final." },
  { key: "encanado", name: "Encañado", img: 4, from: 3, chip: "bg-ndvi-600 text-white", text: "El tallo se alarga y se define cuántas espigas podrá sostener la planta." },
  { key: "espigado", name: "Espigado", img: 5, from: 5, chip: "bg-brand-400 text-brand-700", text: "Sale la espiga y se llena el grano: se juega la calidad y el peso de la cosecha." },
];

const SEMAFORO = [
  { color: RISK_COLORS.red, label: "Rendimiento bajo", range: "0 – 44", width: 45, text: "Es poco probable que alcance el rendimiento de referencia (3.5 t/ha)." },
  { color: RISK_COLORS.yellow, label: "Rendimiento medio", range: "45 – 69", width: 25, text: "Señales mixtas: conviene darle seguimiento durante el ciclo." },
  { color: RISK_COLORS.green, label: "Rendimiento alto", range: "70 – 100", width: 30, text: "Es probable que alcance o supere el rendimiento de referencia." },
];

const FLOW = ["Satélite y clima", "Rendimiento estimado", "Índice de 0 a 100", "Nivel de rendimiento"];

const DATA = [
  { icon: Satellite, name: "Sentinel-2 y Landsat", text: "Imágenes satelitales abiertas: de ellas salen los índices de vegetación (NDVI, EVI, LAI y otros) de cada parcela." },
  { icon: CloudRain, name: "CHIRPS", text: "Lluvia estimada con satélite y estaciones, la variable que más pesa en el modelo." },
  { icon: Sprout, name: "Parcelas con rendimiento real", text: "138 parcelas de Hidalgo, Puebla y Tlaxcala con su cosecha del ciclo abril-octubre 2025, con las que se entrenó y validó el modelo." },
];

const QUICK = [
  { icon: Sprout, label: "Cultivo", value: "Cebada" },
  { icon: MapPin, label: "Zona de estudio", value: "Hidalgo, Puebla y Tlaxcala" },
  { icon: CalendarRange, label: "Ciclo", value: "Abril a octubre" },
  { icon: CloudRain, label: "Manejo", value: "Temporal, sin riego" },
];

const QuickInfo = memo(function QuickInfo() {
  return (
    <Card title="Información rápida">
      <ul className={`divide-y ${DIVIDE}`}>
        {QUICK.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-center gap-3 px-5 py-3">
            <span className={CHIP}><Icon size={20} strokeWidth={1.6} /></span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
});

function ParcelsGlance() {
  const { parcels } = useParcels();
  const rows = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    for (const p of parcels) if (p.riskColor in counts) counts[p.riskColor] += 1;
    return [
      { key: "green", label: "Rendimiento alto", color: RISK_COLORS.green },
      { key: "yellow", label: "Rendimiento medio", color: RISK_COLORS.yellow },
      { key: "red", label: "Rendimiento bajo", color: RISK_COLORS.red },
    ].map((r) => ({ ...r, n: counts[r.key] }));
  }, [parcels]);

  return (
    <Card
      title="Tus parcelas"
      action={
        <Link to="/parcelas" className="group inline-flex items-center gap-1 text-xs font-medium text-accent-600 dark:text-accent-400">
          Ver todas
          <ArrowUpRight size={12} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      }
    >
      <div className="p-5">
        <p className="font-display text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{parcels.length}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">en total</p>
      </div>
      <ul className={`divide-y border-t ${LINE} ${DIVIDE}`}>
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />
            {r.label}
            <span className="ml-auto font-medium tabular-nums text-gray-900 dark:text-gray-100">{r.n}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function AcercaPage() {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  useHeroSize(heroRef); 

  return (
    <div ref={rootRef} className="relative isolate overflow-x-clip">
      {}
      <div
        ref={heroRef}
        className="pointer-events-none absolute right-0 top-0 -z-10 h-80 w-full transform-gpu opacity-30 [contain:paint] lg:w-[45%] lg:opacity-100"
        style={HERO_MASK}
      >
        <ImageSlot n={1} eager position="40% 35%" className="size-full" />
      </div>

      <TopBar
        title="Cebada"
        subtitle="El cultivo y el problema que resuelve CEBIX."
        hideSearch
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {}
          <Reveal className="pb-6 pt-10 lg:pt-16">
            <div className="max-w-xl">
              <Heading title="La cebada en el altiplano" bebas sizeClass="text-3xl sm:text-4xl">
                La cebada es un cereal de clima templado. Una parte importante de la producción nacional se destina a la
                industria de la malta, y Hidalgo, Puebla y Tlaxcala figuran entre las zonas donde más se cultiva. Casi toda
                se siembra de temporal, sin riego: lo que llueve al inicio del ciclo marca gran parte de la cosecha.
              </Heading>
            </div>
            <div className="mt-8 grid max-w-4xl gap-x-10 gap-y-4 sm:grid-cols-[auto_auto_auto] sm:justify-start">
              <Fact icon={CalendarRange} label="Ciclo">Abril a octubre</Fact>
              <Fact icon={MapPin} label="Zona de estudio">Hidalgo, Puebla y Tlaxcala</Fact>
              <Fact icon={CloudRain} label="Manejo">Temporal, sin riego</Fact>
            </div>
          </Reveal>

          {}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
            <div className="min-w-0 space-y-6">
          {}
          <Reveal className="min-w-0">
            <Card
              icon={Sprout}
              title="Etapas del cultivo"
              description="CEBIX resume las imágenes por etapa, porque cada una dice algo distinto de la planta."
            >
              <div className="p-5" aria-hidden="true">
                <div className="grid grid-cols-7 gap-1">
                  {STAGES.map((s, i) => (
                    <span
                      key={s.key}
                      className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold ${s.chip}`}
                      style={{ gridColumn: `${s.from} / span 2` }}
                    >
                      <span className="tabular-nums">{i + 1}</span>
                      <span className="hidden sm:inline">{s.name}</span>
                    </span>
                  ))}
                  <span className="h-8 rounded-full bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="mt-1.5 grid grid-cols-7 text-center text-[11px] text-gray-400 dark:text-gray-500">
                  {MONTHS.map((m) => <span key={m}>{m}</span>)}
                </div>
              </div>
              <ol className={`grid border-t md:grid-cols-3 md:divide-x max-md:divide-y ${LINE} ${DIVIDE}`}>
                {STAGES.map((s, i) => {
                  const w = WINDOWS[s.key];
                  return (
                    <li key={s.key} className="group">
                      <ImageSlot n={s.img} zoom badge={w.range} className="h-40" />
                      <div className={`border-t p-4 ${LINE}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${s.chip}`}>{i + 1}</span>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{w.label}</p>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{s.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </Reveal>

          {}
          <Reveal>
            <Card icon={Network} title="Estimar el rendimiento antes de la cosecha" description="El problema">
              <div className="grid lg:grid-cols-12">
                <div className="flex flex-col lg:col-span-7">
                  <div className="space-y-5 p-5">
                    <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      En una parcela de temporal conviene saber cuánto se va a cosechar antes de que ocurra, y casi nunca hay
                      mediciones de campo: visitarlas una por una es lento y caro. CEBIX estima el rendimiento con la lluvia
                      del inicio del ciclo y lo resume en un índice de 0 a 100 que se lee como semáforo.
                    </p>

                    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
                      {FLOW.map((step, i) => (
                        <li key={step} className="flex items-center gap-1">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{step}</span>
                          {i < FLOW.length - 1 && <ChevronRight size={14} aria-hidden="true" className="text-gray-300 dark:text-gray-600" />}
                        </li>
                      ))}
                    </ol>

                    <div role="img" aria-label="Escala de 0 a 100: rendimiento bajo hasta 44, medio de 45 a 69, alto desde 70">
                      <div className="flex h-2 gap-1">
                        {SEMAFORO.map((s) => (
                          <span key={s.label} className="first:rounded-l-full last:rounded-r-full" style={{ width: `${s.width}%`, background: s.color }} />
                        ))}
                      </div>
                      <div className="mt-1.5 flex gap-1 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                        {SEMAFORO.map((s) => <span key={s.label} style={{ width: `${s.width}%` }}>{s.range}</span>)}
                      </div>
                    </div>
                  </div>

                  <ul className={`grid flex-1 border-t md:grid-cols-3 md:divide-x max-md:divide-y ${LINE} ${DIVIDE}`}>
                    {SEMAFORO.map((s) => (
                      <li key={s.label} className="px-5 py-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <ImageSlot
                  n={6}
                  zoom
                  badge="Parcelas desde satélite"
                  className={`h-52 border-t lg:col-span-5 lg:h-auto lg:min-h-full lg:border-l lg:border-t-0 ${LINE}`}
                />
              </div>
            </Card>
          </Reveal>

          {}
          <Reveal>
            <Card icon={Satellite} title="De dónde salen" description="Los datos">
              <div className="grid md:grid-cols-5">
                <ul className={`divide-y md:col-span-3 ${DIVIDE}`}>
                  {DATA.map(({ icon: Icon, name, text }) => (
                    <li key={name} className="flex items-start gap-4 px-5 py-4">
                      <span className={`${CHIP} mt-0.5`}><Icon size={22} strokeWidth={1.6} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <ImageSlot
                  n={7}
                  zoom
                  badge="138 parcelas · zona de estudio"
                  className={`h-48 border-t md:col-span-2 md:h-auto md:min-h-full md:border-l md:border-t-0 ${LINE}`}
                />
              </div>
            </Card>
          </Reveal>
            </div>
            <aside className="min-w-0 space-y-6">
              <QuickInfo />
              <ParcelsGlance />
            </aside>
          </div>
      </div>
    </div>
  );
}