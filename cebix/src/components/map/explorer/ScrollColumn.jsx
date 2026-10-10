import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const ARROW =
  "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/80 backdrop-blur-xl transition-colors hover:bg-black/90 hover:text-white";

/**
 * Columna con scroll vertical y flechas arriba/abajo para ir mostrando el contenido.
 * Las flechas solo aparecen en escritorio y solo cuando hay más contenido en esa dirección.
 * `className` posiciona/dimensiona el contenedor; en celular fluye normal.
 */
export default function ScrollColumn({ className = "", children }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ up: false, down: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ up: el.scrollTop > 4, down: el.scrollTop + el.clientHeight < el.scrollHeight - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [update, children]);

  const go = (dir) => ref.current?.scrollBy({ top: dir * ref.current.clientHeight * 0.7, behavior: "smooth" });

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        onScroll={update}
        // Difuminado solo del lado donde aún hay contenido: arriba si ya se desplazó, abajo si falta por ver.
        style={{ "--fade-top": edges.up ? "36px" : "0px", "--fade-bottom": edges.down ? "36px" : "0px" }}
        className="scroll-fade flex h-full flex-col gap-3 [&>*]:shrink-0 lg:overflow-y-auto lg:px-3 lg:py-4 scrollbar-none"
      >
        {children}
      </div>
      {edges.up && (
        <div className="pointer-events-none absolute inset-x-0 top-1 hidden justify-center lg:flex">
          <button type="button" onClick={() => go(-1)} aria-label="Ver contenido anterior" className={ARROW}>
            <ChevronUp size={16} />
          </button>
        </div>
      )}
      {edges.down && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 hidden justify-center lg:flex">
          <button type="button" onClick={() => go(1)} aria-label="Ver más contenido" className={ARROW}>
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
