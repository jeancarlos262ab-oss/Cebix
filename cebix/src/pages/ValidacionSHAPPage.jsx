import { TrendingDown, TrendingUp } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import { globalImportance } from "../data/shap";
import { guidingQuestions, modelSummary } from "../data/model";
import { useParcels } from "../context/ParcelsContext";

// Mismos tonos del semáforo (ver Semaphore.jsx) para que la lectura sea consistente en toda la app.
const EFFECT_COLOR = {
  positivo: "#4C9A63",
  negativo: "#B8493B",
  mixto: "#C08A2E",
};

const EFFECT_LEGEND = [
  { key: "positivo", label: "Efecto positivo" },
  { key: "negativo", label: "Efecto negativo" },
  { key: "mixto", label: "Efecto mixto" },
];

const topFeature = globalImportance[0];
const maxValue = Math.max(...globalImportance.map((d) => Math.abs(d.value)));

function ImportanceRow({ rank, row }) {
  const color = EFFECT_COLOR[row.direction] ?? "#98A2B3";
  const DirIcon = row.direction === "negativo" ? TrendingDown : TrendingUp;
  const pct = Math.max(1.5, (Math.abs(row.value) / maxValue) * 100);

  return (
    <li className="flex flex-col gap-2 py-3.5 md:flex-row md:items-center md:gap-5">
      <div className="flex min-w-0 items-start gap-3 md:w-72 md:shrink-0">
        <span className="w-5 shrink-0 pt-px text-right text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">
          {rank}
        </span>
        <span className="text-sm leading-snug text-gray-900 dark:text-gray-100">{row.feature}</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 pl-8 md:pl-0">
        <div
          className="h-2.5 flex-1 bg-gray-100 dark:bg-gray-800"
          role="img"
          aria-label={`${row.feature}: |SHAP| media ${row.value}, efecto ${row.direction}`}
        >
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="flex w-20 shrink-0 items-center justify-end gap-1.5 text-sm tabular-nums text-gray-900 dark:text-gray-100">
          <DirIcon size={14} style={{ color }} aria-hidden="true" />
          <span className="font-sora font-semibold">{row.value.toFixed(3)}</span>
        </span>
      </div>
    </li>
  );
}

export default function ValidacionSHAPPage() {
  const { parcels } = useParcels();
  const positive = parcels.reduce((sum, p) => sum + (p.score >= 70 ? 1 : 0), 0);
  const share = parcels.length ? (positive / parcels.length) * 100 : 0;

  return (
    <>
      <TopBar
        title="Validación SHAP"
        subtitle="Interpretabilidad del modelo: qué variables mueven la predicción y en qué dirección."
        hideSearch
        actions={
          <InfoButton title="Preguntas guía de la validación" questions={guidingQuestions} />
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1px_minmax(0,1fr)] lg:gap-10 lg:px-8">
        {/* Rail izquierdo: consistencia del score */}
        <aside>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Consistencia del score
          </h2>

          <p className="mt-4 font-sora text-3xl font-bold text-gray-900 dark:text-gray-100">
            {positive}
            <span className="ml-1.5 text-base font-medium text-gray-400 dark:text-gray-500">
              de {parcels.length} parcelas
            </span>
          </p>
          <div
            className="mt-3 h-1.5 w-full bg-gray-100 dark:bg-gray-800"
            role="img"
            aria-label={`${positive} de ${parcels.length} parcelas con score mayor a 70`}
          >
            <div className="h-full" style={{ width: `${share}%`, backgroundColor: "var(--chart-1)" }} />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {positive} de {parcels.length} parcelas evaluadas obtienen un score de elegibilidad
            mayor a 70, alineado con lo que domina el modelo: precipitación suficiente en
            emergencia-macollamiento y buen vigor foliar (LAI) en espigado-llenado — sin
            contradicciones entre el SHAP local y el semáforo final.
          </p>

          <dl className="mt-6 divide-y divide-gray-200 border-y border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">Parcelas de entrenamiento</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">
                {modelSummary.trainingParcels}
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-gray-500 dark:text-gray-400">Variable con mayor peso</dt>
              <dd className="mt-1 font-medium leading-snug text-gray-900 dark:text-gray-100">
                {topFeature.feature}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">|SHAP| media máxima</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">
                {topFeature.value}
              </dd>
            </div>
          </dl>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Contenido principal: importancia global de variables */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Importancia global de variables
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Media de |SHAP| sobre las {modelSummary.trainingParcels} parcelas de entrenamiento.
              </p>
            </div>

            {/* Cómo leer el efecto */}
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {EFFECT_LEGEND.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                >
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: EFFECT_COLOR[item.key] }} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <ol className="mt-4 divide-y divide-gray-100 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {globalImportance.map((row, i) => (
              <ImportanceRow key={row.feature} rank={i + 1} row={row} />
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}