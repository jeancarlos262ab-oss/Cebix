import { Fragment } from "react";

export default function Digits({ children }) {
  if (typeof children !== "string" && typeof children !== "number") return children;
  const parts = String(children).split(/(\d[\d.,]*)/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-display tabular-nums">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}