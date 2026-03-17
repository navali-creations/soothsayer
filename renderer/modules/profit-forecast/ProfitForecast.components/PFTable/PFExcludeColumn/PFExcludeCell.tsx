import type { CellContext } from "@tanstack/react-table";

import { useBoundStore } from "~/renderer/store";

import {
  type CardForecastRow,
  isAutoExcluded,
} from "../../../ProfitForecast.slice";

const PFExcludeCell = (cellProps: CellContext<CardForecastRow, unknown>) => {
  const {
    profitForecast: { toggleCardExclusion },
  } = useBoundStore();

  const row = cellProps.row.original;

  if (!row.hasPrice) {
    return null;
  }

  const autoExcluded = isAutoExcluded(row);
  const included = !row.excludeFromEv;

  let title: string;
  if (row.userOverride && autoExcluded) {
    title =
      "Manually included — auto-detection would exclude this card. Click to revert";
  } else if (row.userOverride && !autoExcluded) {
    title = "Manually excluded from EV calculations. Click to revert";
  } else if (autoExcluded) {
    title = "Auto-excluded — click to override and include in EV calculations";
  } else {
    title = "Included in EV calculations — click to exclude";
  }

  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        className={`checkbox checkbox-sm ${
          row.userOverride ? "checkbox-info" : ""
        }`}
        style={{ width: 14, height: 14, padding: 1 }}
        checked={included}
        onChange={() => toggleCardExclusion(row.cardName)}
        title={title}
      />
    </div>
  );
};

export default PFExcludeCell;
