import { describe, expect, it } from "vitest";

import type { SessionCardDelta } from "~/types/data-stores";

import type { SessionData } from "../../Overlay.types";
import { applyOverlayCardDelta } from "./useOverlaySessionSync.utils";

const baseSession: SessionData = {
  isActive: true,
  totalCount: 1,
  totalProfit: 500,
  chaosToDivineRatio: 200,
  cards: [{ cardName: "The Doctor", count: 1 }],
  recentDrops: [],
};

function makeDelta(
  overrides: Partial<SessionCardDelta> = {},
): SessionCardDelta {
  return {
    cardName: "The Doctor",
    newCount: 2,
    totalCount: 2,
    price: { chaosValue: 500, divineValue: 2.5 },
    updatedTotals: {
      totalValue: 1_000,
      netProfit: 990,
      chaosToDivineRatio: 200,
      stackedDeckChaosCost: 5,
      totalDeckCost: 10,
    },
    recentDrop: {
      cardName: "The Doctor",
      rarity: 1,
      price: { chaosValue: 500, divineValue: 2.5 },
    },
    ...overrides,
  };
}

describe("applyOverlayCardDelta", () => {
  it("updates an existing card and prepends its recent drop", () => {
    const result = applyOverlayCardDelta(baseSession, makeDelta());

    expect(result.cards).toEqual([{ cardName: "The Doctor", count: 2 }]);
    expect(result.recentDrops[0]).toMatchObject({
      cardName: "The Doctor",
      rarity: 1,
    });
    expect(result.totalCount).toBe(2);
    expect(result.totalProfit).toBe(1_000);
  });

  it("adds a new card and normalizes a missing rarity", () => {
    const result = applyOverlayCardDelta(
      baseSession,
      makeDelta({
        cardName: "Rain of Chaos",
        newCount: 1,
        recentDrop: {
          cardName: "Rain of Chaos",
          price: null,
        },
      }),
    );

    expect(result.cards).toContainEqual({
      cardName: "Rain of Chaos",
      count: 1,
    });
    expect(result.recentDrops[0].rarity).toBe(4);
  });

  it("preserves zero totals instead of falling back to stale values", () => {
    const result = applyOverlayCardDelta(
      baseSession,
      makeDelta({
        updatedTotals: {
          totalValue: 0,
          netProfit: 0,
          chaosToDivineRatio: 0,
          stackedDeckChaosCost: 0,
          totalDeckCost: 0,
        },
      }),
    );

    expect(result.totalProfit).toBe(0);
    expect(result.chaosToDivineRatio).toBe(0);
  });
});
