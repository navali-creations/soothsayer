import { motion } from "motion/react";
import { GiCardRandom } from "react-icons/gi";
import DivinationCard from "../../../components/DivinationCard/DivinationCard";
import type { CardEntry } from "../../../../types/data-stores";
import type { DivinationCardRow } from "../Cards.types";
import { useBoundStore } from "../../../store/store";

interface CardsGridProps {
  cards: DivinationCardRow[];
}

export const CardsGrid = ({ cards }: CardsGridProps) => {
  const {
    cards: { currentPage, searchQuery, rarityFilter, sortField, sortDirection },
  } = useBoundStore();

  const convertToCardEntry = (card: DivinationCardRow): CardEntry => ({
    name: card.name,
    count: 0, // No count for gallery view
    processedIds: [],
    divinationCard: {
      id: card.id,
      stackSize: card.stackSize,
      description: card.description,
      rewardHtml: card.rewardHtml,
      artSrc: card.artSrc,
      flavourHtml: card.flavourHtml,
      rarity: card.rarity,
    },
  });

  // Create a unique key that changes when filters/page change to force re-animation
  const gridKey = `${currentPage}-${searchQuery}-${rarityFilter}-${sortField}-${sortDirection}`;

  if (cards.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex items-center justify-center h-full"
      >
        <div className="text-center">
          <GiCardRandom className="text-6xl mx-auto mb-4 text-base-content/50" />
          <h2 className="text-xl font-bold mb-2">No Cards Found</h2>
          <p className="text-sm text-base-content/70">
            Try adjusting your filters
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <ul
      key={gridKey}
      className="p-1.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-4 overflow-hidden"
    >
      {cards.map((card) => (
        <li
          key={`${gridKey}-${card.id}`}
          className="flex flex-col items-center gap-2 animation-stagger"
        >
          <div className="w-full flex justify-center">
            <div className="scale-70 origin-top -mb-36">
              <DivinationCard card={convertToCardEntry(card)} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};
