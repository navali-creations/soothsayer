import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type {
  AggregatedTimeline,
  DetailedDivinationCardStats,
} from "~/types/data-stores";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSessionDetail(
  overrides: Partial<DetailedDivinationCardStats> = {},
): DetailedDivinationCardStats {
  return {
    id: "test-session-id",
    totalCount: 50,
    cards: [
      {
        name: "The Doctor",
        count: 2,
        exchangePrice: {
          chaosValue: 1200,
          divineValue: 8,
          totalValue: 2400,
          hidePrice: false,
        },
        stashPrice: {
          chaosValue: 1100,
          divineValue: 7.3,
          totalValue: 2200,
          hidePrice: false,
        },
      },
      {
        name: "Rain of Chaos",
        count: 30,
        exchangePrice: {
          chaosValue: 1,
          divineValue: 0.007,
          totalValue: 30,
          hidePrice: false,
        },
        stashPrice: {
          chaosValue: 0.8,
          divineValue: 0.005,
          totalValue: 24,
          hidePrice: false,
        },
      },
      {
        name: "The Nurse",
        count: 1,
        exchangePrice: {
          chaosValue: 600,
          divineValue: 4,
          totalValue: 600,
          hidePrice: true,
        },
        stashPrice: {
          chaosValue: 580,
          divineValue: 3.9,
          totalValue: 580,
          hidePrice: false,
        },
      },
    ],
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "2024-01-01T01:00:00Z",
    league: "Settlers",
    ...overrides,
  };
}

