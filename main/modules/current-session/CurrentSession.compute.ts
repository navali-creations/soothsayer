import type { SessionPriceSnapshot, SessionTotals } from "~/types/data-stores";

export function buildSessionTotals(
  totalValue: number,
  totalCount: number,
  snapshot: Pick<
    SessionPriceSnapshot,
    "stackedDeckChaosCost" | "chaosToDivineRatio"
  > | null,
  deckPriceOverride: number | null,
): SessionTotals {
  const deckCost = deckPriceOverride ?? snapshot?.stackedDeckChaosCost ?? 0;
  const totalDeckCost = deckCost * totalCount;
  return {
    totalValue,
    netProfit: totalValue - totalDeckCost,
    chaosToDivineRatio: snapshot?.chaosToDivineRatio ?? 0,
    stackedDeckChaosCost: deckCost,
    totalDeckCost,
  };
}
