import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useCallback } from "react";
import { GiCardRandom } from "react-icons/gi";

import { useCards, useSettings } from "~/renderer/store";
import { cardNameToSlug } from "~/renderer/utils";

import type { DivinationCardRow } from "../../Cards.types";
import CardGridItem from "../CardGridItem/CardGridItem";

interface CardsGridProps {
  cards: DivinationCardRow[];
}

export const CardsGrid = ({ cards }: CardsGridProps) => {
  const navigate = useNavigate();
  const {
    currentPage,
    searchQuery,
    rarityFilter,
    includeBossCards,
    includeDisabledCards,
    showAllCards,
    sortField,
    sortDirection,
  } = useCards();
  const { raritySource } = useSettings();

  const handleNavigate = useCallback(
    (cardName: string) => {
      navigate({
        to: "/cards/$cardSlug",
        params: { cardSlug: cardNameToSlug(cardName) },
      });
    },
    [navigate]
  );

  // Create a unique key that changes when filters/page change to force re-animation
  const gridKey = `${currentPage}-${searchQuery}-${rarityFilter}-${includeBossCards}-${includeDisabledCards}-${showAllCards}-${sortField}-${sortDirection}-${raritySource}`;

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
        <CardGridItem
          key={`${gridKey}-${card.id}`}
          card={card}
          raritySource={raritySource}
          showAllCards={showAllCards}
          gridKey={gridKey}
          onNavigate={handleNavigate}
        />
      ))}
    </ul>
  );
};
