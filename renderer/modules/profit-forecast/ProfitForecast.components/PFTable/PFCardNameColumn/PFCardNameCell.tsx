import { memo, useId, useMemo } from "react";
import { FiEyeOff } from "react-icons/fi";

import CardNameLink from "~/renderer/components/CardNameLink/CardNameLink";
import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { usePopover } from "~/renderer/hooks/usePopover/usePopover";
import type { DivinationCardMetadata } from "~/types/data-stores";

interface PFCardNameCellProps {
  cardName: string;
  cardMetadata?: DivinationCardMetadata | null;
  belowMinPrice?: boolean;
}

const PFCardNameCell = memo(
  ({ cardName, cardMetadata, belowMinPrice }: PFCardNameCellProps) => {
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
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <CardNameLink cardName={cardName} className="no-underline" />
          {belowMinPrice && <BelowMinPriceBadge />}
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center gap-1.5 min-w-0">
          <span ref={triggerRef} className="truncate font-fontin cursor-help">
            <CardNameLink cardName={cardName} />
          </span>
          {belowMinPrice && <BelowMinPriceBadge />}
        </div>

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
    prev.belowMinPrice === next.belowMinPrice &&
    prev.cardMetadata?.artSrc === next.cardMetadata?.artSrc &&
    prev.cardMetadata?.rarity === next.cardMetadata?.rarity,
);

PFCardNameCell.displayName = "PFCardNameCell";

/** Small badge indicating the card is normally hidden by the min price filter. */
const BelowMinPriceBadge = () => (
  <span
    className="inline-flex items-center gap-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] leading-none font-medium bg-base-content/10 text-base-content/50"
    title="This card is hidden by the min price filter"
  >
    <FiEyeOff className="w-2.5 h-2.5" />
    <span>filtered</span>
  </span>
);

export default PFCardNameCell;
