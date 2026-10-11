import { useSearchParams } from "react-router-dom";
import { CloudRain, Mountain, Satellite, Sprout } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import AlgorithmComparisonChart from "../components/charts/AlgorithmComparisonChart";
import RunModelPanel from "../components/model/RunModelPanel";
import RequireModelInfo from "../components/ui/RequireModelInfo";
import { useModelInfo } from "../context/ModelInfoContext";

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

/** Tarjeta estándar de la app: encabezado con título/descripción, línea divisoria y cuerpo. */
function Card({ title, description, children, className = "", bodyClassName = "p-5" }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 ${className}`}>
      <header className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && (
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </header>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function Kpi({ label, value, unit, accent = false, small = false }) {
  return (
    <div className="px-5 py-5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`mt-2 font-display font-bold leading-tight ${small ? "text-base" : "text-2xl"} ${
          accent ? "text-accent-600 dark:text-accent-400" : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
        {unit && <span className="ml-1.5 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>}
      </p>
    </div>
  );
}

function ResumenTab() {
  const { modelSummary, algorithmComparison, validationSteps } = useModelInfo().info;
  return (
    <div className="space-y-6">
      {/* Indicadores: una sola tarjeta, separados por líneas finas */}
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:grid-cols-[1.7fr_1fr_1fr_1fr] lg:divide-y-0">
        <div className="col-span-2 border-b border-gray-200 dark:border-gray-800 lg:col-span-1 lg:border-b-0">
          <Kpi label="Modelo seleccionado" value={modelSummary.selected} small />
        </div>
        <Kpi label="Parcelas de entrenamiento" value={modelSummary.trainingParcels} />
        <Kpi label="RMSE" value={modelSummary.rmse} unit="ton/ha" accent />
        <Kpi label="R²" value={modelSummary.r2} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Baseline vs. gradient boosting"
          description={`Ridge y Lasso como referencia; XGBoost y LightGBM sobre ${modelSummary.trainingParcels} parcelas, sin redes profundas por el tamaño de la muestra.`}
        >
          <AlgorithmComparisonChart data={algorithmComparison} highlight={modelSummary.modelName} />
        </Card>

        <Card
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
                  <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[11px] font-semibold tabular-nums text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function DatosTab() {
  const { featureGroups, dataSources } = useModelInfo().info;
  return (
    <div className="space-y-6">
      <Card
        title="Feature engineering"
        description="Variables derivadas de datos satelitales, climáticas y de suelo por etapa del ciclo."
        bodyClassName="divide-y divide-gray-200 dark:divide-gray-800"
      >
        {featureGroups.map((group) => (
          <div key={group.group} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.group}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {group.features.length} variables
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
              {group.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card title="Fuentes de datos" bodyClassName="divide-y divide-gray-200 dark:divide-gray-800">
        {dataSources.map((source) => {
          const Icon = SOURCE_ICON[source.name] ?? Satellite;
          const training = source.use === "Entrenamiento";
          return (
            <div key={source.name} className="flex items-start gap-4 px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-accent-600 dark:bg-gray-800 dark:text-accent-400">
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{source.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{source.detail}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  training
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {source.use}
              </span>
            </div>
          );
        })}
      </Card>
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