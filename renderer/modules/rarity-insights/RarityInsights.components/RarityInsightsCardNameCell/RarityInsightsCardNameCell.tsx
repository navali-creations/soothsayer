import { memo, useId, useMemo } from "react";

import CardNameLink from "~/renderer/components/CardNameLink/CardNameLink";
import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { usePopover } from "~/renderer/hooks/usePopover/usePopover";
import { toCardMetadata } from "~/renderer/utils/to-card-metadata";
import type { CardEntry } from "~/types/data-stores";

import type { ComparisonRow } from "../../RarityInsightsComparison.slice/RarityInsightsComparison.slice";

/**
 * Card name cell for the FilterComparison table that shows a DivinationCard
 * popover on hover, matching the behavior of the current-session table.
 */
const RarityInsightsCardNameCell = memo(
  ({ card }: { card: ComparisonRow }) => {
    const popoverId = useId();

    const { triggerRef, popoverRef } = usePopover({
      placement: "right",
      offset: 12,
      scale: 0.75,
    });

    const cardEntry: CardEntry = useMemo(
      () => ({
        name: card.name,
        count: 0,
        divinationCard: toCardMetadata(card),
      }),
      [card],
    );

    return (
      <>
        <span ref={triggerRef} className="font-medium font-fontin cursor-help">
          <CardNameLink cardName={card.name} />
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
    prev.card.id === next.card.id &&
    prev.card.name === next.card.name &&
    prev.card.rarity === next.card.rarity &&
    prev.card.stackSize === next.card.stackSize &&
    prev.card.artSrc === next.card.artSrc,
);

RarityInsightsCardNameCell.displayName = "RarityInsightsCardNameCell";

export default RarityInsightsCardNameCell;
