import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BTN_OUTLINE } from "./buttonStyles";

export default function BackToParcelas({ className = "" }) {
  return (
    <Link to="/parcelas" className={`${BTN_OUTLINE} ${className}`}>
      <ArrowLeft size={15} className="text-gray-500 dark:text-gray-400" />
      Volver a Parcelas
    </Link>
  );
}