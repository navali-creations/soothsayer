import type { DetailedDivinationCardStats } from "~/types/data-stores";

import type { OverlaySessionDataDTO } from "./Overlay.dto";

function toOverlaySessionData(
  session: DetailedDivinationCardStats | null,
): OverlaySessionDataDTO {
  if (!session) {
    return {
      isActive: false,
      totalCount: 0,
      totalProfit: 0,
      chaosToDivineRatio: 0,
      cards: [],
      recentDrops: [],
    };
  }

  return {
    isActive: true,
    totalCount: session.totalCount,
    totalProfit: session.totals?.totalValue ?? 0,
    chaosToDivineRatio: session.totals?.chaosToDivineRatio ?? 0,
    cards: (session.cards ?? []).map((card) => ({
      cardName: card.name,
      count: card.count,
    })),
    recentDrops: (session.recentDrops ?? []).map((drop) => ({
      ...drop,
      rarity: drop.rarity ?? 4,
    })),
  };
}

export { toOverlaySessionData };
