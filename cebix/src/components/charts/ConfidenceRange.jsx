/**
 * Franja horizontal que ubica el rendimiento estimado dentro de una escala
 * fija (0 a maxScale ton/ha), con el intervalo de confianza sombreado
 * alrededor del punto central.
 *
 * @param {{estimate: number, confidence: number, maxScale?: number}} props
 */
export default function ConfidenceRange({ estimate, confidence, maxScale = 6 }) {
  const low = Math.max(0, estimate - confidence);
  const high = Math.min(maxScale, estimate + confidence);
  const toPct = (v) => (v / maxScale) * 100;
  const ticks = Array.from({ length: maxScale + 1 }, (_, i) => i);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-sora text-3xl font-bold text-gray-900 dark:text-gray-100">
          {estimate.toFixed(1)}
          <span className="ml-1 text-base font-medium text-gray-400 dark:text-gray-500">ton/ha</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ± {confidence.toFixed(1)} ton/ha (90% de confianza)
        </p>
      </div>

      <div
        className="relative mt-6 h-3 w-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(184,73,59,0.22), rgba(192,138,46,0.22) 50%, rgba(76,154,99,0.28))",
        }}
      >
        <div
          className="absolute top-0 h-3 border-x opacity-45"
          style={{
            left: `${toPct(low)}%`,
            width: `${toPct(high) - toPct(low)}%`,
            backgroundColor: "var(--chart-1)",
            borderColor: "var(--chart-1)",
          }}
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow dark:border-black"
          style={{ left: `${toPct(estimate)}%`, backgroundColor: "var(--chart-1)" }}
        />
      </div>

      {/* Escala: una marca por tonelada, con etiquetas en 0, mitad y máximo */}
      <div className="relative mt-1 h-1.5 w-full" aria-hidden="true">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-0 h-1.5 w-px bg-gray-300 dark:bg-gray-700"
            style={{ left: `${toPct(t)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400 dark:text-gray-500">
        <span className="font-medium" style={{ color: "#B8493B" }}>0 · bajo</span>
        <span>{(maxScale / 2).toFixed(0)} ton/ha</span>
        <span className="font-medium" style={{ color: "#4C9A63" }}>{maxScale} ton/ha · alto</span>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: "var(--chart-1)" }} />
          Estimación
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 opacity-45" style={{ backgroundColor: "var(--chart-1)" }} />
          Intervalo: {low.toFixed(1)} – {high.toFixed(1)} ton/ha
        </li>
      </ul>
    </div>
  );
}
