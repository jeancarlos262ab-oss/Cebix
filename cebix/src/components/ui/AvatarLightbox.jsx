import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Foto de perfil a pantalla grande, al estilo WhatsApp: fondo oscuro, nombre arriba,
 * se cierra con la X, con Esc o tocando fuera de la imagen.
 */
export default function AvatarLightbox({ src, name, onClose }) {
  const [shown, setShown] = useState(false); // para la animación de entrada

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de perfil de ${name || "usuario"}`}
      onClick={onClose}
      className={[
        "fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm transition-opacity duration-200",
        shown ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">{name || "Foto de perfil"}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 pb-12">
        <img
          src={src}
          alt={name || "Foto de perfil"}
          onClick={(e) => e.stopPropagation()}
          className={[
            "aspect-square w-[min(88vw,70vh,560px)] rounded-2xl object-cover shadow-2xl transition-transform duration-200 ease-out",
            shown ? "scale-100" : "scale-75",
          ].join(" ")}
        />
      </div>
    </div>,
    document.body
  );
}
