import { describe, expect, it } from "vitest";

import type { DetailedDivinationCardStats } from "~/types/data-stores";

import { toOverlaySessionData } from "../Overlay.mapper";

describe("toOverlaySessionData", () => {
  it("maps a current session to renderer-ready overlay data", () => {
    const session: DetailedDivinationCardStats = {
      totalCount: 2,
      totals: {
        totalValue: 100,
        netProfit: 90,
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 5,
        totalDeckCost: 10,
      },
      cards: [{ name: "The Doctor", count: 2 }],
      recentDrops: [
        {
          cardName: "The Doctor",
          rarity: 0,
          price: { chaosValue: 50, divineValue: 0.25 },
        },
      ],
    };

    expect(toOverlaySessionData(session)).toEqual({
      isActive: true,
      totalCount: 2,
      totalProfit: 100,
      chaosToDivineRatio: 200,
      cards: [{ cardName: "The Doctor", count: 2 }],
      recentDrops: [
        {
          cardName: "The Doctor",
          rarity: 0,
          price: { chaosValue: 50, divineValue: 0.25 },
        },
      ],
    });
  });

  it("returns inactive overlay data when no session is active", () => {
    expect(toOverlaySessionData(null)).toEqual({
      isActive: false,
      totalCount: 0,
      totalProfit: 0,
      chaosToDivineRatio: 0,
      cards: [],
      recentDrops: [],
    });
  });

  it("normalizes optional current-session values", () => {
    expect(
      toOverlaySessionData({
        totalCount: 1,
        cards: [{ name: "Rain of Chaos", count: 1 }],
        recentDrops: [
          {
            cardName: "Rain of Chaos",
            price: null,
          },
        ],
      }),
    ).toMatchObject({
      totalProfit: 0,
      chaosToDivineRatio: 0,
      recentDrops: [{ cardName: "Rain of Chaos", rarity: 4, price: null }],
    });
  });
});
