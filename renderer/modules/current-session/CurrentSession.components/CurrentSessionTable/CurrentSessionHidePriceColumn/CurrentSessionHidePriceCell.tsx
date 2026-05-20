import type { CellContext } from "@tanstack/react-table";

import { useCurrentSession } from "~/renderer/store";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionHidePriceCell = (
  cellProps: CellContext<CardEntry, string>,
) => {
  const { toggleCardPriceVisibility, getSession } = useCurrentSession();

  const sessionData = getSession();
  const cardName = cellProps.row.original.name;
  const hasSnapshot = !!sessionData?.priceSnapshot;

  const priceInfo = cellProps.row.original.price;
  const hidePrice = priceInfo?.hidePrice || false;

  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={!hidePrice}
        onChange={() => toggleCardPriceVisibility(cardName)}
        disabled={!hasSnapshot || !priceInfo}
        title={
          !hasSnapshot
            ? "Price visibility can only be changed when using snapshot prices"
            : hidePrice
              ? "Price hidden from calculations"
              : "Price included in calculations"
        }
      />
    </div>
  );
};

export default CurrentSessionHidePriceCell;
