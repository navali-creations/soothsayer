import { beforeEach, describe, expect, it } from "vitest";

import { useOverlayStore } from "./Overlay.store";

beforeEach(() => {
  useOverlayStore.setState(useOverlayStore.getInitialState());
});

describe("OverlayStore", () => {
  // ── Initial State ────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has totalCount set to 0", () => {
      expect(useOverlayStore.getState().sessionData.totalCount).toBe(0);
    });

    it("has totalProfit set to 0", () => {
      expect(useOverlayStore.getState().sessionData.totalProfit).toBe(0);
    });

    it("has chaosToDivineRatio set to 0", () => {
      expect(useOverlayStore.getState().sessionData.chaosToDivineRatio).toBe(0);
    });

    it("has priceSource set to 'exchange'", () => {
      expect(useOverlayStore.getState().sessionData.priceSource).toBe(
        "exchange",
      );
    });

    it("has cards as an empty array", () => {
      expect(useOverlayStore.getState().sessionData.cards).toEqual([]);
    });

    it("has recentDrops as an empty array", () => {
      expect(useOverlayStore.getState().sessionData.recentDrops).toEqual([]);
    });

    it("has isActive set to false", () => {
      expect(useOverlayStore.getState().sessionData.isActive).toBe(false);
    });
  });

  // ── Vestigial opacity property ───────────────────────────────────────────

  describe("opacity", () => {
    it("has an opacity property of 0.95", () => {
      const state = useOverlayStore.getState() as Record<string, unknown>;
      expect(state.opacity).toBe(0.95);
    });
  });

  // ── setSessionData ───────────────────────────────────────────────────────

  describe("setSessionData", () => {
    it("replaces sessionData entirely", () => {
      const newData = {
        totalCount: 42,
        totalProfit: 123.45,
        chaosToDivineRatio: 150,
        priceSource: "exchange" as const,
        cards: [{ cardName: "The Doctor", count: 2 }],
        recentDrops: [],
        isActive: true,
      };

      useOverlayStore.getState().setSessionData(newData);

      expect(useOverlayStore.getState().sessionData).toEqual(newData);
    });

    it("sets priceSource to 'stash'", () => {
      const newData = {
        totalCount: 10,
        totalProfit: 50,
        chaosToDivineRatio: 175,
        priceSource: "stash" as const,
        cards: [],
        recentDrops: [],
        isActive: false,
      };

      useOverlayStore.getState().setSessionData(newData);

      expect(useOverlayStore.getState().sessionData.priceSource).toBe("stash");
      expect(useOverlayStore.getState().sessionData).toEqual(newData);
    });

    it("sets non-empty cards and recentDrops arrays", () => {
      const newData = {
        totalCount: 5,
        totalProfit: 300,
        chaosToDivineRatio: 160,
        priceSource: "exchange" as const,
        cards: [
          { cardName: "The Doctor", count: 1 },
          { cardName: "House of Mirrors", count: 3 },
        ],
        recentDrops: [
          {
            cardName: "The Doctor",
            rarity: 1 as const,
            exchangePrice: { chaosValue: 800, divineValue: 5 },
            stashPrice: { chaosValue: 750, divineValue: 4.7 },
          },
          {
            cardName: "Rain of Chaos",
            rarity: 4 as const,
            exchangePrice: { chaosValue: 1, divineValue: 0.006 },
            stashPrice: { chaosValue: 0.5, divineValue: 0.003 },
          },
        ],
        isActive: true,
      };

      useOverlayStore.getState().setSessionData(newData);

      const { sessionData } = useOverlayStore.getState();
      expect(sessionData.cards).toHaveLength(2);
      expect(sessionData.cards[0]).toEqual({
        cardName: "The Doctor",
        count: 1,
      });
      expect(sessionData.cards[1]).toEqual({
        cardName: "House of Mirrors",
        count: 3,
      });
      expect(sessionData.recentDrops).toHaveLength(2);
      expect(sessionData.recentDrops[0].cardName).toBe("The Doctor");
      expect(sessionData.recentDrops[0].rarity).toBe(1);
      expect(sessionData.recentDrops[1].cardName).toBe("Rain of Chaos");
      expect(sessionData.recentDrops[1].exchangePrice.chaosValue).toBe(1);
    });

    it("overwrites previous data when called multiple times", () => {
      const firstData = {
        totalCount: 10,
        totalProfit: 100,
        chaosToDivineRatio: 150,
        priceSource: "exchange" as const,
        cards: [{ cardName: "The Doctor", count: 1 }],
        recentDrops: [],
        isActive: true,
      };

      const secondData = {
        totalCount: 99,
        totalProfit: 9999,
        chaosToDivineRatio: 200,
        priceSource: "stash" as const,
        cards: [{ cardName: "House of Mirrors", count: 7 }],
        recentDrops: [
          {
            cardName: "House of Mirrors",
            rarity: 1 as const,
            exchangePrice: { chaosValue: 5000, divineValue: 30 },
            stashPrice: { chaosValue: 4800, divineValue: 29 },
          },
        ],
        isActive: false,
      };

      useOverlayStore.getState().setSessionData(firstData);
      expect(useOverlayStore.getState().sessionData).toEqual(firstData);

      useOverlayStore.getState().setSessionData(secondData);
      expect(useOverlayStore.getState().sessionData).toEqual(secondData);

      // Verify the first data is fully gone
      expect(useOverlayStore.getState().sessionData.totalCount).toBe(99);
      expect(useOverlayStore.getState().sessionData.priceSource).toBe("stash");
      expect(useOverlayStore.getState().sessionData.cards).toHaveLength(1);
      expect(useOverlayStore.getState().sessionData.cards[0].cardName).toBe(
        "House of Mirrors",
      );
    });
  });
});
