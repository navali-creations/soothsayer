import type { CellContext } from "@tanstack/react-table";
import type { CardEntry } from "../../../../../../../types/data-stores";
import { formatCurrency } from "../../../../../../api/poe-ninja";
import { useBoundStore } from "../../../../../../store/store";

const CurrentSessionChaosValueCell = (
  cellProps: CellContext<CardEntry, number>,
) => {
  const {
    currentSession: { getChaosToDivineRatio },
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();
  const chaosToDivineRatio = getChaosToDivineRatio();
  const priceSource = getActiveGameViewPriceSource();

  const priceInfo =
    priceSource === "stash"
      ? cellProps.row.original.stashPrice
      : cellProps.row.original.exchangePrice;
  const value = priceInfo?.chaosValue ?? 0;
  const hidePrice = priceInfo?.hidePrice || false;

  if (value === 0) return <span className="text-base-content/50">N/A</span>;
  return (
    <div className={`badge badge-soft ${hidePrice ? "opacity-50" : ""}`}>
      {formatCurrency(value, chaosToDivineRatio)}
    </div>
  );
};

export default CurrentSessionChaosValueCell;
