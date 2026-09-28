/**
 * LiquidOrbLoader — Versión Rediseñada
 * 
 * Incluye soporte para modo oscuro, reflejo especular tipo cristal,
 * animaciones fluidas optimizadas para GPU y un halo ambiental al activarse.
 */
export default function LiquidOrbLoader({ size = 320, running = false, label }) {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        className={`liquid-orb relative shrink-0 overflow-hidden rounded-full transition-all duration-700 ${
          running ? "liquid-orb--active" : ""
        }`}
        style={{
          width: size,
          maxWidth: "100%",
          aspectRatio: "1 / 1",
          "--orb-size": `${size}px`,
          "--orb-speed": running ? 1.8 : 1,
        }}
        role="status"
        aria-label={label || (running ? "Ejecutando modelo" : "En espera")}
      >
        {/* Blobs líquidos internos */}
        <span className="liquid-orb__blob liquid-orb__blob--a" />
        <span className="liquid-orb__blob liquid-orb__blob--b" />
        <span className="liquid-orb__blob liquid-orb__blob--c" />
        
        {/* Reflejo especular superior (Efecto cristal) */}
        <div className="liquid-orb__specular" />

        {/* Anillo de borde y profundidad */}
        <div className="liquid-orb__ring" />
      </div>

      {label && (
        <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">
          {label}
        </p>
      )}

      <style>{`
        .liquid-orb {
          background: linear-gradient(145deg, #f3f4f6 0%, #e5e7eb 100%);
          box-shadow: 
            0 10px 25px -5px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(0, 0, 0, 0.04) inset;
          transform: scale(1);
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease;
        }

        /* Soporte para modo oscuro en Tailwind (asumiendo clase .dark en el HTML/Body) */
        :global(.dark) .liquid-orb,
        .dark .liquid-orb {
          background: linear-gradient(145deg, #111827 0%, #030712 100%);
          box-shadow: 
            0 15px 30px -5px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        }

        .liquid-orb--active {
          transform: scale(1.04);
          box-shadow: 
            0 20px 40px -10px var(--accent-500, rgba(192, 138, 46, 0.25)),
            0 0 0 1px var(--accent-500, rgba(192, 138, 46, 0.4)) inset;
        }

        .liquid-orb__blob {
          position: absolute;
          inset: -25%;
          border-radius: 999px;
          filter: blur(calc(var(--orb-size, 320px) * 0.1));
          opacity: 0.85;
          will-change: transform;
          mix-blend-mode: multiply;
        }

        :global(.dark) .liquid-orb__blob,
        .dark .liquid-orb__blob {
          mix-blend-mode: screen;
          opacity: 0.75;
        }

        .liquid-orb__blob--a {
          background: radial-gradient(circle, var(--accent-500, #d97706) 0%, transparent 65%);
          animation: liquidOrbDrift calc(5.5s / var(--orb-speed, 1)) cubic-bezier(0.37, 0, 0.63, 1) infinite;
        }

        .liquid-orb__blob--b {
          background: radial-gradient(circle, #059669 0%, transparent 60%);
          animation: liquidOrbDrift calc(7s / var(--orb-speed, 1)) cubic-bezier(0.37, 0, 0.63, 1) infinite reverse;
          animation-delay: -1.8s;
        }

        .liquid-orb__blob--c {
          background: radial-gradient(circle, #3b82f6 0%, transparent 60%);
          opacity: 0.6;
          animation: liquidOrbDrift calc(4.8s / var(--orb-speed, 1)) cubic-bezier(0.37, 0, 0.63, 1) infinite;
          animation-delay: -3s;
        }

        .liquid-orb__specular {
          position: absolute;
          top: 5%;
          left: 15%;
          right: 15%;
          height: 35%;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(4px);
        }

        :global(.dark) .liquid-orb__specular,
        .dark .liquid-orb__specular {
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), transparent);
        }

        .liquid-orb__ring {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4) inset;
          pointer-events: none;
        }

        :global(.dark) .liquid-orb__ring,
        .dark .liquid-orb__ring {
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        @keyframes liquidOrbDrift {
          0%   { transform: translate(-8%, -6%) scale(1) rotate(0deg); }
          33%  { transform: translate(10%, 8%) scale(1.18) rotate(120deg); }
          66%  { transform: translate(-5%, 9%) scale(0.9) rotate(240deg); }
          100% { transform: translate(-8%, -6%) scale(1) rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .liquid-orb__blob {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}