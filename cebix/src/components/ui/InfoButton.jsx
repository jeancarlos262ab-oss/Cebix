import { useState } from "react";
import { Info } from "lucide-react";
import Modal from "./Modal";

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
        <Modal title={title} size="lg" onClose={() => setOpen(false)}>
          {children && <div className="mb-5">{children}</div>}

          <div className="gap-x-10 md:columns-2">
            {questions.map((q) => (
              <div key={q.question} className="mb-5 break-inside-avoid">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{q.question}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{q.answer}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}