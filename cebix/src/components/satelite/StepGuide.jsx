import { Check } from "lucide-react";
import { PANEL } from "./mapUi";

/**
 * Guía de pasos de la pantalla de parcela satelital (píldora inferior del mapa).
 * Muestra el recorrido completo y en cuál va la persona, más una línea con lo que toca hacer ahora.
 *
 * @param {{
 *   steps: string[],
 *   current: number,   // índice del paso activo; -1 = ninguno resaltado; steps.length = todos hechos
 *   hint: React.ReactNode,
 *   tone?: "default" | "busy" | "error",
 * }} props
 */
export default function StepGuide({ steps, current, hint, tone = "default" }) {
  return (
    <div className={`${PANEL} inline-flex max-w-full flex-col gap-1.5 px-3 py-2`}>
      <ol aria-label="Pasos" className="flex items-center gap-1.5">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-1.5" aria-current={active ? "step" : undefined}>
              {i > 0 && <span aria-hidden="true" className={`h-px w-3 sm:w-5 ${done || active ? "bg-white/60" : "bg-white/15"}`} />}
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors duration-200 ${
                  active
                    ? "border-white bg-white text-gray-900"
                    : done
                      ? "border-white/50 text-white"
                      : "border-white/20 text-gray-500"
                }`}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-[11px] font-medium leading-none ${active ? "text-white" : done ? "text-gray-300" : "hidden text-gray-500 sm:inline"}`}
              >
                {label}
                <span className="sr-only">{done ? " (hecho)" : active ? " (paso actual)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p
        role="status"
        className={`text-xs leading-snug ${tone === "error" ? "text-red-300" : tone === "busy" ? "text-gray-200" : "text-gray-400"}`}
      >
        {hint}
      </p>
    </div>
  );
}
