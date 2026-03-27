import { FiAlertOctagon, FiAlertTriangle } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

const PFExcludedCards = () => {
  const {
    profitForecast: { getExcludedCount, isLoading, hasData },
  } = useBoundStore();

  const dataAvailable = hasData() && !isLoading;
  const excludedCount = dataAvailable
    ? getExcludedCount()
    : { anomalous: 0, lowConfidence: 0, total: 0 };

  if (excludedCount.total <= 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <span className="text-xs text-base-content/50 font-medium">
        Excluded from EV
      </span>

      <div className="flex flex-col gap-1">
        {excludedCount.anomalous > 0 && (
          <span className="badge badge-soft badge-error badge-sm gap-1">
            <FiAlertOctagon className="w-3 h-3" />
            {excludedCount.anomalous} anomalous price
            {excludedCount.anomalous !== 1 ? "s" : ""}
          </span>
        )}
        {excludedCount.lowConfidence > 0 && (
          <span className="badge badge-soft badge-warning badge-sm gap-1">
            <FiAlertTriangle className="w-3 h-3" />
            {excludedCount.lowConfidence} low confidence
          </span>
        )}
      </div>

      <p className="text-[11px] text-base-content/40 leading-tight">
        Cards with unreliable prices are excluded from expected value and
        break-even calculations.
      </p>
    </div>
  );
};

export default PFExcludedCards;
