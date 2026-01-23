import type { CellContext } from "@tanstack/react-table";
import { useId } from "react";
import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { usePopover } from "~/renderer/hooks/usePopover";
import { useBoundStore } from "~/renderer/store";
import type { CardEntry } from "../../../../types/data-stores";

const CardNameCell = (cellProps: CellContext<CardEntry, string>) => {
  const {
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();
  const priceSource = getActiveGameViewPriceSource();
  const popoverId = useId();

  const priceInfo =
    priceSource === "stash"
      ? cellProps.row.original.stashPrice
      : cellProps.row.original.exchangePrice;
  const hidePrice = priceInfo?.hidePrice || false;

  const { triggerRef, popoverRef } = usePopover({
    // trigger: "click",
  });

  // Only show popover if divination card data exists
  const hasCardData = !!cellProps.row.original.divinationCard;

  return (
    <>
      <span
        ref={hasCardData ? triggerRef : null}
        className={`font-fontin ${hidePrice ? "opacity-50 line-through" : ""} ${hasCardData ? "cursor-help underline decoration-dotted" : ""}`}
      >
        {cellProps.getValue()}
      </span>

      {hasCardData && (
        <div
          id={popoverId}
          ref={popoverRef}
          popover="manual"
          className="m-0 p-0 border-0 bg-transparent backdrop:bg-black/50"
        >
          <DivinationCard card={cellProps.row.original} />
        </div>
      )}
    </>
  );
};

export default CardNameCell;
