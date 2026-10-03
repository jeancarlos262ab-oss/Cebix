import { useEffect, useId, useRef, useState } from "react";
import { usePageActive } from "../../context/PageActiveContext";

/**
 * LiquidOrbLoader — Lámpara de lava que "piensa"
 *
 * Esfera con fondo circular (sin borde) con cera líquida de un solo color (el acento) y efecto
 * metaball (filtro SVG). El movimiento NO es un loop de CSS: cada gota sigue su
 * propio ciclo y, al terminar cada ciclo, sortea de nuevo cuánto tarda, hasta
 * dónde sube, hacia qué lado se desplaza, cuánto se estira y si espera abajo
 * antes de volver a subir. La piscina y el casquete se mueven con
 * ruido suave (ondas con frecuencias no múltiplos entre sí). Resultado: la
 * animación nunca se repite igual.
 *
 * `running` solo cambia la velocidad global, de forma gradual (sin saltos).
 *
 * API: <LiquidOrbLoader size running label />
 */

const IDLE_RATE = 0.75; // velocidad en espera
const RUN_RATE = 4.6; // velocidad pensando
const RATE_SMOOTHING = 0.45; // segundos que tarda en acelerar / frenar

// Gotas: posición horizontal base (% del ancho) y diámetro (fracción del orb).
const BLOBS = [
  { left: 24, d: 0.3 },
  { left: 52, d: 0.22 },
  { left: 40, d: 0.16 },
  { left: 60, d: 0.27 },
  { left: 18, d: 0.14 },
  { left: 46, d: 0.2 },
].map((b) => ({ ...b, y0: 1 - b.d * 0.55, y1: -b.d * 0.45 }));

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

// Ruido suave: suma de tres senos con frecuencias inconmensurables y fases al azar.
function makeNoise() {
  const base = rand(0.12, 0.22);
  const f = [base, base * 1.618, base * 2.414];
  const p = [rand(0, TAU), rand(0, TAU), rand(0, TAU)];
  return (t) =>
    (Math.sin(t * TAU * f[0] + p[0]) +
      Math.sin(t * TAU * f[1] + p[1]) +
      Math.sin(t * TAU * f[2] + p[2])) /
    3;
}

// Sortea un ciclo nuevo para una gota (continúa desde la x donde terminó el anterior).
function newCycle(blob, xs, firstTime) {
  const shortRise = Math.random() < 0.22; // a veces sube poco y se arrepiente
  const minX = -blob.left / 100 + 0.02;
  const maxX = 1 - blob.left / 100 - blob.d - 0.02;
  return {
    t: firstTime ? Math.random() : 0,
    dur: rand(6, 15),
    dwell: firstTime ? 0 : Math.random() < 0.35 ? rand(0.5, 3) : 0,
    peak: shortRise ? rand(0.3, 0.5) : rand(0.65, 1),
    xs,
    xe: clamp(xs + rand(-0.2, 0.2), minX, maxX),
    sway: rand(-0.07, 0.07),
    wobble: rand(0.03, 0.09),
    wobblePhase: rand(0, TAU),
    wobbleSpeed: rand(0.6, 1.4),
  };
}

