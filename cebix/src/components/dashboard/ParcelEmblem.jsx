import cebada from "../../assets/cebada.webp";

export default function ParcelEmblem() {
  return (
    
    
    <div className="relative my-10 flex h-36 items-center justify-center overflow-visible lg:my-12 lg:h-56">
      {}
      <span aria-hidden="true" className="absolute inset-0 z-10 rounded-2xl bg-accent-500" />
      {

}
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
          className="pointer-events-auto transform-gpu will-change-transform h-[125%] w-[112%] max-w-none object-contain drop-shadow-[0_26px_4px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out hover:scale-[0.97] dark:drop-shadow-[0_26px_4px_rgba(0,0,0,0.45)]"
        />
      </div>
    </div>
  );
}