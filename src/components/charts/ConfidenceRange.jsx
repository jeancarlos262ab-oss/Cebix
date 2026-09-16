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

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <p className="font-sora text-3xl font-bold text-gray-900 dark:text-gray-100">
          {estimate.toFixed(1)}
          <span className="ml-1 text-base font-medium text-gray-400 dark:text-gray-500">ton/ha</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ± {confidence.toFixed(1)} ton/ha (90% de confianza)
        </p>
      </div>

      <div className="relative mt-4 h-2.5 w-full bg-gray-100 dark:bg-gray-800">
        <div
          className="absolute top-0 h-2.5 bg-ndvi-400/50"
          style={{ left: `${toPct(low)}%`, width: `${toPct(high) - toPct(low)}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 border-2 border-white bg-ndvi-600 shadow"
          style={{ left: `${toPct(estimate)}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>0</span>
        <span>{(maxScale / 2).toFixed(0)} ton/ha</span>
        <span>{maxScale} ton/ha</span>
      </div>
    </div>
  );
}
