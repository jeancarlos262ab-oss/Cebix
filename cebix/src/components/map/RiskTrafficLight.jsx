import { memo } from "react";
import { RISK_COLORS } from "../../utils/riskColors";

// Orden de arriba hacia abajo: el texto de cada fila queda alineado con su luz.
const RISK_LEVELS = [
  { color: RISK_COLORS.green, label: "Elegible" },
  { color: RISK_COLORS.yellow, label: "Revisión manual" },
  { color: RISK_COLORS.red, label: "Alto riesgo" },
];

const ROW = "h-6"; // misma altura en texto y luces para que se alineen

/**
 * Leyenda de elegibilidad minimalista: el texto flota directo sobre el mapa y
 * las tres luces van en una caja rectangular (sin bordes ni brillo).
 */
function RiskTrafficLight() {
  return (
    <div className="flex items-stretch gap-2.5">
      <ul className="flex flex-col py-1.5">
        {RISK_LEVELS.map((item) => (
          <li
            key={item.label}
            className={`flex ${ROW} items-center justify-end text-xs font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]`}
          >
            {item.label}
          </li>
        ))}
      </ul>

      <div className="flex shrink-0 flex-col rounded-md bg-black px-1.5 py-2" aria-hidden="true">
        {RISK_LEVELS.map((item) => (
          <span key={item.label} className={`flex ${ROW} items-center justify-center`}>
            <span className="h-3 w-3 rounded-xs" style={{ backgroundColor: item.color }} />
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(RiskTrafficLight);