function makeTimeline(
  overrides: Partial<AggregatedTimeline> = {},
): AggregatedTimeline {
  return {
    buckets: [
      {
        timestamp: "2024-01-01T00:00:00Z",
        dropCount: 10,
        cumulativeChaosValue: 500,
        cumulativeDivineValue: 3.5,
        topCard: "The Doctor",
        topCardChaosValue: 1200,
      },
      {
        timestamp: "2024-01-01T00:01:00Z",
        dropCount: 20,
        cumulativeChaosValue: 1200,
        cumulativeDivineValue: 8,
        topCard: "Rain of Chaos",
        topCardChaosValue: 1,
      },
    ],
    liveEdge: [],
    totalChaosValue: 1200,
    totalDivineValue: 8,
    totalDrops: 30,
    notableDrops: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("SessionDetailsSlice", () => {
  // ─── Initial State ───────────────────────────────────────────────────

  describe("initial state", () => {
    it("has correct default values", () => {
      const { sessionDetails } = store.getState();
      expect(sessionDetails.session).toBeNull();
      expect(sessionDetails.isLoading).toBe(false);
      expect(sessionDetails.error).toBeNull();
      expect(sessionDetails.priceSource).toBe("exchange");
    });
  });

  // ─── loadSession ─────────────────────────────────────────────────────

  describe("loadSession", () => {
    it("sets isLoading true then false on success", async () => {
      const detail = makeSessionDetail();
      electron.sessions.getById.mockResolvedValue(detail);

      const promise = store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.isLoading).toBe(true);

      await promise;
      expect(store.getState().sessionDetails.isLoading).toBe(false);
    });

    it("populates session on success", async () => {
      const detail = makeSessionDetail({ totalCount: 99 });
      electron.sessions.getById.mockResolvedValue(detail);

      await store.getState().sessionDetails.loadSession("sess-1");

      const session = store.getState().sessionDetails.session;
      expect(session).not.toBeNull();
      expect(session!.totalCount).toBe(99);
    });

    it("passes sessionId to IPC", async () => {
      electron.sessions.getById.mockResolvedValue(null);

      await store.getState().sessionDetails.loadSession("my-session-id");

      expect(electron.sessions.getById).toHaveBeenCalledWith("my-session-id");
    });

    it("clears error before loading", async () => {
      // First: fail
      electron.sessions.getById.mockRejectedValueOnce(new Error("Fail"));
      await store.getState().sessionDetails.loadSession("bad");
      expect(store.getState().sessionDetails.error).toBe("Fail");

      // Second: succeed
      electron.sessions.getById.mockResolvedValueOnce(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("good");
      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("sets error on failure", async () => {
      electron.sessions.getById.mockRejectedValue(
        new Error("Session not found"),
      );

      await store.getState().sessionDetails.loadSession("bad-id");

      const { sessionDetails } = store.getState();
      expect(sessionDetails.error).toBe("Session not found");
      expect(sessionDetails.isLoading).toBe(false);
      expect(sessionDetails.session).toBeNull();
    });

    it("sets isLoading false on failure", async () => {
      electron.sessions.getById.mockRejectedValue(new Error("Boom"));

      await store.getState().sessionDetails.loadSession("bad");

      expect(store.getState().sessionDetails.isLoading).toBe(false);
    });
  });

  // ─── clearSession ────────────────────────────────────────────────────

  describe("clearSession", () => {
    it("sets session to null", async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.session).not.toBeNull();

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
    });

    it("sets error to null", async () => {
      electron.sessions.getById.mockRejectedValue(new Error("Oops"));
      await store.getState().sessionDetails.loadSession("bad");
      expect(store.getState().sessionDetails.error).toBe("Oops");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("clears both session and error simultaneously", async () => {
      // Load a session first
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("sess-1");

      // Manually trigger an error state too (via a failed second load)
      electron.sessions.getById.mockRejectedValueOnce(new Error("Err"));
      await store.getState().sessionDetails.loadSession("bad");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
      expect(store.getState().sessionDetails.error).toBeNull();
    });
  });

  // ─── setPriceSource ──────────────────────────────────────────────────

  describe("setPriceSource", () => {
    it("sets priceSource to stash", () => {
      store.getState().sessionDetails.setPriceSource("stash");

      expect(store.getState().sessionDetails.priceSource).toBe("stash");
    });

    it("sets priceSource to exchange", () => {
      store.getState().sessionDetails.setPriceSource("stash");
      store.getState().sessionDetails.setPriceSource("exchange");

      expect(store.getState().sessionDetails.priceSource).toBe("exchange");
    });

    it("does not affect other state", () => {
      store.getState().sessionDetails.setPriceSource("stash");

      expect(store.getState().sessionDetails.session).toBeNull();
      expect(store.getState().sessionDetails.isLoading).toBe(false);
      expect(store.getState().sessionDetails.error).toBeNull();
    });
  });

  // ─── toggleCardPriceVisibility ────────────────────────────────────────

  describe("toggleCardPriceVisibility", () => {
    beforeEach(async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("sess-1");
    });

    it("optimistically toggles exchangePrice.hidePrice from false to true", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "The Doctor");
      expect(card!.exchangePrice!.hidePrice).toBe(true);
    });

    it("optimistically toggles stashPrice.hidePrice from false to true", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("Rain of Chaos", "stash");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "Rain of Chaos");
      expect(card!.stashPrice!.hidePrice).toBe(true);
    });

    it("toggles exchangePrice.hidePrice from true to false", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      // The Nurse starts with exchangePrice.hidePrice = true
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Nurse", "exchange");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "The Nurse");
      expect(card!.exchangePrice!.hidePrice).toBe(false);
    });

    it("reverts optimistic update on backend error", async () => {
      electron.session.updateCardPriceVisibility.mockRejectedValue(
        new Error("Backend failure"),
      );

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "The Doctor");
      // Should revert back to false
      expect(card!.exchangePrice!.hidePrice).toBe(false);
    });

    it("does nothing when session is null", async () => {
      store.getState().sessionDetails.clearSession();

      // Should not throw
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("does nothing when card is not found in session", async () => {
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility(
          "Nonexistent Card",
          "exchange",
        );

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("calls backend with correct arguments", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      expect(electron.session.updateCardPriceVisibility).toHaveBeenCalledWith(
        "poe1", // activeGame from settings
        "test-session-id", // session id
        "exchange",
        "The Doctor",
        true, // toggled from false -> true
      );
    });
  });

  // ─── Getters (basic) ─────────────────────────────────────────────────

  describe("getters", () => {
    it("getSession returns null when no session loaded", () => {
      expect(store.getState().sessionDetails.getSession()).toBeNull();
    });

    it("getSession returns loaded session", async () => {
      const detail = makeSessionDetail({ totalCount: 77 });
      electron.sessions.getById.mockResolvedValue(detail);
      await store.getState().sessionDetails.loadSession("sess-1");

      const session = store.getState().sessionDetails.getSession();
      expect(session).not.toBeNull();
      expect(session!.totalCount).toBe(77);
    });

    it("getIsLoading returns current loading state", () => {
      expect(store.getState().sessionDetails.getIsLoading()).toBe(false);
    });

    it("getError returns null when no error", () => {
      expect(store.getState().sessionDetails.getError()).toBeNull();
    });

    it("getError returns error message after failure", async () => {
      electron.sessions.getById.mockRejectedValue(new Error("Bad"));
      await store.getState().sessionDetails.loadSession("x");

      expect(store.getState().sessionDetails.getError()).toBe("Bad");
    });

    it("getPriceSource returns current price source", () => {
      expect(store.getState().sessionDetails.getPriceSource()).toBe("exchange");

      store.getState().sessionDetails.setPriceSource("stash");

      expect(store.getState().sessionDetails.getPriceSource()).toBe("stash");
    });
  });

  // ─── Derived Getters ─────────────────────────────────────────────────

  describe("derived getters", () => {
    // Helper to load a session with optional timeline
    async function loadSession(
      sessionOverrides: Partial<DetailedDivinationCardStats> = {},
      timeline: AggregatedTimeline | null = null,
    ) {
      electron.sessions.getById.mockResolvedValue(
        makeSessionDetail(sessionOverrides),
      );
      electron.session.getTimeline.mockResolvedValue(timeline);
      await store.getState().sessionDetails.loadSession("sess-1");
    }

    // ─── getCardData ─────────────────────────────────────────────────

    describe("getCardData", () => {
      it("returns empty array when session is null", () => {
        const result = store.getState().sessionDetails.getCardData();
        expect(result).toEqual([]);
      });

      it("returns cards with exchange prices when priceSource is exchange", async () => {
        await loadSession();

        const cards = store.getState().sessionDetails.getCardData();
        const doctor = cards.find((c) => c.name === "The Doctor");

        expect(doctor).toBeDefined();
        expect(doctor!.chaosValue).toBe(1200);
        expect(doctor!.totalValue).toBe(2400);
        expect(doctor!.hidePrice).toBe(false);
      });

      it("returns cards with stash prices when priceSource is stash", async () => {
        await loadSession();
        store.getState().sessionDetails.setPriceSource("stash");

        const cards = store.getState().sessionDetails.getCardData();
        const doctor = cards.find((c) => c.name === "The Doctor");

        expect(doctor).toBeDefined();
        expect(doctor!.chaosValue).toBe(1100);
        expect(doctor!.totalValue).toBe(2200);
        expect(doctor!.hidePrice).toBe(false);
      });

      it("sorts cards by count descending", async () => {
        await loadSession();

        const cards = store.getState().sessionDetails.getCardData();

        expect(cards[0].name).toBe("Rain of Chaos");
        expect(cards[0].count).toBe(30);
        expect(cards[1].name).toBe("The Doctor");
        expect(cards[1].count).toBe(2);
        expect(cards[2].name).toBe("The Nurse");
        expect(cards[2].count).toBe(1);
      });

      it("calculates ratio correctly", async () => {
        await loadSession();

        const cards = store.getState().sessionDetails.getCardData();

        // Rain of Chaos: 30/50 * 100 = 60
        const rain = cards.find((c) => c.name === "Rain of Chaos");
        expect(rain!.ratio).toBe(60);

        // The Doctor: 2/50 * 100 = 4
        const doctor = cards.find((c) => c.name === "The Doctor");
        expect(doctor!.ratio).toBe(4);

        // The Nurse: 1/50 * 100 = 2
        const nurse = cards.find((c) => c.name === "The Nurse");
        expect(nurse!.ratio).toBe(2);
      });
    });

    // ─── getPriceData ────────────────────────────────────────────────

    describe("getPriceData", () => {
      it("returns zeros when session has no priceSnapshot", async () => {
        await loadSession(); // default fixture has no priceSnapshot

        const result = store.getState().sessionDetails.getPriceData();

        expect(result.chaosToDivineRatio).toBe(0);
        expect(result.cardPrices).toEqual({});
      });

      it("returns exchange data when priceSource is exchange", async () => {
        await loadSession({
          priceSnapshot: {
            timestamp: "2024-01-01T00:00:00Z",
            stackedDeckChaosCost: 5,
            exchange: {
              chaosToDivineRatio: 150,
              cardPrices: {
                "The Doctor": {
                  chaosValue: 1200,
                  divineValue: 8,
                },
              },
            },
            stash: {
              chaosToDivineRatio: 145,
              cardPrices: {
                "The Doctor": {
                  chaosValue: 1100,
                  divineValue: 7.3,
                },
              },
            },
          },
        });

        const result = store.getState().sessionDetails.getPriceData();

        expect(result.chaosToDivineRatio).toBe(150);
        expect(result.cardPrices["The Doctor"].chaosValue).toBe(1200);
      });

      it("returns stash data when priceSource is stash", async () => {
        await loadSession({
          priceSnapshot: {
            timestamp: "2024-01-01T00:00:00Z",
            stackedDeckChaosCost: 5,
            exchange: {
              chaosToDivineRatio: 150,
              cardPrices: {
                "The Doctor": {
                  chaosValue: 1200,
                  divineValue: 8,
                },
              },
            },
            stash: {
              chaosToDivineRatio: 145,
              cardPrices: {
                "The Doctor": {
                  chaosValue: 1100,
                  divineValue: 7.3,
                },
              },
            },
          },
        });
        store.getState().sessionDetails.setPriceSource("stash");

        const result = store.getState().sessionDetails.getPriceData();

        expect(result.chaosToDivineRatio).toBe(145);
        expect(result.cardPrices["The Doctor"].chaosValue).toBe(1100);
      });
    });

    // ─── getTotalProfit ──────────────────────────────────────────────

    describe("getTotalProfit", () => {
      it("returns 0 when no session", () => {
        const result = store.getState().sessionDetails.getTotalProfit();
        expect(result).toBe(0);
      });

      it("sums totalValue of all visible cards", async () => {
        // Load session where all cards are visible (no hidePrice)
        await loadSession({
          totalCount: 3,
          cards: [
            {
              name: "Card A",
              count: 1,
              exchangePrice: {
                chaosValue: 100,
                divineValue: 0.5,
                totalValue: 100,
                hidePrice: false,
              },
              stashPrice: {
                chaosValue: 90,
                divineValue: 0.45,
                totalValue: 90,
                hidePrice: false,
              },
            },
            {
              name: "Card B",
              count: 2,
              exchangePrice: {
                chaosValue: 50,
                divineValue: 0.25,
                totalValue: 100,
                hidePrice: false,
              },
              stashPrice: {
                chaosValue: 45,
                divineValue: 0.2,
                totalValue: 90,
                hidePrice: false,
              },
            },
          ],
        });

        const result = store.getState().sessionDetails.getTotalProfit();

        // 100 + 100 = 200 (exchange prices)
        expect(result).toBe(200);
      });

      it("excludes hidden cards from total", async () => {
        await loadSession();

        // Default fixture: The Nurse has exchangePrice.hidePrice = true (totalValue 600)
        // Visible: The Doctor (2400) + Rain of Chaos (30) = 2430
        const result = store.getState().sessionDetails.getTotalProfit();

        expect(result).toBe(2430);
      });
    });

    // ─── getNetProfit ────────────────────────────────────────────────

    describe("getNetProfit", () => {
      it("returns zero deck cost when no priceSnapshot", async () => {
        await loadSession();

        const result = store.getState().sessionDetails.getNetProfit();

        expect(result.totalDeckCost).toBe(0);
        // Net profit equals total profit when deck cost is 0
        expect(result.netProfit).toBe(
          store.getState().sessionDetails.getTotalProfit(),
        );
      });

      it("calculates net profit as totalProfit minus deck cost", async () => {
        await loadSession({
          totalCount: 3,
          cards: [
            {
              name: "Card A",
              count: 1,
              exchangePrice: {
                chaosValue: 100,
                divineValue: 0.5,
                totalValue: 100,
                hidePrice: false,
              },
              stashPrice: {
                chaosValue: 90,
                divineValue: 0.45,
                totalValue: 90,
                hidePrice: false,
              },
            },
            {
              name: "Card B",
              count: 2,
              exchangePrice: {
                chaosValue: 50,
                divineValue: 0.25,
                totalValue: 100,
                hidePrice: false,
              },
              stashPrice: {
                chaosValue: 45,
                divineValue: 0.2,
                totalValue: 90,
                hidePrice: false,
              },
            },
          ],
          priceSnapshot: {
            timestamp: "2024-01-01T00:00:00Z",
            stackedDeckChaosCost: 10,
            exchange: {
              chaosToDivineRatio: 150,
              cardPrices: {},
            },
            stash: {
              chaosToDivineRatio: 145,
              cardPrices: {},
            },
          },
        });

        const result = store.getState().sessionDetails.getNetProfit();

        // totalProfit = 100 + 100 = 200
        // totalDeckCost = 10 * 3 = 30
        // netProfit = 200 - 30 = 170
        expect(result.totalDeckCost).toBe(30);
        expect(result.netProfit).toBe(170);
      });
    });

    // ─── getDuration ─────────────────────────────────────────────────

    describe("getDuration", () => {
      it("returns pre-computed duration from session", async () => {
        await loadSession({ duration: "2h 30m" });

        const result = store.getState().sessionDetails.getDuration();

        expect(result).toBe("2h 30m");
      });

      it("returns dash when session is null", () => {
        const result = store.getState().sessionDetails.getDuration();

        expect(result).toBe("—");
      });

      it("returns dash when session has no duration", async () => {
        await loadSession({ duration: undefined });

        const result = store.getState().sessionDetails.getDuration();

        expect(result).toBe("—");
      });
    });

    // ─── getHasTimeline ──────────────────────────────────────────────

    describe("getHasTimeline", () => {
      it("returns false when timeline is null", async () => {
        await loadSession({}, null);

        const result = store.getState().sessionDetails.getHasTimeline();

        expect(result).toBe(false);
      });

      it("returns false when timeline has empty buckets", async () => {
        await loadSession({}, makeTimeline({ buckets: [] }));

        const result = store.getState().sessionDetails.getHasTimeline();

        expect(result).toBe(false);
      });

      it("returns true when timeline has buckets", async () => {
        await loadSession({}, makeTimeline());

        const result = store.getState().sessionDetails.getHasTimeline();

        expect(result).toBe(true);
      });
    });
  });
});
