import type { CellContext } from "@tanstack/react-table";
import clsx from "clsx";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";

const PFPriceCell = (cellProps: CellContext<CardForecastRow, number>) => {
  const row = cellProps.row.original;

  if (!row.hasPrice) {
    return <span className="text-base-content/40">—</span>;
  }

  const isDimmed = row.excludeFromEv;
  const showChaos = row.divineValue < 1;

  return (
    <span
      className={clsx("font-mono text-sm", isDimmed && "text-base-content/50")}
    >
      {showChaos
        ? `${row.chaosValue.toFixed(1)} c`
        : `${row.divineValue.toFixed(2)} d`}
    </span>
  );
};

export default PFPriceCell;
