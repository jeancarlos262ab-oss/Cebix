import cebada from "../../assets/cebada.png";

export default function ParcelEmblem() {
  return (
    <div className="relative mb-8 mt-8 flex h-36 items-center justify-center overflow-visible bg-gray-50 dark:bg-gray-800 sm:mb-0 sm:mt-4 sm:h-44 lg:h-56">
      <img
        src={cebada}
        alt="Cebada"
        draggable={false}
        decoding="async"
        fetchPriority="high"
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitUserDrag: "none", userSelect: "none" }}
        className="absolute left-1/2 top-1/2 z-20 h-[125%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 sm:h-auto sm:w-[112%] sm:-translate-y-[58%] drop-shadow-[0_26px_4px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out hover:scale-[0.97] dark:drop-shadow-[0_26px_4px_rgba(0,0,0,0.45)]"
      />
    </div>
  );
}
