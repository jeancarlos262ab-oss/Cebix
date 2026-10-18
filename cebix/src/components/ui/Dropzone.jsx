import { useState } from "react";

export default function Dropzone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  busy = false,
  active = false,
  className = "",
  children,
}) {
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || busy;

  const state = blocked
    ? "cursor-progress opacity-70"
    : dragging
    ? "border-accent-500"
    : active
    ? "border-accent-500"
    : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900";

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!blocked) onFiles(Array.from(e.dataTransfer.files ?? []));
      }}
      className={[
        "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors focus-within:border-accent-500 *:pointer-events-none",
        state,
        className,
      ].join(" ")}
    >
      {typeof children === "function" ? children({ dragging }) : children}
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={blocked}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}