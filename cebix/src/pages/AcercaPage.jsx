import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CalendarRange, ChevronRight, CloudRain, GraduationCap, ImageIcon, Landmark, MapPin, Network, Satellite, Sprout } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import { RISK_COLORS } from "../utils/riskColors";
import { WINDOWS } from "../data/satelite";

/* ───────────── Imágenes ─────────────
 * Cada recuadro busca src/assets/acerca/imagen-N.(jpg|jpeg|png|webp|avif). Si el archivo existe se muestra
 * solo; si no, se ve un recuadro que dice qué foto poner. */
const FILES = import.meta.glob("../assets/acerca/*.{jpg,jpeg,png,webp,avif}", { eager: true, import: "default" });
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
function Photo({ src, alt, className, position, eager, badge, zoom }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // Si la imagen ya estaba en caché, onLoad pudo dispararse antes de montar.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-900 ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-gray-200/70 transition-opacity duration-500 dark:bg-gray-800/60 ${loaded ? "opacity-0" : "animate-pulse motion-reduce:animate-none"}`}
      />
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
          loaded ? `scale-100 opacity-100 ${zoom ? "group-hover:scale-[1.04]" : ""}` : "scale-[1.02] opacity-0"
        }`}
        style={{ objectPosition: position }}
      />
      {badge && (
        <span
          className={`absolute bottom-3 left-3 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

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

/* ───────────── Piezas (mismo lenguaje que Modelo y Predicciones) ───────────── */
const SECTION = "overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800";
const LINE = "border-gray-200 dark:border-gray-800";
const DIVIDE = "divide-gray-200 dark:divide-gray-800";
const CHIP = "flex shrink-0 text-accent-600 dark:text-accent-400";

