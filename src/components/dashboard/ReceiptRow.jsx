import { memo } from "react";
import { FileText, Pencil } from "lucide-react";
import CategoryTag from "../ui/CategoryTag";

const CARD_LOGO = {
  visa: (
    <span className="text-[10px] font-black italic tracking-tight text-blue-700">
      VISA
    </span>
  ),
  mastercard: (
    <span className="flex -space-x-1.5">
      <span className="h-3.5 w-3.5 bg-red-500" />
      <span className="h-3.5 w-3.5 bg-orange-400 opacity-90" />
    </span>
  ),
};

/**
 * @param {{receipt: import("../../data/receipts").receipts[number]}} props
 */
function ReceiptRow({ receipt }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-red-50">
            <FileText size={16} className="text-red-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{receipt.merchant}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{receipt.fileSize}</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">{receipt.amount}</td>
      <td className="py-3 pr-4">
        <CategoryTag label={receipt.category} color={receipt.categoryColor} />
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-9 items-center justify-center border border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            {CARD_LOGO[receipt.cardBrand]}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{receipt.account}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Ends in {receipt.cardEnding}</p>
          </div>
        </div>
      </td>
      <td className="w-9 py-3 text-right">
        <button
          type="button"
          aria-label={`Edit ${receipt.merchant}`}
          className=" p-1.5 text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-500 dark:hover:text-gray-400"
        >
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  );
}

export default memo(ReceiptRow);
