import { useSearchParams } from "react-router-dom";
import { CloudRain, Mountain, Satellite, Sprout } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import AlgorithmComparisonChart from "../components/charts/AlgorithmComparisonChart";
import RunModelPanel from "../components/model/RunModelPanel";
import RequireModelInfo from "../components/ui/RequireModelInfo";
import { useModelInfo } from "../context/ModelInfoContext";

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

// Un ícono por fuente, para reconocerlas de un vistazo.
const SOURCE_ICON = {
  "Sentinel-2 / Landsat": Satellite,
  "CHIRPS + CHIRTS-ERA5": CloudRain,
  "INEGI - CEM 4.0": Mountain,
  "Reto AgroCebada 2026 (FIRA)": Sprout,
};

function Section({ title, description, children }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Kpi({ label, value, unit, large = true, highlight = false }) {
  return (
    <div className="relative p-5">
      {highlight && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-500" aria-hidden="true" />
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`mt-2 font-bold leading-tight text-gray-900 dark:text-gray-100 ${
          large ? "font-display text-2xl" : "text-base"
        }`}
      >
        {value}
        {unit && (
          <span className="ml-1.5 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>
        )}
      </p>
    </div>
  );
}

function ResumenTab() {
  const { modelSummary, algorithmComparison, validationSteps } = useModelInfo().info;
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="Modelo seleccionado" value={modelSummary.selected} large={false} highlight />
        </div>
        <Kpi label="Parcelas de entrenamiento" value={modelSummary.trainingParcels} />
        <Kpi label="RMSE" value={modelSummary.rmse} unit="ton/ha" />
        <Kpi label="R²" value={modelSummary.r2} />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Section
          title="Baseline vs. gradient boosting"
          description={`Ridge y Lasso como referencia; XGBoost y LightGBM sobre ${modelSummary.trainingParcels} parcelas, sin redes profundas por el tamaño de la muestra.`}
        >
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <AlgorithmComparisonChart data={algorithmComparison} highlight={modelSummary.modelName} />
          </div>
        </Section>

        <Section
          title="Validación espacial"
          description="Evita el sesgo por parcelas cercanas que produciría un k-fold aleatorio simple."
        >
          <ol>
            {validationSteps.map((step, i) => {
              const last = i === validationSteps.length - 1;
              return (
                <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute left-3 top-8 bottom-0 w-px -translate-x-1/2 bg-gray-200 dark:bg-gray-800"
                    />
                  )}
                  <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-semibold text-accent-contrast">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      {step.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>
    </div>
  );
}

function DatosTab() {
  const { featureGroups, dataSources } = useModelInfo().info;
  return (
    <div className="space-y-10">
      <Section
        title="Feature engineering"
        description="Variables derivadas de datos satelitales, climáticas y de suelo por etapa del ciclo."
      >
        <div className="space-y-4">
          {featureGroups.map((group) => (
            <div key={group.group} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2.5 bg-gray-50 px-5 py-3 dark:bg-gray-900">
                <span className={`h-2 w-2 shrink-0 rounded-full ${GROUP_DOT[group.color]}`} />
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {group.group}
                </p>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2">
                {group.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 px-5 py-3 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${GROUP_DOT[group.color]}`}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Fuentes de datos">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {dataSources.map((source) => {
            const Icon = SOURCE_ICON[source.name] ?? Satellite;
            const training = source.use === "Entrenamiento";
            return (
              <div
                key={source.name}
                className="flex h-full flex-col rounded-2xl border border-gray-200 p-5 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                    <Icon size={18} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      training
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {source.use}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {source.name}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {source.detail}
                </p>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

export default function ModeloPage() {
  const [params, setParams] = useSearchParams();
  const { info } = useModelInfo();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.key === requested) ? requested : "ejecutar";

  return (
    <>
      <TopBar
        title="Modelo"
        subtitle="Ejecuta el modelo con tus parcelas y consulta cómo pasa de imágenes satelitales a un rendimiento predicho."
        hideSearch
        actions={<InfoButton title="Preguntas guía del modelo" questions={info?.guidingQuestions ?? []} />}
      />

      <div className="mt-6 px-4 sm:px-6 lg:px-8">
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
        {tab === "resumen" && (
          <RequireModelInfo>
            <ResumenTab />
          </RequireModelInfo>
        )}
        {tab === "datos" && (
          <RequireModelInfo>
            <DatosTab />
          </RequireModelInfo>
        )}
      </div>
    </>
  );
}