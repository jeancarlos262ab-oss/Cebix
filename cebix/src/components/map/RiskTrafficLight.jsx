import { memo } from "react";
import { RISK_COLORS } from "../../utils/riskColors";

const RISK_LEVELS = [
  { color: RISK_COLORS.green, label: "Rendimiento alto" },
  { color: RISK_COLORS.yellow, label: "Rendimiento medio" },
  { color: RISK_COLORS.red, label: "Rendimiento bajo" },
];

const ROW = "h-6"; 

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