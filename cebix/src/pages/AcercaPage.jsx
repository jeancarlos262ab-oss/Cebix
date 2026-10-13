import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarRange, ChevronRight, CloudRain, GraduationCap, ImageIcon, Landmark, MapPin, Network, Satellite, Sprout } from "lucide-react";
import logoFira from "../assets/acerca/logo-fira.webp";
import TopBar from "../components/layout/TopBar";
import { useParcels } from "../context/ParcelsContext";
import { RISK_COLORS } from "../utils/riskColors";
import { WINDOWS } from "../data/satelite";
import { Card, CHIP, DIVIDE, Fact, Heading, HERO_MASK, LINE, Reveal, useHeroSize } from "../components/ui/PageKit";

/* ───────────── Imágenes ─────────────
 * Cada recuadro busca src/assets/acerca/imagen-N.webp. Si el archivo existe se muestra
 * solo; si no, se ve un recuadro que dice qué foto poner. */
const FILES = import.meta.glob("../assets/acerca/imagen-*.webp", { eager: true, import: "default" });
/* Logo de FIRA sin fondo. Es azul marino, así que en tema oscuro se pasa a blanco para que se lea. */
function FiraLogo({ className = "h-12" }) {
  return <img src={logoFira} alt="FIRA" decoding="async" className={`w-auto dark:brightness-0 dark:invert ${className}`} />;
}

const imageFor = (n) => Object.entries(FILES).find(([path]) => new RegExp(`/imagen-${n}\\.[a-z]+$`).test(path))?.[1];

const SLOTS = {
  1: { title: "Espiga de cebada en el campo", hint: "Foto de día con la espiga bien visible. Es la imagen principal de la pantalla.", size: "1600 × 1200" },
  2: { title: "Productor revisando su cultivo", hint: "Una persona revisando el cultivo. Da rostro a quien recibe el crédito.", size: "1600 × 1000" },
  3: { title: "Cebada recién emergida", hint: "Plántulas o macollos de cebada, cerca del suelo.", size: "1200 × 900" },
  4: { title: "Cebada en encañado", hint: "Tallos alargándose, cultivo verde y alto, aún sin espiga.", size: "1200 × 900" },
  5: { title: "Cebada espigada", hint: "Espigas formadas y grano llenándose, color dorado verdoso.", size: "1200 × 900" },
  6: { title: "Parcelas vistas desde satélite", hint: "Vista cenital de parcelas, o una captura de «Parcela satelital» con su malla.", size: "1600 × 1000" },
  7: { title: "Zona de estudio desde el aire", hint: "Vista aérea o satelital de Hidalgo, Puebla y Tlaxcala.", size: "1200 × 900" },
};

/* Foto con carga suave: mientras llega se ve un fondo que pulsa, y al cargar aparece con un fundido corto.
 * `badge` es una etiqueta de vidrio sobre la foto; `zoom` la acerca un poco al pasar el cursor por su grupo. */