/* Cada sección entra con el mismo fundido corto que usan Predicciones y Auth; solo la primera vez que aparece. */
function Reveal({ children, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

function Heading({ eyebrow, title, large = false, children }) {
  return (
    <div>
      {eyebrow && <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{eyebrow}</p>}
      <h2 className={`mt-1 font-display font-semibold text-gray-900 dark:text-gray-100 ${large ? "text-2xl sm:text-3xl" : "text-xl"}`}>{title}</h2>
      {children && <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-500 dark:text-gray-400">{children}</p>}
    </div>
  );
}

function Kpi({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5">
      <span className={CHIP}><Icon size={22} strokeWidth={1.6} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 font-display text-base font-bold leading-tight text-gray-900 dark:text-white">{children}</p>
      </div>
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

export default function AcercaPage() {
  return (
    <>
      <TopBar
        title="Cebada y FIRA"
        subtitle="El cultivo, la institución que lo financia y el problema que resuelve CEBIX."
        hideSearch
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* 1 · El cultivo: texto y datos clave a la izquierda, foto principal a la derecha */}
        <Reveal className={`grid lg:grid-cols-12 ${SECTION}`}>
          <div className="flex flex-col lg:col-span-7">
            <div className="flex-1 px-6 py-6 lg:px-8 lg:py-7">
              <Heading eyebrow="El cultivo" title="La cebada en el altiplano" large>
                La cebada es un cereal de clima templado. Una parte importante de la producción nacional se destina a la
                industria de la malta, y Hidalgo, Puebla y Tlaxcala figuran entre las zonas donde más se cultiva. Casi toda
                se siembra de temporal, sin riego: lo que llueve al inicio del ciclo marca gran parte de la cosecha.
              </Heading>
            </div>
            <div className={`grid border-t sm:grid-cols-3 sm:divide-x ${LINE} ${DIVIDE} max-sm:divide-y`}>
              <Kpi icon={CalendarRange} label="Ciclo">Abril a octubre</Kpi>
              <Kpi icon={MapPin} label="Zona de estudio">Hidalgo, Puebla y Tlaxcala</Kpi>
              <Kpi icon={CloudRain} label="Manejo">Temporal, sin riego</Kpi>
            </div>
          </div>
          <ImageSlot n={1} eager position="30% 45%" className={`min-h-56 border-t lg:col-span-5 lg:min-h-0 lg:border-l lg:border-t-0 ${LINE}`} />
        </Reveal>

        {/* 2 · Etapas: calendario del ciclo y una foto por etapa */}
        <Reveal className={SECTION}>
          <div className={`grid items-end gap-6 border-b px-6 py-5 lg:grid-cols-12 ${LINE}`}>
            <div className="lg:col-span-5">
              <Heading eyebrow="El ciclo" title="Etapas del cultivo">
                CEBIX resume las imágenes por etapa, porque cada una dice algo distinto de la planta.
              </Heading>
            </div>
            <div className="lg:col-span-7" aria-hidden="true">
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
          </div>
          <ol className={`grid grid-cols-1 divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0 ${DIVIDE}`}>
            {STAGES.map((s, i) => {
              const w = WINDOWS[s.key];
              return (
                <li key={s.key} className="group">
                  <ImageSlot n={s.img} zoom badge={w.range} className={`h-56 border-b ${LINE}`} />
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${s.chip}`}>{i + 1}</span>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{w.label}</p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Reveal>

        {/* 3 · FIRA: foto a la izquierda, tres bloques con ícono a la derecha */}
        <Reveal className={`grid lg:grid-cols-12 ${SECTION}`}>
          <ImageSlot n={2} position="55% 50%" badge="Desde 1954" className={`min-h-64 border-b lg:col-span-4 lg:min-h-full lg:border-b-0 lg:border-r ${LINE}`} />
          <div className="flex flex-col lg:col-span-8">
            <div className="px-6 py-6 lg:px-8 lg:py-8">
              <Heading eyebrow="La institución" title="FIRA" large>
                Fideicomisos Instituidos en Relación con la Agricultura.
              </Heading>
            </div>
            <div className={`grid flex-1 border-t md:grid-cols-3 md:divide-x max-md:divide-y ${LINE} ${DIVIDE}`}>
              {FIRA_POINTS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="px-6 py-5">
                  <span className={CHIP}><Icon size={22} strokeWidth={1.6} /></span>
                  <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{text}</p>
                </div>
              ))}
            </div>
            <a
              href="https://www.fira.gob.mx"
              target="_blank"
              rel="noreferrer"
              className={`group flex items-center justify-between border-t px-6 py-3 text-sm font-medium text-accent-600 transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:bg-gray-50 dark:text-accent-400 dark:hover:bg-gray-800/60 dark:focus-visible:bg-gray-800/60 ${LINE}`}
            >
              Sitio oficial de FIRA
              <ArrowUpRight size={14} className="text-gray-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600" />
            </a>
          </div>
        </Reveal>

        {/* 4 · El problema: recorrido del dato y semáforo a la izquierda, vista satelital a la derecha */}
        <Reveal className={`grid lg:grid-cols-12 ${SECTION}`}>
          <div className="flex flex-col lg:col-span-6">
            <div className="px-6 py-6 lg:px-8 lg:py-8">
              <Heading eyebrow="El problema" title="Decidir un crédito antes de la cosecha">
                En una parcela de temporal hay que saber cuánto va a cosechar antes de que ocurra, y casi nunca hay
                mediciones de campo: visitarlas una por una es lento y caro. CEBIX estima el rendimiento con imágenes de
                satélite y clima, y lo convierte en un puntaje de 0 a 100 que se lee como semáforo.
              </Heading>

              <ol className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2">
                {FLOW.map((step, i) => (
                  <li key={step} className="flex items-center gap-1">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{step}</span>
                    {i < FLOW.length - 1 && <ChevronRight size={14} aria-hidden="true" className="text-gray-300 dark:text-gray-600" />}
                  </li>
                ))}
              </ol>

              <div className="mt-6" role="img" aria-label="Escala de 0 a 100: alto riesgo hasta 44, revisión manual de 45 a 69, elegible desde 70">
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
            <ul className={`flex-1 divide-y border-t ${LINE} ${DIVIDE}`}>
              {[...SEMAFORO].reverse().map((s) => (
                <li key={s.label} className="px-6 py-4 lg:px-8">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    {s.label}
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:text-gray-300"
                      style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)` }}
                    >
                      {s.range}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <ImageSlot n={6} badge="Parcelas desde satélite" className={`min-h-72 border-t lg:col-span-6 lg:min-h-full lg:border-l lg:border-t-0 ${LINE}`} />
        </Reveal>

        {/* 5 · Los datos: fuentes con ícono (como en Modelo) y vista de la zona */}
        <Reveal className={`grid md:grid-cols-5 ${SECTION}`}>
          <div className="md:col-span-3">
            <div className={`border-b px-6 py-5 ${LINE}`}>
              <Heading eyebrow="Los datos" title="De dónde salen" />
            </div>
            <ul className={`divide-y ${DIVIDE}`}>
              {DATA.map(({ icon: Icon, name, text }) => (
                <li key={name} className="flex items-start gap-4 px-6 py-4">
                  <span className={`${CHIP} mt-0.5`}><Icon size={22} strokeWidth={1.6} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ImageSlot n={7} badge="138 parcelas · zona de estudio" className={`min-h-56 border-t md:col-span-2 md:min-h-full md:border-l md:border-t-0 ${LINE}`} />
        </Reveal>
      </div>
    </>
  );
}
