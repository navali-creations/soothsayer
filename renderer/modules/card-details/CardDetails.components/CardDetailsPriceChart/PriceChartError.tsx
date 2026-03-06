import { FiAlertCircle } from "react-icons/fi";

import { CHART_HEIGHT } from "./constants";

/**
 * Error state shown when price history fails to load.
 * Displayed when poe.ninja is unreachable or the request fails.
 */
const PriceChartError = () => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Price History
      </h3>
      <div
        className="flex items-center justify-center bg-base-300/30 rounded-lg"
        style={{ height: CHART_HEIGHT }}
      >
        <div className="flex items-center gap-2 text-error">
          <FiAlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">
            Failed to load price history. poe.ninja may be unreachable.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PriceChartError;
