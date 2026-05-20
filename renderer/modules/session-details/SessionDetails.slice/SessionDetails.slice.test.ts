import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type {
  AggregatedTimeline,
  DetailedDivinationCardStats,
} from "~/types/data-stores";

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
        price: {
          chaosValue: 1200,
          divineValue: 8,
          totalValue: 2400,
          hidePrice: false,
        },
      },
      {
        name: "Rain of Chaos",
        count: 30,
        price: {
          chaosValue: 1,
          divineValue: 0.007,
          totalValue: 30,
          hidePrice: false,
        },
      },
      {
        name: "The Nurse",
        count: 1,
        price: {
          chaosValue: 600,
          divineValue: 4,
          totalValue: 600,
          hidePrice: true,
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
    ],
    liveEdge: [],
    totalChaosValue: 500,
    totalDivineValue: 3.5,
    totalDrops: 10,
    notableDrops: [],
    ...overrides,
  };
}

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("SessionDetailsSlice", () => {
  it("starts with empty session details state", () => {
    const { sessionDetails } = store.getState();

    expect(sessionDetails.session).toBeNull();
    expect(sessionDetails.timeline).toBeNull();
    expect(sessionDetails.isLoading).toBe(false);
    expect(sessionDetails.error).toBeNull();
  });

  describe("loadSession", () => {
    it("sets isLoading true then false on success", async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(null);

      const promise = store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.isLoading).toBe(true);

      await promise;

      expect(store.getState().sessionDetails.isLoading).toBe(false);
    });

    it("populates session on success", async () => {
      const detail = makeSessionDetail({ totalCount: 99 });
      electron.sessions.getById.mockResolvedValue(detail);
      electron.session.getTimeline.mockResolvedValue(null);

      await store.getState().sessionDetails.loadSession("sess-1");

      expect(store.getState().sessionDetails.session).toBe(detail);
      expect(store.getState().sessionDetails.session?.totalCount).toBe(99);
    });

    it("passes the session id to both IPC requests", async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(makeTimeline());

      await store.getState().sessionDetails.loadSession("sess-abc");

      expect(electron.sessions.getById).toHaveBeenCalledWith("sess-abc");
      expect(electron.session.getTimeline).toHaveBeenCalledWith("sess-abc");
    });

    it("loads the session and timeline", async () => {
      const detail = makeSessionDetail({ totalCount: 99 });
      const timeline = makeTimeline();
      electron.sessions.getById.mockResolvedValue(detail);
      electron.session.getTimeline.mockResolvedValue(timeline);

      const promise = store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.isLoading).toBe(true);

      await promise;

      expect(electron.sessions.getById).toHaveBeenCalledWith("sess-1");
      expect(electron.session.getTimeline).toHaveBeenCalledWith("sess-1");
      expect(store.getState().sessionDetails.session?.totalCount).toBe(99);
      expect(store.getState().sessionDetails.timeline).toBe(timeline);
      expect(store.getState().sessionDetails.isLoading).toBe(false);
      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("sets an error and stops loading when the session request fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockRejectedValue(
        new Error("Session not found"),
      );

      await store.getState().sessionDetails.loadSession("bad-id");

      const { sessionDetails } = store.getState();
      expect(sessionDetails.error).toBe("Session not found");
      expect(sessionDetails.isLoading).toBe(false);
      expect(sessionDetails.session).toBeNull();
      expect(sessionDetails.timeline).toBeNull();
    });

    it("sets isLoading false when the session request fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockRejectedValue(new Error("Session failed"));

      const promise = store.getState().sessionDetails.loadSession("bad-id");
      expect(store.getState().sessionDetails.isLoading).toBe(true);

      await promise;

      expect(store.getState().sessionDetails.isLoading).toBe(false);
    });

    it("clears a previous error before a successful load", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockRejectedValueOnce(new Error("Fail"));
      await store.getState().sessionDetails.loadSession("bad");
      expect(store.getState().sessionDetails.error).toBe("Fail");

      electron.sessions.getById.mockResolvedValueOnce(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValueOnce(null);
      await store.getState().sessionDetails.loadSession("good");

      expect(store.getState().sessionDetails.error).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("clears session, timeline, and error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(makeTimeline());
      await store.getState().sessionDetails.loadSession("sess-1");

      electron.sessions.getById.mockRejectedValueOnce(new Error("Err"));
      await store.getState().sessionDetails.loadSession("bad");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
      expect(store.getState().sessionDetails.timeline).toBeNull();
      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("sets session to null", async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(null);
      await store.getState().sessionDetails.loadSession("sess-1");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
    });

    it("sets error to null", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockRejectedValueOnce(new Error("Err"));
      await store.getState().sessionDetails.loadSession("bad");
      expect(store.getState().sessionDetails.error).toBe("Err");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("clears session, timeline, and error simultaneously", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(makeTimeline());
      await store.getState().sessionDetails.loadSession("sess-1");

      electron.sessions.getById.mockRejectedValueOnce(new Error("Err"));
      await store.getState().sessionDetails.loadSession("bad");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
      expect(store.getState().sessionDetails.timeline).toBeNull();
      expect(store.getState().sessionDetails.error).toBeNull();
    });
  });

  describe("toggleCardPriceVisibility", () => {
    beforeEach(async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(null);
      await store.getState().sessionDetails.loadSession("sess-1");
    });

    it("optimistically toggles the single price hide flag", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor");

      const card = store
        .getState()
        .sessionDetails.session?.cards.find(
          (entry) => entry.name === "The Doctor",
        );

      expect(card?.price?.hidePrice).toBe(true);
      expect(electron.session.updateCardPriceVisibility).toHaveBeenCalledWith(
        "poe1",
        "test-session-id",
        "The Doctor",
        true,
      );
    });

    it("toggles a hidden card back into totals", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Nurse");

      const card = store
        .getState()
        .sessionDetails.session?.cards.find(
          (entry) => entry.name === "The Nurse",
        );
      expect(card?.price?.hidePrice).toBe(false);
    });

    it("reverts the optimistic update when persistence fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.session.updateCardPriceVisibility.mockRejectedValue(
        new Error("Backend failure"),
      );

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor");

      const card = store
        .getState()
        .sessionDetails.session?.cards.find(
          (entry) => entry.name === "The Doctor",
        );
      expect(card?.price?.hidePrice).toBe(false);
    });

    it("does not call the backend when there is no loaded session or matching card", async () => {
      store.getState().sessionDetails.clearSession();
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor");

      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(null);
      await store.getState().sessionDetails.loadSession("sess-1");
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("Missing Card");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("does nothing when session is null", async () => {
      store.getState().sessionDetails.clearSession();

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("does nothing when card is not found in session", async () => {
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("Missing Card");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("calls backend with correct arguments", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor");

      expect(electron.session.updateCardPriceVisibility).toHaveBeenCalledWith(
        "poe1",
        "test-session-id",
        "The Doctor",
        true,
      );
    });
  });

  describe("getters", () => {
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

    it("getSession returns null when no session is loaded", () => {
      expect(store.getState().sessionDetails.getSession()).toBeNull();
    });

    it("getSession returns the loaded session", async () => {
      await loadSession({ totalCount: 77 });

      expect(store.getState().sessionDetails.getSession()?.totalCount).toBe(77);
    });

    it("getTimeline returns the loaded timeline", async () => {
      await loadSession({}, makeTimeline());

      expect(
        store.getState().sessionDetails.getTimeline()?.buckets,
      ).toHaveLength(1);
    });

    it("getIsLoading returns the current loading state", async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      electron.session.getTimeline.mockResolvedValue(null);

      const promise = store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.getIsLoading()).toBe(true);

      await promise;

      expect(store.getState().sessionDetails.getIsLoading()).toBe(false);
    });

    it("getError returns null when there is no error", () => {
      expect(store.getState().sessionDetails.getError()).toBeNull();
    });

    it("getError returns the error message after failure", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      electron.sessions.getById.mockRejectedValue(new Error("Load failed"));

      await store.getState().sessionDetails.loadSession("bad");

      expect(store.getState().sessionDetails.getError()).toBe("Load failed");
    });

    it("returns basic state through getter methods", async () => {
      await loadSession({ totalCount: 77 }, makeTimeline());

      expect(store.getState().sessionDetails.getSession()?.totalCount).toBe(77);
      expect(
        store.getState().sessionDetails.getTimeline()?.buckets,
      ).toHaveLength(1);
      expect(store.getState().sessionDetails.getIsLoading()).toBe(false);
      expect(store.getState().sessionDetails.getError()).toBeNull();
    });

    it("returns empty card data when no session is loaded", () => {
      expect(store.getState().sessionDetails.getCardData()).toEqual([]);
    });

    it("maps flat card prices and sorts cards by count", async () => {
      await loadSession();

      const cards = store.getState().sessionDetails.getCardData();

      expect(cards.map((card) => card.name)).toEqual([
        "Rain of Chaos",
        "The Doctor",
        "The Nurse",
      ]);
      expect(cards.find((card) => card.name === "The Doctor")).toMatchObject({
        chaosValue: 1200,
        totalValue: 2400,
        hidePrice: false,
        ratio: 4,
      });
      expect(cards.find((card) => card.name === "Rain of Chaos")?.ratio).toBe(
        60,
      );
    });

    it("sorts cards by count descending", async () => {
      await loadSession();

      expect(
        store
          .getState()
          .sessionDetails.getCardData()
          .map((card) => card.name),
      ).toEqual(["Rain of Chaos", "The Doctor", "The Nurse"]);
    });

    it("calculates card ratios from the loaded session total", async () => {
      await loadSession();

      const cards = store.getState().sessionDetails.getCardData();

      expect(cards.find((card) => card.name === "The Doctor")?.ratio).toBe(4);
      expect(cards.find((card) => card.name === "Rain of Chaos")?.ratio).toBe(
        60,
      );
    });

    it("preserves divination card metadata in card data", async () => {
      await loadSession({
        cards: [
          {
            name: "The Doctor",
            count: 1,
            divinationCard: {
              id: "poe1_the-doctor",
              stackSize: 8,
              description: "A powerful card",
              rewardHtml: "Headhunter",
              artSrc: "doctor.png",
              flavourHtml: "A taste of power",
              rarity: 1,
              filterRarity: 2,
            },
          } as any,
        ],
      });

      expect(store.getState().sessionDetails.getCardData()[0]).toMatchObject({
        name: "The Doctor",
        divinationCard: {
          id: "poe1_the-doctor",
          stackSize: 8,
          rarity: 1,
          filterRarity: 2,
        },
      });
    });

    it("preserves hidden price flags in card data", async () => {
      await loadSession();

      expect(
        store
          .getState()
          .sessionDetails.getCardData()
          .find((card) => card.name === "The Nurse")?.hidePrice,
      ).toBe(true);
    });

    it("maps unpriced cards to zero values without marking them hidden", async () => {
      await loadSession({
        cards: [
          {
            name: "Unknown Card",
            count: 5,
          } as any,
        ],
      });

      expect(store.getState().sessionDetails.getCardData()).toEqual([
        expect.objectContaining({
          name: "Unknown Card",
          chaosValue: 0,
          totalValue: 0,
          hidePrice: false,
          ratio: 10,
        }),
      ]);
    });

    it("returns flat price snapshot data", async () => {
      await loadSession({
        priceSnapshot: {
          timestamp: "2024-01-01T00:00:00Z",
          stackedDeckChaosCost: 5,
          chaosToDivineRatio: 150,
          cardPrices: {
            "The Doctor": {
              chaosValue: 1200,
              divineValue: 8,
            },
          },
        },
      });

      const result = store.getState().sessionDetails.getPriceData();

      expect(result.chaosToDivineRatio).toBe(150);
      expect(result.cardPrices["The Doctor"].chaosValue).toBe(1200);
    });

    it("returns empty price data when no session is loaded", () => {
      expect(store.getState().sessionDetails.getPriceData()).toEqual({
        chaosToDivineRatio: 0,
        cardPrices: {},
      });
    });

    it("returns empty price data when no price snapshot exists", async () => {
      await loadSession();

      expect(store.getState().sessionDetails.getPriceData()).toEqual({
        chaosToDivineRatio: 0,
        cardPrices: {},
      });
    });

    it("uses persisted totals ratio when snapshot prices are unavailable", async () => {
      await loadSession({
        priceSnapshot: undefined,
        totals: {
          totalValue: 18.47,
          netProfit: -187.53,
          chaosToDivineRatio: 479.16,
          stackedDeckChaosCost: 5.15,
          totalDeckCost: 206,
        },
      });

      expect(store.getState().sessionDetails.getPriceData()).toEqual({
        chaosToDivineRatio: 479.16,
        cardPrices: {},
      });
    });

    it("sums visible card totals only", async () => {
      await loadSession();

      expect(store.getState().sessionDetails.getTotalProfit()).toBe(2430);
    });

    it("excludes hidden cards from total profit", async () => {
      await loadSession({
        cards: [
          {
            name: "Visible",
            count: 1,
            price: {
              chaosValue: 100,
              divineValue: 0.5,
              totalValue: 100,
              hidePrice: false,
            },
          },
          {
            name: "Hidden",
            count: 1,
            price: {
              chaosValue: 1000,
              divineValue: 5,
              totalValue: 1000,
              hidePrice: true,
            },
          },
        ],
      });

      expect(store.getState().sessionDetails.getTotalProfit()).toBe(100);
    });

    it("returns zero total profit when no session is loaded", () => {
      expect(store.getState().sessionDetails.getTotalProfit()).toBe(0);
    });

    it("uses persisted total value when snapshot prices are unavailable", async () => {
      await loadSession({
        priceSnapshot: undefined,
        cards: [
          {
            name: "The Metalsmith's Gift",
            count: 3,
          } as any,
        ],
        totals: {
          totalValue: 18.47,
          netProfit: -187.53,
          chaosToDivineRatio: 479.16,
          stackedDeckChaosCost: 5.15,
          totalDeckCost: 206,
        },
      });

      expect(store.getState().sessionDetails.getTotalProfit()).toBe(18.47);
    });

    it("calculates net profit from the single stacked deck cost", async () => {
      await loadSession({
        totalCount: 3,
        cards: [
          {
            name: "Card A",
            count: 1,
            price: {
              chaosValue: 100,
              divineValue: 0.5,
              totalValue: 100,
              hidePrice: false,
            },
          },
          {
            name: "Card B",
            count: 2,
            price: {
              chaosValue: 50,
              divineValue: 0.25,
              totalValue: 100,
              hidePrice: false,
            },
          },
        ],
        priceSnapshot: {
          timestamp: "2024-01-01T00:00:00Z",
          stackedDeckChaosCost: 10,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });

      const result = store.getState().sessionDetails.getNetProfit();

      expect(result.totalDeckCost).toBe(30);
      expect(result.netProfit).toBe(170);
    });

    it("returns zero deck cost when no session is loaded", () => {
      expect(store.getState().sessionDetails.getNetProfit()).toEqual({
        netProfit: 0,
        totalDeckCost: 0,
      });
    });

    it("uses persisted net profit when snapshot prices are unavailable", async () => {
      await loadSession({
        priceSnapshot: undefined,
        totals: {
          totalValue: 18.47,
          netProfit: -187.53,
          chaosToDivineRatio: 479.16,
          stackedDeckChaosCost: 5.15,
          totalDeckCost: 206,
        },
      });

      expect(store.getState().sessionDetails.getNetProfit()).toEqual({
        netProfit: -187.53,
        totalDeckCost: 206,
      });
    });

    it("uses zero deck cost when there is no price snapshot", async () => {
      await loadSession({
        priceSnapshot: undefined,
        cards: [
          {
            name: "Card A",
            count: 1,
            price: {
              chaosValue: 100,
              divineValue: 0.5,
              totalValue: 100,
              hidePrice: false,
            },
          },
        ],
      });

      expect(store.getState().sessionDetails.getNetProfit()).toEqual({
        netProfit: 100,
        totalDeckCost: 0,
      });
    });

    it("returns the pre-computed duration from the session", async () => {
      await loadSession({ duration: "2h 30m" });

      expect(store.getState().sessionDetails.getDuration()).toBe("2h 30m");
    });

    it("returns dash when no session is loaded", () => {
      expect(store.getState().sessionDetails.getDuration()).toBe("—");
    });

    it("returns dash when the loaded session has no duration", async () => {
      await loadSession({ duration: undefined });

      expect(store.getState().sessionDetails.getDuration()).toBe("—");
    });

    it("returns false when timeline is null", () => {
      expect(store.getState().sessionDetails.getHasTimeline()).toBe(false);
    });

    it("returns false when timeline has no buckets", async () => {
      await loadSession({}, makeTimeline({ buckets: [] }));

      expect(store.getState().sessionDetails.getHasTimeline()).toBe(false);
    });

    it("returns true when timeline has buckets", async () => {
      await loadSession({}, makeTimeline());

      expect(store.getState().sessionDetails.getHasTimeline()).toBe(true);
    });
  });
});
