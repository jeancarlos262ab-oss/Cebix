import { useSearchParams } from "react-router-dom";
import { CloudRain, Mountain, Satellite, Sprout } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import AlgorithmComparisonChart from "../components/charts/AlgorithmComparisonChart";
import FeatureCountChart from "../components/charts/FeatureCountChart";
import RunModelPanel from "../components/model/RunModelPanel";
import RequireModelInfo from "../components/ui/RequireModelInfo";
import { useModelInfo } from "../context/ModelInfoContext";
import { formatFixed } from "../utils/intl";

const TABS = [
  { key: "ejecutar", label: "Ejecutar modelo" },
  { key: "resumen", label: "Resumen y validación" },
  { key: "datos", label: "Variables y datos" },
  { key: "proceso", label: "Proceso" },
];

const SOURCE_ICON = {
  "Sentinel-2 / Landsat": Satellite,
  "CHIRPS + CHIRTS-ERA5": CloudRain,
  "INEGI - CEM 4.0": Mountain,
  "Reto AgroCebada 2026": Sprout,
};

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
  const { modelSummary, algorithmComparison, validationSteps, planetModel } = useModelInfo().info;
  return (
    <div className="space-y-6">
      {}
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:grid-cols-[1.7fr_1fr_1fr_1fr] lg:divide-y-0">
        <div className="col-span-2 border-b border-gray-200 dark:border-gray-800 lg:col-span-1 lg:border-b-0">
          <Kpi label="Modelo seleccionado" value={modelSummary.selected} small />
        </div>
        <Kpi label="Parcelas de entrenamiento" value={modelSummary.trainingParcels} />
        <Kpi label="RMSE" value={modelSummary.rmse} unit="ton/ha" accent />
        <Kpi label="R²" value={modelSummary.r2} accent />
      </div>

      {planetModel && (
        <Card
          title="Evaluación con Planet (no se usa)"
          description={`Se probó un modelo con los datos de Planet. Mismas ${planetModel.trainingParcels} parcelas de entrenamiento y misma validación por bloques espaciales (se deja fuera cada grupo de parcelas cercanas).`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Modelo</th>
                  <th className="py-2 pr-4 font-medium">Variables</th>
                  <th className="py-2 pr-4 font-medium">RMSE (t/ha)</th>
                  <th className="py-2 pr-4 font-medium">MAE (t/ha)</th>
                  <th className="py-2 font-medium">R²</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-gray-900 dark:text-gray-100">
                <tr className="border-t border-gray-200 dark:border-gray-800">
                  <td className="py-2 pr-4">Modelo actual (lluvia)</td>
                  <td className="py-2 pr-4">{planetModel.baseline.nFeatures}</td>
                  <td className="py-2 pr-4">{planetModel.baseline.rmse}</td>
                  <td className="py-2 pr-4">{planetModel.baseline.mae}</td>
                  <td className="py-2">{planetModel.baseline.r2}</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-800">
                  <td className="py-2 pr-4">Con Planet</td>
                  <td className="py-2 pr-4">
                    {planetModel.nFeatures} (lluvia y {planetModel.nPlanet} de Planet)
                  </td>
                  <td className="py-2 pr-4">{planetModel.rmse}</td>
                  <td className="py-2 pr-4">{planetModel.mae}</td>
                  <td className="py-2">{planetModel.r2}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {planetModel.rmse < planetModel.baseline.rmse
              ? `Con Planet el error baja ${formatFixed((planetModel.baseline.rmse - planetModel.rmse), 2)} t/ha.`
              : "Con Planet la precisión no mejora, por eso no se usa."}{" "}
            Un archivo de Planet se ejecuta con el modelo de lluvia y sus índices se muestran como contexto de la parcela.
          </p>
        </Card>
      )}

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

const VERDICT_STYLE = {
  Referencia: "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  "Sin mejora": "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  Empeora: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

function ProcesoTab() {
  const { buildProcess: p, modelSummary } = useModelInfo().info;
  if (!p) {
    return <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Esta información aún no está disponible.</p>;
  }
  return (
    <div className="space-y-6">
      <Card
        title="De los datos a la predicción"
        description="Los cinco pasos que sigue el modelo, desde la imagen satelital hasta el rendimiento estimado."
        bodyClassName="p-0"
      >
        <ol className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 md:grid-cols-5 md:divide-x md:divide-y-0">
          {p.pipeline.map((step, i) => (
            <li key={step.title} className="px-5 py-4">
              <span className="text-[11px] font-semibold tabular-nums text-accent-600 dark:text-accent-400">{i + 1}</span>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Cómo mejoró el modelo" description="Tres etapas, todas con la misma validación por estado (Random Forest)." bodyClassName="p-0">
        <ol className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {p.stages.map((st, i) => {
            const last = i === p.stages.length - 1;
            return (
              <li key={st.title} className="px-5 py-5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Etapa {i + 1}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{st.title}</p>
                <p
                  className={`mt-3 font-display text-2xl font-bold tabular-nums ${
                    last ? "text-accent-600 dark:text-accent-400" : "text-gray-900 dark:text-white"
                  }`}
                >
                  R² {st.r2}
                </p>
                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {st.nFeatures} variables · RMSE {st.rmse} t/ha
                </p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{st.detail}</p>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Cuántas variables conviene usar" description="Más variables no mejoran el modelo: con pocas parcelas, las de poco aporte solo agregan ruido.">
          <FeatureCountChart data={p.featureCountSearch} selected={modelSummary.nFeatures} />
        </Card>

        <Card title="Otras variables que se probaron" description={p.extraVariablesNote} bodyClassName="p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-2.5 font-medium">Variante</th>
                <th className="px-2 py-2.5 text-right font-medium">R²</th>
                <th className="px-2 py-2.5 text-right font-medium">RMSE</th>
                <th className="px-5 py-2.5 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {p.extraVariables.map((r) => (
                <tr key={r.variant}>
                  <td className="px-5 py-2.5 text-gray-800 dark:text-gray-200">
                    {r.variant}
                    {r.group && <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{r.group}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatFixed(r.r2, 3)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatFixed(r.rmse, 3)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Alcance y límites" description="Lo que conviene tener presente al interpretar una predicción." bodyClassName="divide-y divide-gray-200 dark:divide-gray-800">
        {p.limitations.map((l) => (
          <div key={l.title} className="px-5 py-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{l.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{l.detail}</p>
          </div>
        ))}
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
        {tab === "proceso" && (
          <RequireModelInfo>
            <ProcesoTab />
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