import cebada from "../../assets/cebada.webp";

export default function ParcelEmblem() {
  return (
    // Los márgenes verticales dan el espacio que ocupa la imagen al sobresalir del contenedor
    // (arriba y abajo). Son fijos, así que no dependen de qué tan ancho sea el contenedor.
    <div className="relative my-10 flex h-36 items-center justify-center overflow-visible lg:my-12 lg:h-56">
      {/* Contenedor de acento detrás de la imagen: de todo el ancho; cebada sobresale por los bordes. */}
      <span aria-hidden="true" className="absolute inset-0 z-10 rounded-2xl bg-accent-500" />
      {/* Caja centrada con flex (sin translate): evita posiciones de medio píxel que dejaban una línea.
          object-contain: la imagen se limita por la dimensión que antes se pasaba, así que el
          sobresalido vertical nunca crece aunque el contenedor sea muy ancho. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <img
          src={cebada}
          alt="Cebada"
          draggable={false}
          decoding="async"
          fetchPriority="high"
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitUserDrag: "none", userSelect: "none" }}
          className="pointer-events-auto h-[125%] w-[112%] max-w-none object-contain drop-shadow-[0_26px_4px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out hover:scale-[0.97] dark:drop-shadow-[0_26px_4px_rgba(0,0,0,0.45)]"
        />
      </div>
    </div>
  );
}