export default function LiquidOrbLoader({ size = 320, running = false, label }) {
  const gooId = `goo-${useId().replace(/:/g, "")}`;
  const blur = size * 0.04;

  const rootRef = useRef(null);
  const poolRef = useRef(null);
  const capRef = useRef(null);
  const blobRefs = useRef([]);
  const runningRef = useRef(running);
  runningRef.current = running;

  // Solo anima si su pantalla está visible Y el orbe está dentro del viewport.
  // Sin esto el bucle (con filtro SVG) seguía corriendo en segundo plano y
  // volvía pesado el scroll de TODAS las pantallas.
  const pageActive = usePageActive();
  const [inView, setInView] = useState(true);
  const enabled = pageActive && inView;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const controlRef = useRef(null); // { start, stop } del bucle

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (enabled) controlRef.current?.start();
    else controlRef.current?.stop();
  }, [enabled]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Estado inicial aleatorio (distinto en cada montaje).
    const state = BLOBS.map((b) => {
      const minX = -b.left / 100 + 0.02;
      const maxX = 1 - b.left / 100 - b.d - 0.02;
      return newCycle(b, clamp(rand(-0.1, 0.1), minX, maxX), true);
    });
    const poolNoise = [makeNoise(), makeNoise(), makeNoise()];
    const capNoise = [makeNoise(), makeNoise(), makeNoise()];

    let rate = runningRef.current ? RUN_RATE : IDLE_RATE;
    let clock = rand(0, 1000); // tiempo "virtual" para los ruidos
    let last = performance.now();
    let raf = 0;

    // Tamaño en caché: leer offsetWidth en cada frame forzaba un layout.
    let S = root.offsetWidth || size;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { S = root.offsetWidth || size; }) : null;
    ro?.observe(root);

    const paint = () => {

      BLOBS.forEach((b, i) => {
        const el = blobRefs.current[i];
        if (!el) return;
        const c = state[i];
        const waiting = c.dwell > 0;
        const t = waiting ? 0 : c.t;
        const h = (1 - Math.cos(t * TAU)) / 2; // 0 → 1 → 0
        const y = b.y0 + (b.y1 - b.y0) * h * c.peak;
        const x =
          c.xs + (c.xe - c.xs) * smooth(t) + c.sway * Math.sin(t * TAU) +
          c.wobble * 0.3 * Math.sin(clock * c.wobbleSpeed + c.wobblePhase);
        const speed = Math.abs(Math.sin(t * TAU));
        const sy =
          1 + 0.15 * speed + c.wobble * Math.sin(clock * c.wobbleSpeed * 1.3 + c.wobblePhase);
        const sx = 1 / sy;
        el.style.transform = `translate3d(${(x * S).toFixed(2)}px, ${(y * S).toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      });

      if (poolRef.current) {
        const [a, b, c] = poolNoise.map((n) => n(clock));
        poolRef.current.style.transform = `translateY(${(-6 - a * 5).toFixed(2)}%) scale(${(1.03 + b * 0.05).toFixed(3)}, ${(1.08 + c * 0.1).toFixed(3)})`;
      }
      if (capRef.current) {
        const [a, b, c] = capNoise.map((n) => n(clock));
        capRef.current.style.transform = `translate(${(a * 12).toFixed(2)}%, ${(b * 8).toFixed(2)}%) scale(${(1 + c * 0.14).toFixed(3)}, ${(1 + b * 0.12).toFixed(3)})`;
      }
    };

    if (reduced) {
      // Sin movimiento: una pose estática.
      state.forEach((c) => (c.t = 0.5));
      paint();
      return () => ro?.disconnect();
    }

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Velocidad global: se acerca gradualmente al objetivo.
      const target = runningRef.current ? RUN_RATE : IDLE_RATE;
      rate += (target - rate) * (1 - Math.exp(-dt / RATE_SMOOTHING));

      clock += dt * rate;

      state.forEach((c, i) => {
        if (c.dwell > 0) {
          c.dwell -= dt * rate;
          return;
        }
        c.t += (dt * rate) / c.dur;
        if (c.t >= 1) state[i] = newCycle(BLOBS[i], c.xe, false);
      });

      paint();
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    controlRef.current = { start, stop };

    paint();
    if (enabledRef.current) start();
    return () => {
      stop();
      ro?.disconnect();
      controlRef.current = null;
    };
  }, [size]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Filtro metaball: desenfoca y "endurece" el alfa para que las gotas se fundan */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <filter id={gooId} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={rootRef}
        className={`lava ${running ? "lava--active" : ""}`}
        style={{
          width: size,
          maxWidth: "100%",
          aspectRatio: "1 / 1",
        }}
        role="status"
        aria-label={label || (running ? "Ejecutando modelo" : "En espera")}
      >
        <div className="lava__glass bg-gray-100 dark:bg-gray-900">
          {/* Cera: capa con filtro gooey */}
          <div className="lava__wax" style={{ filter: `url(#${gooId})` }}>
            <span ref={poolRef} className="lava__pool" />
            <span ref={capRef} className="lava__cap" />
            {BLOBS.map((b, i) => (
              <span
                key={i}
                ref={(el) => (blobRefs.current[i] = el)}
                className="lava__blob"
                style={{
                  left: `${b.left}%`,
                  width: `${b.d * 100}%`,
                  height: `${b.d * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {label && (
        <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">
          {label}
        </p>
      )}

      <style>{`
        .lava {
          --accent: var(--accent-500);
          position: relative;
          flex-shrink: 0;
        }

        .lava__glass {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 999px;
          /* El fondo circular lo pone Tailwind (bg-gray-100 / dark:bg-gray-900):
             un tono apenas más oscuro que la página en claro y más claro en oscuro. */
          transform: scale(1);
          transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lava--active .lava__glass { transform: scale(1.1); }

        .lava__wax {
          position: absolute;
          inset: 0;
        }

        .lava__pool,
        .lava__cap,
        .lava__blob {
          position: absolute;
          border-radius: 999px;
          background: var(--accent);
          will-change: transform;
        }
        .lava__pool {
          left: 8%; right: 8%; bottom: -14%;
          height: 34%;
        }
        .lava__cap {
          left: 32%; right: 32%; top: -16%;
          height: 24%;
          opacity: 0.9;
        }
        .lava__blob { top: 0; }
      `}</style>
    </div>
  );
}