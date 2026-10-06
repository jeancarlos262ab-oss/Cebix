import { memo } from "react";
import redLight from "../../assets/red.webp";
import yellowLight from "../../assets/yellow.webp";
import greenLight from "../../assets/green.webp";

import { RISK_COLORS } from "../../utils/riskColors";

// Convierte un hex "#RRGGBB" a "r, g, b" para poder armar rgba() y
// construir degradados que se pierdan a transparente.
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Degradado de izquierda a derecha que va del color del nivel a
// transparente, para pintar solo el recuadro de ese nivel y perderse
// con el fondo de la tarjeta (sin tocar el resto del contenedor).
function rowGradient(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `linear-gradient(to right, rgba(${rgb}, ${alpha}) 0%, rgba(${rgb}, 0) 100%)`;
}

const LEVELS = [
  {
    key: "red",
    color: RISK_COLORS.red,
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
    color: RISK_COLORS.yellow,
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
    color: RISK_COLORS.green,
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
 * `sober`: variante sin degradados ni colores chillones (usada en Predicciones y Parcela satelital):
 * la imagen sigue sobresaliendo igual, pero la barra y el desglose son planos y de línea fina.
 *
 * `horizontal` (solo con `sober`): contenedor a todo el ancho; imagen y score a la izquierda, barra a la derecha
 * y los tres niveles en columnas. Solo lo usa Parcela satelital.
 *
 * @param {{score: number, sober?: boolean, horizontal?: boolean}} props
 */
function Semaphore({ score, sober = false, horizontal = false }) {
  const active = LEVELS.find((level) => level.test(score)) ?? LEVELS[2];
  const clamped = Math.max(0, Math.min(100, score));

  if (sober && horizontal) {
    return (
      <div className="rounded-lg border border-gray-200 p-5 pb-0 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
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
                className="h-[115%] w-auto max-w-none -translate-y-8 drop-shadow-[-6px_8px_3px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:scale-[0.97]"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Score de elegibilidad</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{score} / 100</p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                <span className="h-2 w-2" style={{ backgroundColor: active.color }} aria-hidden="true" />
                {active.label}
              </p>
            </div>
          </div>

          <div className="relative min-w-[220px] flex-1 py-2">
            <div className="flex h-1.5 gap-px">
              {LEVELS.map((level) => (
                <div
                  key={level.key}
                  style={{
                    flexGrow: level.max - level.min + 1,
                    backgroundColor: level.color,
                    opacity: level.key === active.key ? 1 : 0.28,
                  }}
                />
              ))}
            </div>
            <div className="absolute top-1 h-3.5 w-0.5 bg-gray-900 dark:bg-white" style={{ left: `calc(${clamped}% - 1px)` }} />
          </div>
        </div>

        <ul className="-mx-5 mt-5 grid divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          {LEVELS.map((level) => {
            const isActive = level.key === active.key;
            return (
              <li
                key={level.key}
                className={`flex items-start gap-3 px-5 py-3 max-md:last:rounded-b-lg md:first:rounded-bl-lg md:last:rounded-br-lg ${isActive ? "bg-gray-50 dark:bg-gray-900/60" : ""}`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 ${isActive ? "" : "bg-gray-300 dark:bg-gray-700"}`}
                  style={isActive ? { backgroundColor: level.color } : undefined}
                />
                <div className={`min-w-0 flex-1 ${isActive ? "" : "opacity-55"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{level.label}</p>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{level.range}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{level.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (sober) {
    return (
      <div className="rounded-2xl border border-gray-200 p-5 pb-0 dark:border-gray-800">
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
              className="h-[115%] w-auto max-w-none -translate-y-8 drop-shadow-[-6px_8px_3px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:scale-[0.97]"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Score de elegibilidad</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{score} / 100</p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <span className="h-2 w-2" style={{ backgroundColor: active.color }} aria-hidden="true" />
              {active.label}
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="flex h-1.5 gap-px">
            {LEVELS.map((level) => (
              <div
                key={level.key}
                style={{
                  flexGrow: level.max - level.min + 1,
                  backgroundColor: level.color,
                  opacity: level.key === active.key ? 1 : 0.28,
                }}
              />
            ))}
          </div>
          <div className="absolute -top-1 h-3.5 w-0.5 bg-gray-900 dark:bg-white" style={{ left: `calc(${clamped}% - 1px)` }} />
        </div>

        <ul className="-mx-5 mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70">
          {LEVELS.map((level) => {
            const isActive = level.key === active.key;
            return (
              <li
                key={level.key}
                className={`flex items-start gap-3 px-5 py-3 last:rounded-b-2xl ${isActive ? "bg-gray-50 dark:bg-gray-900/60" : ""}`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 ${isActive ? "" : "bg-gray-300 dark:bg-gray-700"}`}
                  style={isActive ? { backgroundColor: level.color } : undefined}
                />
                <div className={`min-w-0 flex-1 ${isActive ? "" : "opacity-55"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{level.label}</p>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{level.range}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{level.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-4 pb-0 dark:border-gray-800">
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
            className="h-[115%] w-auto max-w-none -translate-y-8 drop-shadow-[-6px_8px_3px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:scale-[0.97]"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Score de elegibilidad</p>
          <p className="font-display text-2xl font-bold text-gray-900 dark:text-gray-100">{score} / 100</p>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: active.color }}>
            {active.label}
          </p>
        </div>
      </div>

      {/* Barra de progreso: la línea completa muestra los tres rangos con
          su propio color (rojo, amarillo, verde) y un indicador marca el
          score actual sobre ella. */}
      <div className="mt-5">
        <div className="relative h-2 w-full overflow-hidden rounded-full">
          <div className="flex h-full w-full">
            {LEVELS.map((level) => (
              <div
                key={level.key}
                style={{ flexGrow: level.max - level.min + 1, backgroundColor: level.color }}
              />
            ))}
          </div>
          {/* Indicador: un palo vertical justo en la posición del score, no un círculo debajo */}
          <div
            className="absolute top-1/2 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-gray-900 dark:ring-white"
            style={{ left: `${clamped}%`, height: "14px" }}
          />
        </div>
      </div>

      {/* Desglose de los tres niveles: solo el recuadro activo lleva el
          degradado de izquierda a derecha (color -> transparente); los
          demás quedan sin fondo y con el punto apagado. */}
      <div className="-mx-4 mt-3">
        {LEVELS.map((level) => {
          const isActive = level.key === active.key;
          return (
            <div
              key={level.key}
              className="flex items-start gap-3 px-4 py-2.5"
              style={isActive ? { background: rowGradient(level.color, 0.16) } : undefined}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? "" : "bg-gray-300 dark:bg-gray-700"}`}
                style={isActive ? { backgroundColor: level.color } : undefined}
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p
                    className={`text-sm font-semibold text-gray-900 dark:text-gray-100 ${isActive ? "" : "opacity-60"}`}
                  >
                    {level.label}
                  </p>
                  <span
                    className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${isActive ? "" : "opacity-60"}`}
                  >
                    {level.range}
                  </span>
                </div>
                <p
                  className={`mt-0.5 text-xs text-gray-600 dark:text-gray-400 ${isActive ? "" : "opacity-60"}`}
                >
                  {level.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Semaphore);
