import { FiAlertCircle } from "react-icons/fi";

interface PriceSummaryErrorProps {
  error: string;
}

const PriceSummaryError = ({ error }: PriceSummaryErrorProps) => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Price Data
      </h3>
      <div className="flex items-center gap-2 text-error">
        <FiAlertCircle className="w-4 h-4 shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    </div>
  );
};

export default PriceSummaryError;
