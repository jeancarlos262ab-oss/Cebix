import { memo } from "react";
const COLOR_STYLES = {
  green: "text-ndvi-600 dark:text-ndvi-400",
  yellow: "text-brand-600 dark:text-brand-400",
  red: "text-red-600 dark:text-red-400",
  gray: "text-gray-700 dark:text-gray-400",
};

function CategoryTag({ label, color = "gray" }) {
  return (
    <span className={["text-sm font-medium", COLOR_STYLES[color] ?? COLOR_STYLES.gray].join(" ")}>
      {label}
    </span>
  );
}

export default memo(CategoryTag);