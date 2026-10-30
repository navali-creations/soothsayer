import type { CellContext } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useProfitForecast } from "~/renderer/store";

import {
  type CardForecastRow,
  isAutoExcluded,
} from "../../../ProfitForecast.slice/ProfitForecast.slice";

const PFExcludeCell = (
  cellProps: CellContext<AppTableFeatures, CardForecastRow, unknown>,
) => {
  const { toggleCardExclusion } = useProfitForecast();

  const row = cellProps.row.original;

  if (!row.hasPrice) {
    return null;
  }

  const autoExcluded = isAutoExcluded(row);
  const included = !row.excludeFromEv;

  let tooltip: string;
  if (row.userOverride && autoExcluded) {
    tooltip =
      "Manually included — auto-detection would exclude this card. Click to revert";
  } else if (row.userOverride && !autoExcluded) {
    tooltip = "Manually excluded from EV calculations. Click to revert";
  } else if (autoExcluded) {
    tooltip =
      "Auto-excluded — click to override and include in EV calculations";
  } else {
    tooltip = "Included in EV calculations — click to exclude";
  }

  return (
    <div className="flex justify-center">
      <Tooltip as="div" content={tooltip} describeChild>
        <input
          aria-label={tooltip}
          type="checkbox"
          className={`checkbox checkbox-sm ${
            row.userOverride ? "checkbox-info" : ""
          }`}
          style={{ width: 14, height: 14, padding: 1 }}
          checked={included}
          onChange={() => toggleCardExclusion(row.cardName)}
        />
      </Tooltip>
    </div>
  );
};

export default PFExcludeCell;
