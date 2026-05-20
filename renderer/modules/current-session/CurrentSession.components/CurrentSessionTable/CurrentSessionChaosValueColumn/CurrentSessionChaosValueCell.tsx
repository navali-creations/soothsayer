import type { CellContext } from "@tanstack/react-table";

import { useCurrentSession } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionChaosValueCell = (
  cellProps: CellContext<CardEntry, number>,
) => {
  const { getChaosToDivineRatio } = useCurrentSession();
  const chaosToDivineRatio = getChaosToDivineRatio();

  const priceInfo = cellProps.row.original.price;
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
