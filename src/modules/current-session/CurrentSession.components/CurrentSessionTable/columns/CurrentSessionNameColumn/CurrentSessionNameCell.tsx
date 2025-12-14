import type { CellContext } from "@tanstack/react-table";
import type { CardEntry } from "../../../../../../../types/data-stores";
import { useBoundStore } from "../../../../../../store/store";

const CurrentSessionNameCell = (cellProps: CellContext<CardEntry, string>) => {
  const {
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();
  const priceSource = getActiveGameViewPriceSource();

  const priceInfo =
    priceSource === "stash"
      ? cellProps.row.original.stashPrice
      : cellProps.row.original.exchangePrice;
  const hidePrice = priceInfo?.hidePrice || false;

  return (
    <span
      className={`font-fontin ${hidePrice ? "opacity-50 line-through" : ""}`}
    >
      {cellProps.getValue()}
    </span>
  );
};

export default CurrentSessionNameCell;
