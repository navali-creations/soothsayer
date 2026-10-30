import type { CellContext } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import { formatPercent } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFChanceCell = (
  cellProps: CellContext<AppTableFeatures, CardForecastRow, number>,
) => {
  return (
    <span className="font-mono text-sm">
      {formatPercent(cellProps.getValue(), 2)}
    </span>
  );
};

export default PFChanceCell;
