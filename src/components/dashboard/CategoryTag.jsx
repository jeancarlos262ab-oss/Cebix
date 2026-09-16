import { memo } from "react";
const COLOR_STYLES = {
  green: "bg-green-500 text-white",
  yellow: "bg-amber-500 text-white",
  red: "bg-red-500 text-white",
  gray: "bg-gray-500 text-white",
};

/**
 * Pastilla usada para el semáforo de elegibilidad financiera de una parcela.
 *
 * @param {{label: string, color?: keyof typeof COLOR_STYLES}} props
 */
function CategoryTag({ label, color = "gray" }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 text-xs font-medium",
        COLOR_STYLES[color] ?? COLOR_STYLES.gray,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export default memo(CategoryTag);
