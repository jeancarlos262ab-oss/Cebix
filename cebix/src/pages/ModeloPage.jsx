import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import AlgorithmComparisonChart from "../components/charts/AlgorithmComparisonChart";
import {
  algorithmComparison,
  dataSources,
  featureGroups,
  guidingQuestions,
  modelSummary,
  validationSteps,
} from "../data/model";

const GROUP_DOT = {
  ndvi: "bg-ndvi-500",
  brand: "bg-brand-500",
  navy: "bg-gray-600",
};

export default function ModeloPage() {
  return (
    <>
      <TopBar
        title="Modelo"
        subtitle="Cómo Cebix pasa de imágenes satelitales a un rendimiento predicho."
        hideSearch
        actions={
          <InfoButton title="Preguntas guía del modelo" questions={guidingQuestions} />
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 px-8 py-6 lg:grid-cols-[280px_1px_1fr] lg:gap-8">
        {/* Rail izquierdo: ficha del modelo + validación espacial */}
        <aside className="bg-white dark:bg-black">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Ficha del modelo
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Modelo final elegido y cómo se validó antes de usarse en producción.
          </p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Modelo seleccionado</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{modelSummary.selected}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Parcelas de entrenamiento</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{modelSummary.trainingParcels}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">RMSE</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{modelSummary.rmse} ton/ha</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">R²</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{modelSummary.r2}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Validación</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">Espacial por bloques</dd>
            </div>
          </dl>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Validación espacial
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Evita el sesgo por parcelas cercanas que produciría un k-fold aleatorio simple.
          </p>
          <ol className="mt-4 space-y-4">
            {validationSteps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{step.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Contenido principal: variables + comparación de algoritmos + fuentes */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Feature engineering</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Variables derivadas de datos satelitales, climáticos y de suelo por etapa del ciclo.
          </p>

          <div className="mt-4 grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800 md:grid-cols-3 md:divide-x md:divide-y-0">
            {featureGroups.map((group) => (
              <div key={group.group} className="py-4 md:px-6 md:py-4 md:first:pl-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 ${GROUP_DOT[group.color]}`} />
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.group}</p>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {group.features.map((f) => (
                    <li key={f} className="text-sm text-gray-600 dark:text-gray-400">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Baseline vs. gradient boosting
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Ridge y Lasso como referencia; XGBoost y LightGBM sobre ~138 parcelas, sin redes
              profundas por el tamaño de la muestra.
            </p>
            <div className="mt-4">
              <AlgorithmComparisonChart data={algorithmComparison} />
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fuentes de datos</h2>
            <div className="mt-4 grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
              {dataSources.map((source) => (
                <div
                  key={source.name}
                  className="py-4 sm:border-l sm:border-gray-200 sm:px-5 sm:py-4 sm:first:border-l-0 sm:first:pl-0 dark:sm:border-gray-800"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{source.name}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{source.detail}</p>
                  <span className="mt-2 inline-block bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {source.use}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
