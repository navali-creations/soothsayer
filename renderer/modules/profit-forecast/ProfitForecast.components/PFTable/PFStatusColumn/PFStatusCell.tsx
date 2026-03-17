import type { CellContext } from "@tanstack/react-table";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiCheckCircle,
  FiEyeOff,
} from "react-icons/fi";

import {
  type CardForecastRow,
  isAutoExcluded,
} from "../../../ProfitForecast.slice";

const PFStatusCell = (_cellProps: CellContext<CardForecastRow, unknown>) => {
  const row = _cellProps.row.original;

  // User override on an auto-excluded card → force-included
  if (row.userOverride && isAutoExcluded(row)) {
    const reason = row.isAnomalous ? "anomalous price" : "low confidence price";
    return (
      <div
        className="tooltip tooltip-right tooltip-info"
        data-tip={`Manually included — auto-detection flagged ${reason}`}
      >
        <span className="text-info">
          <FiCheckCircle className="w-3.5 h-3.5" />
        </span>
      </div>
    );
  }

  // User override on a normal card → force-excluded
  if (row.userOverride && !isAutoExcluded(row)) {
    return (
      <div
        className="tooltip tooltip-right"
        data-tip="Manually excluded from EV calculations"
      >
        <span className="text-base-content/40">
          <FiEyeOff className="w-3 h-3" />
        </span>
      </div>
    );
  }

  if (row.isAnomalous) {
    return (
      <div
        className="tooltip tooltip-right tooltip-error"
        data-tip="Excluded from EV — price is unusually high for a common card"
      >
        <span className="text-error">
          <FiAlertOctagon className="w-3.5 h-3.5" />
        </span>
      </div>
    );
  }

  if (row.confidence === 3) {
    return (
      <div
        className="tooltip tooltip-right tooltip-warning"
        data-tip="Excluded from EV — low confidence price"
      >
        <span className="text-warning">
          <FiAlertTriangle className="w-3 h-3" />
        </span>
      </div>
    );
  }

  return null;
};

export default PFStatusCell;