const Photo = memo(function Photo({ src, alt, className, position, eager, badge, zoom }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // Si la imagen ya estaba en caché, onLoad pudo dispararse antes de montar.
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
        className={`absolute inset-0 size-full transform-gpu object-cover transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
          loaded ? `scale-100 opacity-100 ${zoom ? "group-hover:scale-[1.04]" : ""}` : "scale-[1.02] opacity-0"
        }`}
        style={{ objectPosition: position }}
      />
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

/* El color de cada etapa se repite en el calendario y en la tarjeta, para ligar etapa y meses. */
const STAGES = [
  { key: "emergencia", name: "Emergencia", img: 3, from: 1, chip: "bg-ndvi-400 text-ndvi-700", text: "Nace la planta y forma sus primeros hijuelos (macollos). La lluvia de esta etapa es la que más pesa en el rendimiento final." },
  { key: "encanado", name: "Encañado", img: 4, from: 3, chip: "bg-ndvi-600 text-white", text: "El tallo se alarga y se define cuántas espigas podrá sostener la planta." },
  { key: "espigado", name: "Espigado", img: 5, from: 5, chip: "bg-brand-400 text-brand-700", text: "Sale la espiga y se llena el grano: se juega la calidad y el peso de la cosecha." },
];

/* El ancho de cada tramo es proporcional a su rango de puntaje (0–44, 45–69, 70–100). */
const SEMAFORO = [
  { color: RISK_COLORS.red, label: "Alto riesgo", range: "0 – 44", width: 45, text: "El rendimiento esperado no alcanza para respaldar el crédito." },
  { color: RISK_COLORS.yellow, label: "Revisión manual", range: "45 – 69", width: 25, text: "Hay señales mixtas: conviene que un analista la revise." },
  { color: RISK_COLORS.green, label: "Elegible", range: "70 – 100", width: 30, text: "El rendimiento esperado respalda el crédito." },
];

const FLOW = ["Satélite y clima", "Rendimiento estimado", "Puntaje de 0 a 100", "Semáforo"];

const FIRA_POINTS = [
  { icon: Landmark, title: "Qué es", text: "Un conjunto de fideicomisos públicos del Gobierno Federal, operados por el Banco de México, que desde 1954 impulsan el financiamiento del campo y del sector agroalimentario." },
  { icon: Network, title: "Cómo llega al productor", text: "Opera como banca de segundo piso: no presta directamente, sino que fondea y garantiza a bancos y otros intermediarios financieros, que otorgan el crédito." },
  { icon: GraduationCap, title: "Más que crédito", text: "Además del financiamiento y las garantías, ofrece capacitación, asistencia técnica y transferencia de tecnología para que el productor sea sujeto de crédito." },
];

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
  { icon: Landmark, label: "Institución", value: "FIRA · desde 1954" },
];

/* ───────────── Columna derecha (tarjetas con contorno) ───────────── */

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

/* Conteos reales de las parcelas del usuario, con el mismo semáforo que el resto de la app. */
function ParcelsGlance() {
  const { parcels } = useParcels();
  const rows = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    for (const p of parcels) if (p.riskColor in counts) counts[p.riskColor] += 1;
    return [
      { key: "green", label: "Elegibles", color: RISK_COLORS.green },
      { key: "yellow", label: "Revisión manual", color: RISK_COLORS.yellow },
      { key: "red", label: "Alto riesgo", color: RISK_COLORS.red },
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
  useHeroSize(heroRef); // mismo tamaño de foto que Validación SHAP (ver PageKit)

  return (
    <div ref={rootRef} className="relative isolate overflow-x-clip">
      {/* Foto pegada a la esquina superior derecha, detrás del encabezado */}
      <div
        ref={heroRef}
        className="pointer-events-none absolute right-0 top-0 -z-10 h-80 w-full transform-gpu opacity-30 [contain:paint] lg:w-[45%] lg:opacity-100"
        style={HERO_MASK}
      >
        <ImageSlot n={1} eager position="40% 35%" className="size-full" />
      </div>

      <TopBar
        title="Cebada y FIRA"
        subtitle="El cultivo, la institución que lo financia y el problema que resuelve CEBIX."
        hideSearch
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {/* 1 · El cultivo: texto sobre la foto, datos en una fila sin caja */}
          <Reveal className="pb-6 pt-10 lg:pt-16">
            <div className="max-w-xl">
              <Heading title="La cebada en el altiplano" large>
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

          {/* 2 · Etapas del cultivo, con la columna de información a su derecha (sin fijar) */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
            <div className="min-w-0 space-y-6">
          {/* 2 · Etapas: calendario arriba y tres columnas con foto */}
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

          {/* 3 · FIRA: foto a la izquierda, tres puntos en filas */}
          <Reveal>
            <Card
              title={
                <span className="flex items-center gap-4">
                  <FiraLogo className="h-12 sm:h-14" />
                  <span className="text-xs sm:whitespace-nowrap font-normal leading-relaxed text-gray-500 dark:text-gray-400">
                    Fideicomisos Instituidos en Relación con la Agricultura.
                  </span>
                </span>
              }
            >
              <div className="grid lg:grid-cols-12">
                <ImageSlot
                  n={2}
                  zoom
                  position="55% 50%"
                  badge="Desde 1954"
                  className={`h-52 border-b lg:col-span-4 lg:h-auto lg:min-h-full lg:border-b-0 lg:border-r ${LINE}`}
                />
                <div className="flex flex-col lg:col-span-8">
                  <ul className={`flex-1 divide-y ${DIVIDE}`}>
                    {FIRA_POINTS.map(({ icon: Icon, title, text }) => (
                      <li key={title} className="flex items-start gap-4 px-5 py-4">
                        <span className={`${CHIP} mt-0.5`}><Icon size={20} strokeWidth={1.6} /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className={`border-t px-5 py-3 ${LINE}`}>
                    <a
                      href="https://www.fira.gob.mx"
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent-600 dark:text-accent-400"
                    >
                      Sitio oficial de FIRA
                      <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          {/* 4 · El problema: texto y semáforo a la izquierda, foto satelital a la derecha */}
          <Reveal>
            <Card icon={Network} title="Decidir un crédito antes de la cosecha" description="El problema">
              <div className="grid lg:grid-cols-12">
                <div className="flex flex-col lg:col-span-7">
                  <div className="space-y-5 p-5">
                    <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      En una parcela de temporal hay que saber cuánto va a cosechar antes de que ocurra, y casi nunca hay
                      mediciones de campo: visitarlas una por una es lento y caro. CEBIX estima el rendimiento con imágenes de
                      satélite y clima, y lo convierte en un puntaje de 0 a 100 que se lee como semáforo.
                    </p>

                    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
                      {FLOW.map((step, i) => (
                        <li key={step} className="flex items-center gap-1">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{step}</span>
                          {i < FLOW.length - 1 && <ChevronRight size={14} aria-hidden="true" className="text-gray-300 dark:text-gray-600" />}
                        </li>
                      ))}
                    </ol>

                    <div role="img" aria-label="Escala de 0 a 100: alto riesgo hasta 44, revisión manual de 45 a 69, elegible desde 70">
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

          {/* 5 · Los datos */}
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
