import type { CellContext } from "@tanstack/react-table";
import type { CardEntry } from "../../../../../../../types/data-stores";
import { useBoundStore } from "../../../../../../store/store";

const CurrentSessionHidePriceCell = (
  cellProps: CellContext<CardEntry, string>,
) => {
  const {
    currentSession: { toggleCardPriceVisibility, getSession },
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();

  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();
  const cardName = cellProps.row.original.name;
  const hasSnapshot = !!sessionData?.priceSnapshot;

  // Read hidePrice from the correct price source
  const priceInfo =
    priceSource === "stash"
      ? cellProps.row.original.stashPrice
      : cellProps.row.original.exchangePrice;
  const hidePrice = priceInfo?.hidePrice || false;

  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={!hidePrice}
        onChange={() => toggleCardPriceVisibility(cardName, priceSource)}
        disabled={!hasSnapshot}
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
