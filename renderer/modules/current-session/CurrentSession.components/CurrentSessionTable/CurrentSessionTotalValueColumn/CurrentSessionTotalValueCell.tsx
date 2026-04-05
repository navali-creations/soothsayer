import type { CellContext } from "@tanstack/react-table";

import { useCurrentSession, useSettings } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionTotalValueCell = (
  cellProps: CellContext<CardEntry, number>,
) => {
  const { getChaosToDivineRatio } = useCurrentSession();
  const { getActiveGameViewPriceSource } = useSettings();
  const chaosToDivineRatio = getChaosToDivineRatio();
  const priceSource = getActiveGameViewPriceSource();

  const priceInfo =
    priceSource === "stash"
      ? cellProps.row.original.stashPrice
      : cellProps.row.original.exchangePrice;
  const value = priceInfo?.totalValue ?? 0;
  const hidePrice = priceInfo?.hidePrice || false;

  if (value === 0) return <span className="text-base-content/50">N/A</span>;
  return (
    <div
      className={`badge badge-soft ${
        hidePrice ? "badge-warning opacity-50" : "badge-success"
      }`}
    >
      {formatCurrency(value, chaosToDivineRatio)}
      {hidePrice && " (hidden)"}
    </div>
  );
};

export default CurrentSessionTotalValueCell;
