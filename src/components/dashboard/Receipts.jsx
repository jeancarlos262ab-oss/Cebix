import { Download, Plus } from "lucide-react";
import UploadDropzone from "./UploadDropzone";
import ReceiptRow from "./ReceiptRow";
import { receipts } from "../../data/receipts";

const COLUMNS = ["Merchant", "Amount", "Category", "Account", ""];

export default function Receipts() {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Receipts</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download size={15} />
            Export
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="mt-4">
        <UploadDropzone />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-400 dark:text-gray-500">
              {COLUMNS.map((col) => (
                <th key={col} className="pb-2 pr-4 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <ReceiptRow key={receipt.id} receipt={receipt} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
