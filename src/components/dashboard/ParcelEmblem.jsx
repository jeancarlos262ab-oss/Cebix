import cebada from "../../assets/cebada.png";

export default function ParcelEmblem() {
  return (
    <div className="relative mt-4 flex h-56 items-center justify-center overflow-visible bg-gray-50 dark:bg-gray-800">
      <img
        src={cebada}
        alt="Cebada"
        draggable={false}
        decoding="async"
        fetchPriority="high"
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitUserDrag: "none", userSelect: "none" }}
        className="absolute left-1/2 top-1/2 z-20 w-[112%] max-w-none -translate-x-1/2 -translate-y-[58%] drop-shadow-[0_26px_4px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out hover:scale-[0.97] dark:drop-shadow-[0_26px_4px_rgba(0,0,0,0.45)]"
      />
    </div>
  );
}
