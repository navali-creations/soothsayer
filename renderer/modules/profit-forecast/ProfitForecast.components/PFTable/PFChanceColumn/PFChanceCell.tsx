import type { CellContext } from "@tanstack/react-table";

import type { CardForecastRow } from "../../../ProfitForecast.slice";
import { formatPercent } from "../../../ProfitForecast.utils";

const PFChanceCell = (cellProps: CellContext<CardForecastRow, number>) => {
  return (
    <span className="font-mono text-sm">
      {formatPercent(cellProps.getValue(), 2)}
    </span>
  );
};

export default PFChanceCell;
