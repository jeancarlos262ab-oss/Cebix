import { useSearchParams } from "react-router-dom";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import AlgorithmComparisonChart from "../components/charts/AlgorithmComparisonChart";
import RunModelPanel from "../components/model/RunModelPanel";
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

const TABS = [
  { key: "ejecutar", label: "Ejecutar modelo" },
  { key: "resumen", label: "Resumen y validación" },
  { key: "datos", label: "Variables y datos" },
];

function Section({ title, description, children }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="mt-0.5 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kpi({ label, value, unit, sora = true }) {
  return (
    <div className="p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 ${sora ? "font-sora" : ""}`}
      >
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>}
      </p>
    </div>
  );
}

function ResumenTab() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 border border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:grid-cols-4 lg:divide-y-0">
        <Kpi label="Modelo seleccionado" value={modelSummary.selected} sora={false} />
        <Kpi label="Parcelas de entrenamiento" value={modelSummary.trainingParcels} />
        <Kpi label="RMSE" value={modelSummary.rmse} unit="ton/ha" />
        <Kpi label="R²" value={modelSummary.r2} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <Section
          title="Baseline vs. gradient boosting"
          description="Ridge y Lasso como referencia; XGBoost y LightGBM sobre ~138 parcelas, sin redes profundas por el tamaño de la muestra."
        >
          <AlgorithmComparisonChart data={algorithmComparison} />
        </Section>

        <Section
          title="Validación espacial"
          description="Evita el sesgo por parcelas cercanas que produciría un k-fold aleatorio simple."
        >
          <ol className="space-y-4">
            {validationSteps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{step.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  );
}

function DatosTab() {
  return (
    <div className="space-y-8">
      <Section
        title="Feature engineering"
        description="Variables derivadas de datos satelitales, climáticos y de suelo por etapa del ciclo."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {featureGroups.map((group) => (
            <div key={group.group} className="border border-gray-200 p-4 dark:border-gray-800">
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
      </Section>

      <Section title="Fuentes de datos">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dataSources.map((source) => (
            <div key={source.name} className="border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{source.name}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{source.detail}</p>
              <span className="mt-3 inline-block bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {source.use}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function ModeloPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.key === requested) ? requested : "ejecutar";

  return (
    <>
      <TopBar
        title="Modelo"
        subtitle="Ejecuta el modelo con tus parcelas y consulta cómo pasa de imágenes satelitales a un rendimiento predicho."
        hideSearch
        actions={<InfoButton title="Preguntas guía del modelo" questions={guidingQuestions} />}
      />

      <div className="mt-6 border-b border-gray-200 px-4 dark:border-gray-700 sm:px-6 lg:px-8">
        <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto scrollbar-none">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setParams({ tab: t.key }, { replace: true })}
                className={`shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent-500 text-gray-900 dark:text-white"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {tab === "ejecutar" && <RunModelPanel />}
        {tab === "resumen" && <ResumenTab />}
        {tab === "datos" && <DatosTab />}
      </div>
    </>
  );
}
