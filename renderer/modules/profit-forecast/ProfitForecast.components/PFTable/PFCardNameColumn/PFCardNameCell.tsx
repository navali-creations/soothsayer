import { memo, useId, useMemo } from "react";

import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { usePopover } from "~/renderer/hooks/usePopover";
import type { DivinationCardMetadata } from "~/types/data-stores";

interface PFCardNameCellProps {
  cardName: string;
  cardMetadata?: DivinationCardMetadata | null;
}

const PFCardNameCell = memo(
  ({ cardName, cardMetadata }: PFCardNameCellProps) => {
    const popoverId = useId();

    const { triggerRef, popoverRef } = usePopover({
      placement: "right",
      offset: 12,
      scale: 0.75,
    });

    const cardEntry = useMemo(() => {
      if (!cardMetadata) return null;
      return {
        name: cardName,
        count: 0,
        divinationCard: cardMetadata,
      };
    }, [cardName, cardMetadata]);

    if (!cardEntry) {
      return <span className="truncate">{cardName}</span>;
    }

    return (
      <>
        <span
          ref={triggerRef}
          className="truncate font-fontin cursor-help underline decoration-dotted"
        >
          {cardName}
        </span>

        <div
          id={popoverId}
          ref={popoverRef}
          popover="manual"
          className="p-0 border-0 bg-transparent"
        >
          <DivinationCard card={cardEntry} />
        </div>
      </>
    );
  },
  (prev, next) =>
    prev.cardName === next.cardName &&
    prev.cardMetadata?.artSrc === next.cardMetadata?.artSrc &&
    prev.cardMetadata?.rarity === next.cardMetadata?.rarity,
);

PFCardNameCell.displayName = "PFCardNameCell";

export default PFCardNameCell;
