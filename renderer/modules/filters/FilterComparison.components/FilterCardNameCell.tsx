import { useId, useMemo } from "react";

import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { usePopover } from "~/renderer/hooks/usePopover";
import type { CardEntry } from "~/types/data-stores";

import type { ComparisonRow } from "../FilterComparison.slice";

/**
 * Card name cell for the FilterComparison table that shows a DivinationCard
 * popover on hover, matching the behavior of the current-session table.
 *
 * Accepts the row data directly — this is a cell renderer, not a page component.
 */
const FilterCardNameCell = ({ card }: { card: ComparisonRow }) => {
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
      divinationCard: {
        id: card.id,
        stackSize: card.stackSize,
        description: card.description,
        rewardHtml: card.rewardHtml,
        artSrc: card.artSrc,
        flavourHtml: card.flavourHtml,
        rarity: card.rarity,
      },
    }),
    [
      card.id,
      card.name,
      card.stackSize,
      card.description,
      card.rewardHtml,
      card.artSrc,
      card.flavourHtml,
      card.rarity,
    ],
  );

  return (
    <>
      <span
        ref={triggerRef}
        className="font-medium font-fontin cursor-help underline decoration-dotted"
      >
        {card.name}
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
};

export default FilterCardNameCell;
