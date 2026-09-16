import TopBar from "../components/layout/TopBar";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import InfoButton from "../components/ui/InfoButton";
import { globalImportance } from "../data/shap";
import { guidingQuestions, modelSummary } from "../data/model";
import { useParcels } from "../context/ParcelsContext";

const EFFECT_LEGEND = [
  { color: "#4C9A63", label: "Efecto positivo" },
  { color: "#C0362E", label: "Efecto negativo" },
  { color: "#C08A2E", label: "Efecto mixto" },
];

const topFeature = globalImportance[0];

export default function ValidacionSHAPPage() {
  const { parcels } = useParcels();
  const positive = parcels.reduce((sum, p) => sum + (p.score >= 70 ? 1 : 0), 0);

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

      <div className="grid grid-cols-1 px-8 py-6 lg:grid-cols-[280px_1px_1fr] lg:gap-8">
        {/* Rail izquierdo: consistencia del score y cómo leer el efecto */}
        <aside className="bg-white dark:bg-black">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Consistencia del score
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {positive} de {parcels.length} parcelas evaluadas obtienen un score de elegibilidad
            mayor a 70, alineado con NDVI alto en llenado de grano y precipitación suficiente en
            espigado — sin contradicciones entre el SHAP local y el semáforo final.
          </p>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Parcelas de entrenamiento</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{modelSummary.trainingParcels}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Variable con mayor peso</dt>
              <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                {topFeature.feature}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">|SHAP| media máxima</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{topFeature.value}</dd>
            </div>
          </dl>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Cómo leer el efecto
          </h3>
          <ul className="mt-3 space-y-2">
            {EFFECT_LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Contenido principal: importancia global de variables */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Importancia global de variables
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Media de |SHAP| sobre las {modelSummary.trainingParcels} parcelas de entrenamiento.
          </p>
          <div className="mt-4">
            <FeatureImportanceChart data={globalImportance} height={380} />
          </div>
        </div>
      </div>
    </>
  );
}
