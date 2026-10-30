import type { CellContext } from "@tanstack/react-table";
import clsx from "clsx";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import { useProfitForecast } from "~/renderer/store";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import { formatPnLDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFPlCardOnlyCell = (
  cellProps: CellContext<AppTableFeatures, CardForecastRow, number>,
) => {
  const { chaosToDivineRatio } = useProfitForecast();

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

export default PFPlCardOnlyCell;
