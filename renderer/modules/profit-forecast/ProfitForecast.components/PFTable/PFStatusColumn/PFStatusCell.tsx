import type { CellContext } from "@tanstack/react-table";
import { FiAlertOctagon, FiAlertTriangle } from "react-icons/fi";

import type { CardForecastRow } from "../../../ProfitForecast.slice";

const PFStatusCell = (_cellProps: CellContext<CardForecastRow, unknown>) => {
  const row = _cellProps.row.original;

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
