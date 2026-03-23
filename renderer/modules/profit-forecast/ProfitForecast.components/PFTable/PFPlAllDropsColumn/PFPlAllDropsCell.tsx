import type { CellContext } from "@tanstack/react-table";
import clsx from "clsx";

import { useBoundStore } from "~/renderer/store";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import { formatPnLDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFPlAllDropsCell = (cellProps: CellContext<CardForecastRow, number>) => {
  const {
    profitForecast: { chaosToDivineRatio },
  } = useBoundStore();

  const row = cellProps.row.original;

  if (!row.hasPrice) {
    return <span className="text-base-content/40">—</span>;
  }

  const value = cellProps.getValue();
  const isDimmed = row.excludeFromEv;

  return (
    <span
      className={clsx(
        "font-mono text-sm",
        isDimmed
          ? "text-base-content/50"
          : value >= 0
            ? "text-success"
            : "text-error",
      )}
    >
      {formatPnLDivine(value, chaosToDivineRatio)}
    </span>
  );
};

export default PFPlAllDropsCell;
