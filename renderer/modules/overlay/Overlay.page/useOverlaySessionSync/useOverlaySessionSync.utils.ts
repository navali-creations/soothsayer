import type { SessionCardDelta } from "~/types/data-stores";

import type { SessionData } from "../../Overlay.types";

function applyOverlayCardDelta(
  previous: SessionData,
  delta: SessionCardDelta,
): SessionData {
  const existingIndex = previous.cards.findIndex(
    (card) => card.cardName === delta.cardName,
  );
  const cards = [...previous.cards];

  if (existingIndex >= 0) {
    cards[existingIndex] = {
      ...cards[existingIndex],
      count: delta.newCount,
    };
  } else {
    cards.push({
      cardName: delta.cardName,
      count: delta.newCount,
    });
  }

  const recentDrops = delta.recentDrop
    ? [
        {
          ...delta.recentDrop,
          rarity: delta.recentDrop.rarity ?? 4,
        },
        ...previous.recentDrops,
      ].slice(0, 20)
    : previous.recentDrops;

  return {
    ...previous,
    isActive: true,
    totalCount: delta.totalCount,
    totalProfit: delta.updatedTotals?.totalValue ?? previous.totalProfit,
    chaosToDivineRatio:
      delta.updatedTotals?.chaosToDivineRatio ?? previous.chaosToDivineRatio,
    cards,
    recentDrops,
  };
}

export { applyOverlayCardDelta };
