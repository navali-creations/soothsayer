import clsx from "clsx";
import { memo, useCallback, useMemo } from "react";

import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { getEffectiveRarity } from "~/renderer/utils/get-effective-rarity";
import { toCardMetadata } from "~/renderer/utils/to-card-metadata";
import type { CardEntry, RaritySource } from "~/types/data-stores";

import type { DivinationCardRow } from "../../Cards.types";

export { getEffectiveRarity } from "~/renderer/utils/get-effective-rarity";

export interface CardGridItemProps {
  card: DivinationCardRow;
  raritySource: RaritySource;
  showAllCards: boolean;
  gridKey: string;
  onNavigate: (cardName: string) => void;
}

/**
 * Memoized per-card grid item.
 *
 * Encapsulates the CardEntry conversion and click handler so that unchanged
 * cards skip re-rendering when the parent grid updates.
 */
const CardGridItem = memo(function CardGridItem({
  card,
  raritySource,
  showAllCards,
  gridKey,
  onNavigate,
}: CardGridItemProps) {
  const cardEntry: CardEntry = useMemo(
    () => ({
      name: card.name,
      count: 0,
      processedIds: [],
      divinationCard: toCardMetadata(card, {
        rarity: getEffectiveRarity(card, raritySource),
      }),
    }),
    [card, raritySource],
  );

  const handleClick = useCallback(() => {
    onNavigate(card.name);
  }, [card.name, onNavigate]);

  const isOutOfPool = showAllCards && !card.inPool;

  return (
    <li
      key={`${gridKey}-${card.id}`}
      className={clsx(
        "flex flex-col items-center gap-2 animation-stagger relative",
        isOutOfPool && "opacity-40",
      )}
    >
      {isOutOfPool && (
        <span className="badge badge-sm badge-ghost absolute top-0 z-10 whitespace-nowrap">
          Not in league pool
        </span>
      )}
      <div
        className="w-full flex justify-center cursor-pointer"
        onClick={handleClick}
      >
        <div className="scale-70 origin-top -mb-36">
          <DivinationCard card={cardEntry} />
        </div>
      </div>
    </li>
  );
});

export default CardGridItem;
