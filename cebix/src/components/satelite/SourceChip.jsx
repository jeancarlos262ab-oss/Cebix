import { SOURCES, WINDOWS } from "../../data/satelite";

/** Etiqueta pequeña de fuente (Sentinel-2 / CHIRPS / escenas) o de ventana fenológica. */
export function SourceChip({ source }) {
  const s = SOURCES[source];
  return (
    <span
      title={s.dataset}
      className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
    >
      {s.label}
    </span>
  );
}

export function WindowChip({ window: key }) {
  const w = WINDOWS[key];
  return (
    <span className="text-xs text-gray-500 dark:text-gray-400">
      {w.label} <span className="text-gray-400 dark:text-gray-500">· {w.range}</span>
    </span>
  );
}
