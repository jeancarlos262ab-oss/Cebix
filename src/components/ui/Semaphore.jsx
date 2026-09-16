import { memo } from "react";
import redLight from "../../assets/red.png";
import yellowLight from "../../assets/yellow.png";
import greenLight from "../../assets/green.png";

const LEVELS = [
  {
    key: "red",
    color: "#DC2626",
    image: redLight,
    label: "Alto riesgo",
    range: "0 – 44",
    min: 0,
    max: 44,
    description: "Perfil con indicadores agronómicos y financieros débiles. No se recomienda avanzar sin garantías adicionales.",
    test: (s) => s < 45,
  },
  {
    key: "yellow",
    color: "#D97706",
    image: yellowLight,
    label: "Revisión manual",
    range: "45 – 69",
    min: 45,
    max: 69,
    description: "Zona intermedia: requiere validación de un analista antes de aprobar o rechazar la solicitud.",
    test: (s) => s < 70,
  },
  {
    key: "green",
    color: "#16A34A",
    image: greenLight,
    label: "Elegible",
    range: "70 – 100",
    min: 70,
    max: 100,
    description: "Perfil sólido: cumple los umbrales mínimos de rendimiento y riesgo para ser elegible directamente.",
    test: () => true,
  },
];

/**
 * Semáforo de elegibilidad financiera: muestra la imagen (red.png,
 * yellow.png o green.png) correspondiente al score, con el mismo
 * espaciado de sombra que ParcelEmblem usa para cebada.png. Incluye el
 * desglose de rangos por nivel y una barra de progreso del score.
 *
 * @param {{score: number}} props
 */
function Semaphore({ score }) {
  const active = LEVELS.find((level) => level.test(score)) ?? LEVELS[2];
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-4 shadow-card">
      <div className="flex items-center gap-4">
        <div className="relative flex h-40 shrink-0 items-center justify-center overflow-visible">
          <img
            src={active.image}
            alt={`Semáforo en ${active.label}`}
            draggable={false}
            decoding="async"
            fetchPriority="high"
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitUserDrag: "none", userSelect: "none" }}
            className="h-[115%] w-auto max-w-none -translate-y-8 drop-shadow-[-6px_8px_3px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out hover:scale-[0.97] dark:drop-shadow-[-6px_8px_3px_rgba(0,0,0,0.55)]"
          />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Score de elegibilidad</p>
          <p className="font-sora text-2xl font-bold text-gray-900 dark:text-gray-100">{score} / 100</p>
          <p className="mt-0.5 text-sm font-medium" style={{ color: active.color }}>
            {active.label}
          </p>
        </div>
      </div>

      {/* Barra de progreso con el score sobre los tres rangos */}
      <div className="mt-5">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          {LEVELS.map((level) => (
            <div
              key={level.key}
              className="h-full"
              style={{ width: `${level.max - level.min + 1}%`, backgroundColor: `${level.color}33` }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-2">
          <div
            className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white dark:ring-black"
            style={{ left: `${clamped}%`, backgroundColor: active.color }}
          />
        </div>
      </div>

      {/* Desglose de los tres niveles con su rango y descripción */}
      <div className="-mx-4 mt-3 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
        {LEVELS.map((level) => {
          const isActive = level.key === active.key;
          return (
            <div
              key={level.key}
              className={`flex items-start gap-3 px-4 py-2.5 ${isActive ? "bg-gray-50 dark:bg-gray-900/60" : ""}`}
            >
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: level.color, opacity: isActive ? 1 : 0.35 }}
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p
                    className={`text-sm font-semibold ${isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
                  >
                    {level.label}
                  </p>
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{level.range}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{level.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Semaphore);
