import { useState } from "react";
import { Info, X } from "lucide-react";

/**
 * Botón de información que abre un panel explicando, en formato pregunta y
 * respuesta, cómo funciona esta parte del programa.
 *
 * @param {{title: string, questions: {question: string, answer: string}[]}} props
 */
export default function InfoButton({ title = "Acerca de este panel", questions }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Información del programa"
        className="flex h-9 w-9 shrink-0 items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Info size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

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
