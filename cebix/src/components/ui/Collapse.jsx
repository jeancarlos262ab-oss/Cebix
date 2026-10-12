import { useEffect, useRef, useState } from "react";

const DURATION = 300;

/**
 * Desliza su contenido al aparecer o desaparecer (altura 0 ↔ natural, sin medir nada con JS).
 * Como la altura cambia cuadro a cuadro, lo que está alrededor (p. ej. el mapa, que se estira con el panel) la sigue.
 */
export function Collapse({ open, children, className = "" }) {
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      } ${className}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * Lista cuyos elementos se deslizan al entrar y al salir. `items` = [{ key, ...datos }]; `render(item)` pinta uno.
 * Los que ya no están siguen montados lo que dura la animación de salida.
 */
export function SlideList({ items, render, gap = "pt-2" }) {
  const [rows, setRows] = useState(() => items.map((item) => ({ item, open: true })));
  const first = useRef(true);
  const latest = useRef(items);
  latest.current = items;
  const sig = items.map((i) => i.key).join("\n"); // el efecto solo corre cuando cambia el conjunto de elementos

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const current = latest.current;
    const keys = new Set(current.map((i) => i.key));
    // Nuevos: se montan cerrados y se abren en el cuadro siguiente. Quitados: se cierran y se retiran al terminar.
    setRows((prev) => {
      const known = new Map(prev.map((r) => [r.item.key, r]));
      const next = current.map((item) => ({ item, open: known.has(item.key) ? known.get(item.key).open || false : false }));
      prev.forEach((r) => {
        if (!keys.has(r.item.key)) next.push({ item: r.item, open: false });
      });
      return next;
    });
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setRows((prev) => prev.map((r) => (keys.has(r.item.key) ? { ...r, open: true } : r)))),
    );
    const t = setTimeout(() => setRows((prev) => prev.filter((r) => keys.has(r.item.key))), DURATION + 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [sig]);

  return rows.map(({ item, open }) => (
    <Collapse key={item.key} open={open}>
      <div className={gap}>{render(item)}</div>
    </Collapse>
  ));
}
