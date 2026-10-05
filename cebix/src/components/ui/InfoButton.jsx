import { useState } from "react";
import { Info, X } from "lucide-react";

/**
 * Botón de información que abre un panel explicando, en formato pregunta y
 * respuesta, cómo funciona esta parte del programa.
 *
 * Mismo aspecto en todas las pantallas: solo el icono en el color de acento,
 * sin borde ni fondo (el aro de foco solo aparece al navegar con teclado).
 *
 * @param {{title: string, questions: {question: string, answer: string}[]}} props
 */
const BUTTON_STYLE =
  "rounded-full text-accent-600 transition-colors hover:text-accent-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:text-accent-500";

export default function InfoButton({ title = "Acerca de este panel", questions, children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Información del programa"
        className={`flex h-9 w-9 shrink-0 items-center justify-center ${BUTTON_STYLE}`}
      >
        <Info size={24} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} className="text-accent-600 dark:text-accent-400" />
              </button>
            </div>

            {children && (
              <>
                <div className="mt-4">{children}</div>
              </>
            )}

            <div className="mt-4 space-y-4">
              {questions.map((q) => (
                <div key={q.question}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{q.question}</p>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{q.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
