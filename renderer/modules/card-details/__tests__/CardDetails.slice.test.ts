import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  type CardDetailsSlice,
  createCardDetailsSlice,
} from "~/renderer/modules/card-details/CardDetails.slice";

// ─── Minimal test store (CardDetails only) ─────────────────────────────────

type TestStore = CardDetailsSlice;

function createTestStore() {
  return create<TestStore>()(
    devtools(
      immer((...a) => ({
        ...createCardDetailsSlice(...a),
      })),
      { enabled: false },
    ),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    name: "The Doctor",
    stackSize: 8,
    description: "",
    rewardHtml: "",
    artSrc: "",
    flavourHtml: "",
    rarity: 1 as const,
    filterRarity: null,
    prohibitedLibraryRarity: null,
    fromBoss: false,
    game: "poe1" as const,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function makePersonalAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    totalLifetimeDrops: 5,
    totalDecksOpenedAllSessions: 200,
    dropTimeline: [],
    leagueDateRanges: [],
    prohibitedLibrary: null,
    ...overrides,
  };
}

function makePriceHistory(overrides: Record<string, unknown> = {}) {
  return {
    currentDivineRate: 0.5,
    chaosToDivineRatio: 0.005,
    priceChanges: { "1d": 0.01, "7d": -0.02 },
    history: [],
    ...overrides,
  };
}

function makeRelatedCards(overrides: Record<string, unknown> = {}) {
  return {
    relatedCards: [{ name: "The Nurse", stackSize: 4, rarity: 2 }],
    total: 1,
    ...overrides,
  };
}

function makeResolveResult(overrides: Record<string, unknown> = {}) {
  return {
    card: makeCard(),
    personalAnalytics: makePersonalAnalytics(),
    relatedCards: makeRelatedCards(),
    ...overrides,
  };
}

function makeSessionsPage(overrides: Record<string, unknown> = {}) {
  return {
    sessions: [{ id: "s1", date: "2024-01-01" }],
    total: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    ...overrides,
  };
}

// ─── Test suite ────────────────────────────────────────────────────────────

let store: ReturnType<typeof createTestStore>;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("CardDetails.slice", () => {
  // ─── Initial State ───────────────────────────────────────────────────

  describe("initial state", () => {
    it("has card null", () => {
      expect(store.getState().cardDetails.card).toBeNull();
    });

    it("has isLoadingCard false", () => {
      expect(store.getState().cardDetails.isLoadingCard).toBe(false);
    });

    it("has cardError null", () => {
      expect(store.getState().cardDetails.cardError).toBeNull();
    });

    it("has priceHistory null", () => {
      expect(store.getState().cardDetails.priceHistory).toBeNull();
    });

    it("has isLoadingPriceHistory false", () => {
      expect(store.getState().cardDetails.isLoadingPriceHistory).toBe(false);
    });

    it("has priceHistoryError null", () => {
      expect(store.getState().cardDetails.priceHistoryError).toBeNull();
    });

    it("has personalAnalytics null", () => {
      expect(store.getState().cardDetails.personalAnalytics).toBeNull();
    });

    it("has isLoadingPersonalAnalytics false", () => {
      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        false,
      );
    });

    it("has personalAnalyticsError null", () => {
      expect(store.getState().cardDetails.personalAnalyticsError).toBeNull();
    });

    it("has sessions null", () => {
      expect(store.getState().cardDetails.sessions).toBeNull();
    });

    it("has isLoadingSessions false", () => {
      expect(store.getState().cardDetails.isLoadingSessions).toBe(false);
    });

    it("has sessionsError null", () => {
      expect(store.getState().cardDetails.sessionsError).toBeNull();
    });

    it("has sessionsPage 1", () => {
      expect(store.getState().cardDetails.sessionsPage).toBe(1);
    });

    it('has sessionsSortState { column: "date", direction: "desc" }', () => {
      expect(store.getState().cardDetails.sessionsSortState).toEqual({
        column: "date",
        direction: "desc",
      });
    });

    it("has relatedCards null", () => {
      expect(store.getState().cardDetails.relatedCards).toBeNull();
    });

    it("has isLoadingRelatedCards false", () => {
      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(false);
    });

    it('has selectedLeague "all"', () => {
      expect(store.getState().cardDetails.selectedLeague).toBe("all");
    });

    it("has isLeagueSwitching false", () => {
      expect(store.getState().cardDetails.isLeagueSwitching).toBe(false);
    });

    it('has activeTab "your-data"', () => {
      expect(store.getState().cardDetails.activeTab).toBe("your-data");
    });
  });

  // ─── initializeCardDetails ─────────────────────────────────────────

  describe("initializeCardDetails", () => {
    it("sets loading flags on start", async () => {
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.resolveCardBySlug.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      expect(store.getState().cardDetails.isLoadingCard).toBe(true);
      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        true,
      );
      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(true);
      expect(store.getState().cardDetails.card).toBeNull();

      resolveIpc(makeResolveResult());
      await promise;
    });

    it("clears existing card state on start", async () => {
      // Pre-populate card
      store.setState((s) => {
        s.cardDetails.card = makeCard({ name: "Old Card" }) as any;
        s.cardDetails.personalAnalytics = makePersonalAnalytics() as any;
        s.cardDetails.relatedCards = makeRelatedCards() as any;
      });

      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.resolveCardBySlug.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      expect(store.getState().cardDetails.card).toBeNull();
      expect(store.getState().cardDetails.personalAnalytics).toBeNull();
      expect(store.getState().cardDetails.relatedCards).toBeNull();

      resolveIpc(makeResolveResult());
      await promise;
    });

    it("populates card, personalAnalytics, and relatedCards on success", async () => {
      const result = makeResolveResult();
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(result);

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      const state = store.getState().cardDetails;
      expect(state.card).toEqual(result.card);
      expect(state.personalAnalytics).toEqual(result.personalAnalytics);
      expect(state.relatedCards).toEqual(result.relatedCards);
      expect(state.isLoadingCard).toBe(false);
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.isLoadingRelatedCards).toBe(false);
      expect(state.cardError).toBeNull();
    });

    it("passes leagueArg as undefined when selectedLeague is 'all'", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );

      await store
        .getState()
        .cardDetails.initializeCardDetails(
          "poe1",
          "the-doctor",
          "Settlers",
          "all",
        );

      expect(electron.cardDetails.resolveCardBySlug).toHaveBeenCalledWith(
        "poe1",
        "the-doctor",
        "Settlers",
        undefined,
      );
    });

    it("passes leagueArg when selectedLeague is not 'all'", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );

      await store
        .getState()
        .cardDetails.initializeCardDetails(
          "poe1",
          "the-doctor",
          "Settlers",
          "Necropolis",
        );

      expect(electron.cardDetails.resolveCardBySlug).toHaveBeenCalledWith(
        "poe1",
        "the-doctor",
        "Settlers",
        "Necropolis",
      );
    });

    it("sets cardError when card is not found (null result)", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(null);

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "nonexistent", null, "all");

      const state = store.getState().cardDetails;
      expect(state.card).toBeNull();
      expect(state.cardError).toBe("Card not found");
      expect(state.isLoadingCard).toBe(false);
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.isLoadingRelatedCards).toBe(false);
    });

    it("sets cardError on IPC error", async () => {
      electron.cardDetails.resolveCardBySlug.mockRejectedValue(
        new Error("IPC failure"),
      );

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      const state = store.getState().cardDetails;
      expect(state.card).toBeNull();
      expect(state.cardError).toBe("IPC failure");
      expect(state.isLoadingCard).toBe(false);
    });

    it("uses fallback error message for non-Error throws", async () => {
      electron.cardDetails.resolveCardBySlug.mockRejectedValue(
        "something broke",
      );

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      expect(store.getState().cardDetails.cardError).toBe(
        "Failed to load card details",
      );
    });

    it("clears cardError on new initialization", async () => {
      // First call fails
      electron.cardDetails.resolveCardBySlug.mockRejectedValueOnce(
        new Error("first error"),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");
      expect(store.getState().cardDetails.cardError).toBe("first error");

      // Second call succeeds
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");
      expect(store.getState().cardDetails.cardError).toBeNull();
    });
  });

  // ─── refreshPersonalAnalytics ──────────────────────────────────────

  describe("refreshPersonalAnalytics", () => {
    it("does nothing when plLeague is null", async () => {
      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          null,
          "The Doctor",
          "all",
        );

      expect(electron.cardDetails.getPersonalAnalytics).not.toHaveBeenCalled();
      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        false,
      );
    });

    it("sets loading and leagueSwitching flags on start", async () => {
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.getPersonalAnalytics.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "all",
        );

      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        true,
      );
      expect(store.getState().cardDetails.isLeagueSwitching).toBe(true);

      resolveIpc(makePersonalAnalytics());
      await promise;
    });

    it("populates personalAnalytics on success", async () => {
      const analytics = makePersonalAnalytics({ totalLifetimeDrops: 10 });
      electron.cardDetails.getPersonalAnalytics.mockResolvedValue(analytics);

      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "all",
        );

      const state = store.getState().cardDetails;
      expect(state.personalAnalytics).toEqual(analytics);
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.isLeagueSwitching).toBe(false);
    });

    it("passes leagueArg as undefined when selectedLeague is 'all'", async () => {
      electron.cardDetails.getPersonalAnalytics.mockResolvedValue(
        makePersonalAnalytics(),
      );

      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "all",
        );

      expect(electron.cardDetails.getPersonalAnalytics).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        undefined,
      );
    });

    it("passes specific league when selectedLeague is not 'all'", async () => {
      electron.cardDetails.getPersonalAnalytics.mockResolvedValue(
        makePersonalAnalytics(),
      );

      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "Necropolis",
        );

      expect(electron.cardDetails.getPersonalAnalytics).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "Necropolis",
      );
    });

    it("sets error on failure", async () => {
      electron.cardDetails.getPersonalAnalytics.mockRejectedValue(
        new Error("analytics error"),
      );

      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "all",
        );

      const state = store.getState().cardDetails;
      expect(state.personalAnalyticsError).toBe("analytics error");
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.isLeagueSwitching).toBe(false);
    });

    it("uses fallback error message for non-Error throws", async () => {
      electron.cardDetails.getPersonalAnalytics.mockRejectedValue(42);

      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "all",
        );

      expect(store.getState().cardDetails.personalAnalyticsError).toBe(
        "Failed to load personal analytics",
      );
    });
  });

  // ─── setSelectedLeague / setActiveTab ──────────────────────────────

  describe("setSelectedLeague", () => {
    it("sets the selected league", () => {
      store.getState().cardDetails.setSelectedLeague("Necropolis");
      expect(store.getState().cardDetails.selectedLeague).toBe("Necropolis");
    });

    it("can reset to 'all'", () => {
      store.getState().cardDetails.setSelectedLeague("Necropolis");
      store.getState().cardDetails.setSelectedLeague("all");
      expect(store.getState().cardDetails.selectedLeague).toBe("all");
    });
  });

  describe("setActiveTab", () => {
    it("sets the active tab to market", () => {
      store.getState().cardDetails.setActiveTab("market");
      expect(store.getState().cardDetails.activeTab).toBe("market");
    });

    it("can switch back to your-data", () => {
      store.getState().cardDetails.setActiveTab("market");
      store.getState().cardDetails.setActiveTab("your-data");
      expect(store.getState().cardDetails.activeTab).toBe("your-data");
    });
  });

  // ─── fetchPriceHistory ─────────────────────────────────────────────

  describe("fetchPriceHistory", () => {
    it("sets isLoadingPriceHistory true during fetch", async () => {
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.getPriceHistory.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");

      expect(store.getState().cardDetails.isLoadingPriceHistory).toBe(true);
      expect(store.getState().cardDetails.priceHistoryError).toBeNull();

      resolveIpc(makePriceHistory());
      await promise;

      expect(store.getState().cardDetails.isLoadingPriceHistory).toBe(false);
    });

    it("populates priceHistory on success", async () => {
      const history = makePriceHistory();
      electron.cardDetails.getPriceHistory.mockResolvedValue(history);

      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");

      expect(store.getState().cardDetails.priceHistory).toEqual(history);
    });

    it("calls IPC with correct arguments", async () => {
      electron.cardDetails.getPriceHistory.mockResolvedValue(
        makePriceHistory(),
      );

      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");

      expect(electron.cardDetails.getPriceHistory).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
      );
    });

    it("sets error on failure", async () => {
      electron.cardDetails.getPriceHistory.mockRejectedValue(
        new Error("price fetch error"),
      );

      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");

      const state = store.getState().cardDetails;
      expect(state.priceHistoryError).toBe("price fetch error");
      expect(state.isLoadingPriceHistory).toBe(false);
    });

    it("uses fallback error message for non-Error throws", async () => {
      electron.cardDetails.getPriceHistory.mockRejectedValue(42);

      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");

      expect(store.getState().cardDetails.priceHistoryError).toBe(
        "Failed to load price history",
      );
    });

    it("clears previous error on new fetch", async () => {
      electron.cardDetails.getPriceHistory.mockRejectedValueOnce(
        new Error("old error"),
      );
      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");
      expect(store.getState().cardDetails.priceHistoryError).toBe("old error");

      electron.cardDetails.getPriceHistory.mockResolvedValue(
        makePriceHistory(),
      );
      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");
      expect(store.getState().cardDetails.priceHistoryError).toBeNull();
    });
  });

  // ─── fetchPersonalAnalytics ────────────────────────────────────────

  describe("fetchPersonalAnalytics", () => {
    it("sets loading and leagueSwitching flags", async () => {
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.getPersonalAnalytics.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.fetchPersonalAnalytics("poe1", "Settlers", "The Doctor");

      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        true,
      );
      expect(store.getState().cardDetails.isLeagueSwitching).toBe(true);

      resolveIpc(makePersonalAnalytics());
      await promise;
    });

    it("populates personalAnalytics on success", async () => {
      const analytics = makePersonalAnalytics({ totalLifetimeDrops: 42 });
      electron.cardDetails.getPersonalAnalytics.mockResolvedValue(analytics);

      await store
        .getState()
        .cardDetails.fetchPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "Necropolis",
        );

      expect(store.getState().cardDetails.personalAnalytics).toEqual(analytics);
      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        false,
      );
      expect(store.getState().cardDetails.isLeagueSwitching).toBe(false);
    });

    it("passes selectedLeague to IPC", async () => {
      electron.cardDetails.getPersonalAnalytics.mockResolvedValue(
        makePersonalAnalytics(),
      );

      await store
        .getState()
        .cardDetails.fetchPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "Necropolis",
        );

      expect(electron.cardDetails.getPersonalAnalytics).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "Necropolis",
      );
    });

    it("sets error on failure", async () => {
      electron.cardDetails.getPersonalAnalytics.mockRejectedValue(
        new Error("analytics fail"),
      );

      await store
        .getState()
        .cardDetails.fetchPersonalAnalytics("poe1", "Settlers", "The Doctor");

      expect(store.getState().cardDetails.personalAnalyticsError).toBe(
        "analytics fail",
      );
      expect(store.getState().cardDetails.isLeagueSwitching).toBe(false);
    });

    it("uses fallback error message for non-Error throws", async () => {
      electron.cardDetails.getPersonalAnalytics.mockRejectedValue("unknown");

      await store
        .getState()
        .cardDetails.fetchPersonalAnalytics("poe1", "Settlers", "The Doctor");

      expect(store.getState().cardDetails.personalAnalyticsError).toBe(
        "Failed to load personal analytics",
      );
    });
  });

  // ─── fetchSessionsForCard ──────────────────────────────────────────

  describe("fetchSessionsForCard", () => {
    it("sets loading flag and page", async () => {
      let resolveIpc!: (value: unknown) => void;
      electron.sessions.searchByCard.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor", 2, 5);

      expect(store.getState().cardDetails.isLoadingSessions).toBe(true);
      expect(store.getState().cardDetails.sessionsPage).toBe(2);
      expect(store.getState().cardDetails.sessionsError).toBeNull();

      resolveIpc(makeSessionsPage());
      await promise;
    });

    it("populates sessions on success", async () => {
      const page = makeSessionsPage();
      electron.sessions.searchByCard.mockResolvedValue(page);

      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor");

      expect(store.getState().cardDetails.sessions).toEqual(page);
      expect(store.getState().cardDetails.isLoadingSessions).toBe(false);
    });

    it("passes sort state to IPC call", async () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      await store
        .getState()
        .cardDetails.fetchSessionsForCard(
          "poe1",
          "The Doctor",
          1,
          10,
          "Settlers",
        );

      expect(electron.sessions.searchByCard).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        1,
        10,
        "Settlers",
        "date",
        "desc",
      );
    });

    it("uses default page 1 and pageSize 10 when not provided", async () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor");

      expect(electron.sessions.searchByCard).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        1,
        10,
        undefined,
        "date",
        "desc",
      );
    });

    it("sets error on failure", async () => {
      electron.sessions.searchByCard.mockRejectedValue(
        new Error("sessions error"),
      );

      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor");

      expect(store.getState().cardDetails.sessionsError).toBe("sessions error");
      expect(store.getState().cardDetails.isLoadingSessions).toBe(false);
    });

    it("uses fallback error message for non-Error throws", async () => {
      electron.sessions.searchByCard.mockRejectedValue("bad");

      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor");

      expect(store.getState().cardDetails.sessionsError).toBe(
        "Failed to load sessions",
      );
    });
  });

  // ─── setSessionsSort ───────────────────────────────────────────────

  describe("setSessionsSort", () => {
    it("toggles direction when setting the same column", () => {
      // Default: column=date, direction=desc
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      store
        .getState()
        .cardDetails.setSessionsSort("date", "poe1", "The Doctor");

      expect(store.getState().cardDetails.sessionsSortState).toEqual({
        column: "date",
        direction: "asc",
      });
    });

    it("sets direction to desc when setting a new column", () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      store
        .getState()
        .cardDetails.setSessionsSort("drops", "poe1", "The Doctor");

      expect(store.getState().cardDetails.sessionsSortState).toEqual({
        column: "drops",
        direction: "desc",
      });
    });

    it("resets sessionsPage to 1", () => {
      store.setState((s) => {
        s.cardDetails.sessionsPage = 5;
      });
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      store
        .getState()
        .cardDetails.setSessionsSort("date", "poe1", "The Doctor");

      expect(store.getState().cardDetails.sessionsPage).toBe(1);
    });

    it("re-fetches sessions after updating sort", () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      store
        .getState()
        .cardDetails.setSessionsSort("date", "poe1", "The Doctor", "Settlers");

      expect(electron.sessions.searchByCard).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        1,
        5,
        "Settlers",
        "date",
        "asc",
      );
    });

    it("cycles through sort directions on repeated calls", () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());

      // date desc (initial) → date asc → date desc
      store
        .getState()
        .cardDetails.setSessionsSort("date", "poe1", "The Doctor");
      expect(store.getState().cardDetails.sessionsSortState.direction).toBe(
        "asc",
      );

      store
        .getState()
        .cardDetails.setSessionsSort("date", "poe1", "The Doctor");
      expect(store.getState().cardDetails.sessionsSortState.direction).toBe(
        "desc",
      );
    });
  });

  // ─── fetchRelatedCards ─────────────────────────────────────────────

  describe("fetchRelatedCards", () => {
    it("sets loading flag", async () => {
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.getRelatedCards.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.fetchRelatedCards("poe1", "The Doctor");

      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(true);

      resolveIpc(makeRelatedCards());
      await promise;
    });

    it("populates relatedCards on success", async () => {
      const related = makeRelatedCards();
      electron.cardDetails.getRelatedCards.mockResolvedValue(related);

      await store
        .getState()
        .cardDetails.fetchRelatedCards("poe1", "The Doctor");

      expect(store.getState().cardDetails.relatedCards).toEqual(related);
      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(false);
    });

    it("passes league argument to IPC", async () => {
      electron.cardDetails.getRelatedCards.mockResolvedValue(
        makeRelatedCards(),
      );

      await store
        .getState()
        .cardDetails.fetchRelatedCards("poe1", "The Doctor", "Settlers");

      expect(electron.cardDetails.getRelatedCards).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        "Settlers",
      );
    });

    it("sets relatedCards to null on error", async () => {
      // Pre-populate to verify it gets cleared
      store.setState((s) => {
        s.cardDetails.relatedCards = makeRelatedCards() as any;
      });

      electron.cardDetails.getRelatedCards.mockRejectedValue(
        new Error("related error"),
      );

      await store
        .getState()
        .cardDetails.fetchRelatedCards("poe1", "The Doctor");

      expect(store.getState().cardDetails.relatedCards).toBeNull();
      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(false);
    });

    it("clears loading flag on error", async () => {
      electron.cardDetails.getRelatedCards.mockRejectedValue(new Error("fail"));

      await store
        .getState()
        .cardDetails.fetchRelatedCards("poe1", "The Doctor");

      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(false);
    });
  });

  // ─── clearCardDetails ──────────────────────────────────────────────

  describe("clearCardDetails", () => {
    it("resets all state to initial values", async () => {
      // First populate everything
      const result = makeResolveResult();
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(result);
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      const priceHistory = makePriceHistory();
      electron.cardDetails.getPriceHistory.mockResolvedValue(priceHistory);
      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");

      const sessionsPage = makeSessionsPage();
      electron.sessions.searchByCard.mockResolvedValue(sessionsPage);
      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor", 2, 5);

      store.getState().cardDetails.setSelectedLeague("Necropolis");
      store.getState().cardDetails.setActiveTab("market");

      // Verify state is populated
      expect(store.getState().cardDetails.card).not.toBeNull();
      expect(store.getState().cardDetails.priceHistory).not.toBeNull();
      expect(store.getState().cardDetails.sessions).not.toBeNull();

      // Clear
      store.getState().cardDetails.clearCardDetails();

      const state = store.getState().cardDetails;
      expect(state.card).toBeNull();
      expect(state.isLoadingCard).toBe(false);
      expect(state.cardError).toBeNull();
      expect(state.priceHistory).toBeNull();
      expect(state.isLoadingPriceHistory).toBe(false);
      expect(state.priceHistoryError).toBeNull();
      expect(state.personalAnalytics).toBeNull();
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.personalAnalyticsError).toBeNull();
      expect(state.sessions).toBeNull();
      expect(state.isLoadingSessions).toBe(false);
      expect(state.sessionsError).toBeNull();
      expect(state.sessionsPage).toBe(1);
      expect(state.sessionsSortState).toEqual({
        column: "date",
        direction: "desc",
      });
      expect(state.relatedCards).toBeNull();
      expect(state.isLoadingRelatedCards).toBe(false);
      expect(state.selectedLeague).toBe("all");
      expect(state.isLeagueSwitching).toBe(false);
      expect(state.activeTab).toBe("your-data");
    });

    it("resets sessionsPage that was advanced", async () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());
      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor", 3);

      expect(store.getState().cardDetails.sessionsPage).toBe(3);

      store.getState().cardDetails.clearCardDetails();
      expect(store.getState().cardDetails.sessionsPage).toBe(1);
    });

    it("resets sessionsSortState that was changed", () => {
      electron.sessions.searchByCard.mockResolvedValue(makeSessionsPage());
      store
        .getState()
        .cardDetails.setSessionsSort("drops", "poe1", "The Doctor");

      expect(store.getState().cardDetails.sessionsSortState.column).toBe(
        "drops",
      );

      store.getState().cardDetails.clearCardDetails();
      expect(store.getState().cardDetails.sessionsSortState).toEqual({
        column: "date",
        direction: "desc",
      });
    });
  });

  // ─── Getters ───────────────────────────────────────────────────────

  describe("getters", () => {
    // ─── getDisplayRarity ────────────────────────────────────────────

    describe("getDisplayRarity", () => {
      it("returns 4 (fallback) when no card and no analytics", () => {
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(4);
      });

      it("returns card.rarity when card is set but no PL data", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ rarity: 2 }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(2);
      });

      it("returns card.prohibitedLibraryRarity over card.rarity", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 2,
            prohibitedLibraryRarity: 1,
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(1);
      });

      it("returns personalAnalytics PL rarity over card PL rarity", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 2,
            prohibitedLibraryRarity: 1,
          }) as any;
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 3, weight: 100 },
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(3);
      });

      it("falls through cascade: no analytics PL → no card PL → card rarity", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 1,
            prohibitedLibraryRarity: null,
          }) as any;
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: null,
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(1);
      });

      it("uses card PL rarity when analytics PL is null", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 4,
            prohibitedLibraryRarity: 2,
          }) as any;
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: null,
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(2);
      });

      it("handles rarity 0 as a valid nullish-cascade value", () => {
        // 0 is falsy but not nullish, so ?? does NOT skip it
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 0,
            prohibitedLibraryRarity: null,
          }) as any;
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: null,
          }) as any;
        });
        // null ?? null ?? 0 → 0
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(0);
      });
    });

    // ─── Price getters ───────────────────────────────────────────────

    describe("getPriceHistory", () => {
      it("returns null when no price history", () => {
        expect(store.getState().cardDetails.getPriceHistory()).toBeNull();
      });

      it("returns price history when set", () => {
        const history = makePriceHistory();
        store.setState((s) => {
          s.cardDetails.priceHistory = history as any;
        });
        expect(store.getState().cardDetails.getPriceHistory()).toEqual(history);
      });
    });

    describe("getIsLoadingPriceHistory", () => {
      it("returns false by default", () => {
        expect(store.getState().cardDetails.getIsLoadingPriceHistory()).toBe(
          false,
        );
      });
    });

    describe("getPriceHistoryError", () => {
      it("returns null by default", () => {
        expect(store.getState().cardDetails.getPriceHistoryError()).toBeNull();
      });
    });

    describe("getPriceChanges", () => {
      it("returns empty object when no price history", () => {
        expect(store.getState().cardDetails.getPriceChanges()).toEqual({});
      });

      it("returns priceChanges from price history", () => {
        store.setState((s) => {
          s.cardDetails.priceHistory = makePriceHistory({
            priceChanges: { "1d": 0.05, "7d": -0.1 },
          }) as any;
        });
        expect(store.getState().cardDetails.getPriceChanges()).toEqual({
          "1d": 0.05,
          "7d": -0.1,
        });
      });

      it("returns empty object when priceChanges is undefined", () => {
        store.setState((s) => {
          s.cardDetails.priceHistory = {
            currentDivineRate: 0.5,
            chaosToDivineRatio: 0.005,
            history: [],
          } as any;
        });
        expect(store.getState().cardDetails.getPriceChanges()).toEqual({});
      });
    });

    // ─── getFullSetValue ─────────────────────────────────────────────

    describe("getFullSetValue", () => {
      it("returns null when no card", () => {
        store.setState((s) => {
          s.cardDetails.priceHistory = makePriceHistory() as any;
        });
        expect(store.getState().cardDetails.getFullSetValue()).toBeNull();
      });

      it("returns null when no priceHistory", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard() as any;
        });
        expect(store.getState().cardDetails.getFullSetValue()).toBeNull();
      });

      it("returns null when currentDivineRate is 0", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 8 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0,
          }) as any;
        });
        expect(store.getState().cardDetails.getFullSetValue()).toBeNull();
      });

      it("computes stackSize × currentDivineRate", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 8 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0.5,
          }) as any;
        });
        // 8 × 0.5 = 4.0
        expect(store.getState().cardDetails.getFullSetValue()).toBe(4);
      });

      it("rounds to 2 decimal places", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 3 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0.333,
          }) as any;
        });
        // 3 × 0.333 = 0.999 → Math.round(0.999 * 100) / 100 = 1.0
        expect(store.getState().cardDetails.getFullSetValue()).toBe(1);
      });

      it("handles stackSize 1", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 1 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 2.5,
          }) as any;
        });
        expect(store.getState().cardDetails.getFullSetValue()).toBe(2.5);
      });
    });

    // ─── getFullSetChaosValue ────────────────────────────────────────

    describe("getFullSetChaosValue", () => {
      it("returns null when no card", () => {
        store.setState((s) => {
          s.cardDetails.priceHistory = makePriceHistory() as any;
        });
        expect(store.getState().cardDetails.getFullSetChaosValue()).toBeNull();
      });

      it("returns null when no priceHistory", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard() as any;
        });
        expect(store.getState().cardDetails.getFullSetChaosValue()).toBeNull();
      });

      it("returns null when chaosToDivineRatio is 0", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 8 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0.5,
            chaosToDivineRatio: 0,
          }) as any;
        });
        expect(store.getState().cardDetails.getFullSetChaosValue()).toBeNull();
      });

      it("returns null when currentDivineRate is 0", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 8 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0,
            chaosToDivineRatio: 0.005,
          }) as any;
        });
        expect(store.getState().cardDetails.getFullSetChaosValue()).toBeNull();
      });

      it("computes stackSize × currentDivineRate × (1/chaosToDivineRatio)", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 8 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0.5,
            chaosToDivineRatio: 0.005, // 1 divine = 200 chaos
          }) as any;
        });
        // 0.5 * 8 * (1/0.005) = 4 * 200 = 800
        expect(store.getState().cardDetails.getFullSetChaosValue()).toBe(800);
      });

      it("rounds to nearest integer", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({ stackSize: 3 }) as any;
          s.cardDetails.priceHistory = makePriceHistory({
            currentDivineRate: 0.1,
            chaosToDivineRatio: 0.007, // 1 divine ≈ 142.86 chaos
          }) as any;
        });
        // 0.1 * 3 * (1/0.007) = 0.3 * 142.857 ≈ 42.857 → round = 43
        expect(store.getState().cardDetails.getFullSetChaosValue()).toBe(43);
      });
    });

    // ─── Personal analytics getters ──────────────────────────────────

    describe("getPersonalAnalytics", () => {
      it("returns null when not loaded", () => {
        expect(store.getState().cardDetails.getPersonalAnalytics()).toBeNull();
      });

      it("returns analytics when loaded", () => {
        const analytics = makePersonalAnalytics();
        store.setState((s) => {
          s.cardDetails.personalAnalytics = analytics as any;
        });
        expect(store.getState().cardDetails.getPersonalAnalytics()).toEqual(
          analytics,
        );
      });
    });

    describe("getDropTimeline", () => {
      it("returns empty array when no analytics", () => {
        expect(store.getState().cardDetails.getDropTimeline()).toEqual([]);
      });

      it("returns dropTimeline from analytics", () => {
        const timeline = [
          { date: "2024-01-01", drops: 3 },
          { date: "2024-01-02", drops: 1 },
        ];
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            dropTimeline: timeline,
          }) as any;
        });
        expect(store.getState().cardDetails.getDropTimeline()).toEqual(
          timeline,
        );
      });

      it("returns empty array when dropTimeline is undefined", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = {
            totalLifetimeDrops: 0,
            totalDecksOpenedAllSessions: 0,
          } as any;
        });
        expect(store.getState().cardDetails.getDropTimeline()).toEqual([]);
      });
    });

    describe("getAvailableLeagues", () => {
      it("returns empty array when no analytics", () => {
        expect(store.getState().cardDetails.getAvailableLeagues()).toEqual([]);
      });

      it("returns empty array when no leagueDateRanges", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            leagueDateRanges: null,
          }) as any;
        });
        expect(store.getState().cardDetails.getAvailableLeagues()).toEqual([]);
      });

      it("returns league names from leagueDateRanges", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            leagueDateRanges: [
              {
                name: "Settlers",
                start: "2024-01-01",
                end: "2024-03-01",
              },
              {
                name: "Necropolis",
                start: "2024-04-01",
                end: "2024-06-01",
              },
            ],
          }) as any;
        });
        expect(store.getState().cardDetails.getAvailableLeagues()).toEqual([
          "Settlers",
          "Necropolis",
        ]);
      });

      it("returns empty array for empty leagueDateRanges", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            leagueDateRanges: [],
          }) as any;
        });
        expect(store.getState().cardDetails.getAvailableLeagues()).toEqual([]);
      });
    });

    // ─── getDropProbability ──────────────────────────────────────────

    describe("getDropProbability", () => {
      it("returns null when no analytics", () => {
        expect(
          store.getState().cardDetails.getDropProbability(10000),
        ).toBeNull();
      });

      it("returns null when no prohibitedLibrary data", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: null,
          }) as any;
        });
        expect(
          store.getState().cardDetails.getDropProbability(10000),
        ).toBeNull();
      });

      it("returns null when weight is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 0 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getDropProbability(10000),
        ).toBeNull();
      });

      it("returns null when totalWeight is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });
        expect(store.getState().cardDetails.getDropProbability(0)).toBeNull();
      });

      it("returns null when totalWeight is negative", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getDropProbability(-100),
        ).toBeNull();
      });

      it("computes probability and expectedDecks", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getDropProbability(10000);
        expect(result).not.toBeNull();
        expect(result!.probability).toBe(0.01);
        expect(result!.expectedDecks).toBe(100);
      });

      it("formats dropChanceFormatted as '1 in X'", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });

        const result = store.getState().cardDetails.getDropProbability(10000);
        expect(result!.dropChanceFormatted).toBe("1 in 200");
      });

      it("formats percentFormatted for >= 1%", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 4, weight: 2000 },
          }) as any;
        });

        const result = store.getState().cardDetails.getDropProbability(10000);
        // 2000/10000 = 20%
        expect(result!.percentFormatted).toBe("20.0%");
      });

      it("formats percentFormatted for small percentages (>= 0.01%)", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });

        const result = store.getState().cardDetails.getDropProbability(10000);
        // 50/10000 = 0.5%
        expect(result!.percentFormatted).toBe("0.5000%");
      });

      it("formats percentFormatted with scientific notation for very small values", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 1 },
          }) as any;
        });

        const result = store.getState().cardDetails.getDropProbability(1000000);
        // 1/1000000 = 0.0001% which is < 0.01%
        expect(result!.percentFormatted).toMatch(/e/);
      });

      it("computes correct values for common card", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 4, weight: 5000 },
          }) as any;
        });

        const result = store.getState().cardDetails.getDropProbability(10000);
        expect(result!.probability).toBe(0.5);
        expect(result!.expectedDecks).toBe(2);
        expect(result!.percentFormatted).toBe("50.0%");
      });
    });

    // ─── getEvContribution ───────────────────────────────────────────

    describe("getEvContribution", () => {
      it("returns null when no analytics", () => {
        expect(
          store.getState().cardDetails.getEvContribution(10000, 100),
        ).toBeNull();
      });

      it("returns null when no prohibitedLibrary data", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: null,
          }) as any;
        });
        expect(
          store.getState().cardDetails.getEvContribution(10000, 100),
        ).toBeNull();
      });

      it("returns null when weight is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 0 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getEvContribution(10000, 100),
        ).toBeNull();
      });

      it("returns null when totalWeight is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getEvContribution(0, 100),
        ).toBeNull();
      });

      it("returns null when chaosValue is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getEvContribution(10000, 0),
        ).toBeNull();
      });

      it("returns null when chaosValue is negative", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getEvContribution(10000, -10),
        ).toBeNull();
      });

      it("computes probability × chaosValue", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        // probability = 100/10000 = 0.01
        // ev = 0.01 × 500 = 5.0
        const result = store
          .getState()
          .cardDetails.getEvContribution(10000, 500);
        expect(result).toBe(5);
      });

      it("rounds to 4 decimal places", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 3 },
          }) as any;
        });

        // probability = 3/10000 = 0.0003
        // ev = 0.0003 × 1234 = 0.3702
        const result = store
          .getState()
          .cardDetails.getEvContribution(10000, 1234);
        expect(result).toBe(0.3702);
      });

      it("handles large chaos values", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 10 },
          }) as any;
        });

        // probability = 10/10000 = 0.001
        // ev = 0.001 × 100000 = 100.0
        const result = store
          .getState()
          .cardDetails.getEvContribution(10000, 100000);
        expect(result).toBe(100);
      });
    });

    // ─── getLuckComparison ───────────────────────────────────────────

    describe("getLuckComparison", () => {
      it("returns null when no analytics", () => {
        expect(
          store.getState().cardDetails.getLuckComparison(10000),
        ).toBeNull();
      });

      it("returns null when no prohibitedLibrary data", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: null,
          }) as any;
        });
        expect(
          store.getState().cardDetails.getLuckComparison(10000),
        ).toBeNull();
      });

      it("returns null when weight is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 0 },
          }) as any;
        });
        expect(
          store.getState().cardDetails.getLuckComparison(10000),
        ).toBeNull();
      });

      it("returns null when totalWeight is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            prohibitedLibrary: { rarity: 1, weight: 50 },
          }) as any;
        });
        expect(store.getState().cardDetails.getLuckComparison(0)).toBeNull();
      });

      it("returns hasSufficientData=false when totalDecks < 100", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 50,
            totalLifetimeDrops: 2,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result).not.toBeNull();
        expect(result!.hasSufficientData).toBe(false);
      });

      it("returns hasSufficientData=true when totalDecks >= 100", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 200,
            totalLifetimeDrops: 3,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.hasSufficientData).toBe(true);
      });

      it("returns hasSufficientData=true at exactly 100 decks", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 100,
            totalLifetimeDrops: 1,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.hasSufficientData).toBe(true);
      });

      it("returns 'success' color and luckier label when luckRatio >= 1.2", () => {
        // probability = 100/10000 = 0.01
        // expectedDrops = 1000 * 0.01 = 10
        // actualDrops = 15
        // luckRatio = 15/10 = 1.5
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 1000,
            totalLifetimeDrops: 15,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.luckRatio).toBe(1.5);
        expect(result!.label).toContain("luckier");
        expect(result!.color).toBe("success");
      });

      it("returns 'error' color and below expected label when luckRatio <= 0.8", () => {
        // expectedDrops = 1000 * 0.01 = 10
        // actualDrops = 5
        // luckRatio = 5/10 = 0.5
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 1000,
            totalLifetimeDrops: 5,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.luckRatio).toBe(0.5);
        expect(result!.label).toContain("below expected");
        expect(result!.color).toBe("error");
      });

      it("returns 'warning' color and 'About average' label when ratio is between 0.8 and 1.2", () => {
        // expectedDrops = 1000 * 0.01 = 10
        // actualDrops = 10
        // luckRatio = 10/10 = 1.0
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 1000,
            totalLifetimeDrops: 10,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.luckRatio).toBe(1);
        expect(result!.label).toBe("About average");
        expect(result!.color).toBe("warning");
      });

      it("classifies exactly 0.8 as below expected", () => {
        // expectedDrops = 1000 * 0.01 = 10
        // actualDrops = 8
        // luckRatio = 8/10 = 0.8
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 1000,
            totalLifetimeDrops: 8,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.luckRatio).toBe(0.8);
        expect(result!.color).toBe("error");
      });

      it("classifies exactly 1.2 as luckier", () => {
        // expectedDrops = 1000 * 0.01 = 10
        // actualDrops = 12
        // luckRatio = 12/10 = 1.2
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 1000,
            totalLifetimeDrops: 12,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.luckRatio).toBe(1.2);
        expect(result!.color).toBe("success");
      });

      it("handles edge case when expectedDrops is 0 but actualDrops > 0", () => {
        // totalDecks = 0 → expectedDrops = 0
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 0,
            totalLifetimeDrops: 3,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result).not.toBeNull();
        expect(result!.luckRatio).toBe(Infinity);
        expect(result!.label).toContain("luckier");
        expect(result!.color).toBe("success");
      });

      it("handles edge case when expectedDrops is 0 and actualDrops is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 0,
            totalLifetimeDrops: 0,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result).not.toBeNull();
        expect(result!.luckRatio).toBe(1);
        expect(result!.label).toBe("As expected");
        expect(result!.color).toBe("warning");
      });

      it("computes expectedDrops correctly", () => {
        // probability = 200/10000 = 0.02
        // expectedDrops = 500 * 0.02 = 10.0
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 500,
            totalLifetimeDrops: 10,
            prohibitedLibrary: { rarity: 1, weight: 200 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.expectedDrops).toBe(10);
        expect(result!.actualDrops).toBe(10);
      });

      it("rounds expectedDrops to 2 decimal places", () => {
        // probability = 100/10000 = 0.01
        // expectedDrops = 333 * 0.01 = 3.33
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 333,
            totalLifetimeDrops: 3,
            prohibitedLibrary: { rarity: 1, weight: 100 },
          }) as any;
        });

        const result = store.getState().cardDetails.getLuckComparison(10000);
        expect(result!.expectedDrops).toBe(3.33);
      });
    });
  });

  // ─── Edge Cases / Integration ──────────────────────────────────────

  describe("edge cases / integration", () => {
    it("multiple sequential initializations don't corrupt state", async () => {
      const result1 = makeResolveResult({
        card: makeCard({ name: "Card A" }),
      });
      const result2 = makeResolveResult({
        card: makeCard({ name: "Card B" }),
      });

      electron.cardDetails.resolveCardBySlug
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-a", null, "all");
      expect(store.getState().cardDetails.card!.name).toBe("Card A");

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-b", null, "all");
      expect(store.getState().cardDetails.card!.name).toBe("Card B");
    });

    it("clearCardDetails after initialization resets everything", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      expect(store.getState().cardDetails.card).not.toBeNull();

      store.getState().cardDetails.clearCardDetails();
      expect(store.getState().cardDetails.card).toBeNull();
      expect(store.getState().cardDetails.personalAnalytics).toBeNull();
      expect(store.getState().cardDetails.relatedCards).toBeNull();
    });

    it("getDisplayRarity cascading with rarity 0 (not nullish)", () => {
      store.setState((s) => {
        s.cardDetails.card = makeCard({
          rarity: 0,
          prohibitedLibraryRarity: null,
        }) as any;
        s.cardDetails.personalAnalytics = makePersonalAnalytics({
          prohibitedLibrary: null,
        }) as any;
      });
      // null ?? null ?? 0 → 0 (0 is not nullish)
      expect(store.getState().cardDetails.getDisplayRarity()).toBe(0);
    });

    it("full workflow: init → fetch prices → switch league → clear", async () => {
      // 1. Initialize
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails(
          "poe1",
          "the-doctor",
          "Settlers",
          "all",
        );
      expect(store.getState().cardDetails.card).not.toBeNull();

      // 2. Fetch prices
      electron.cardDetails.getPriceHistory.mockResolvedValue(
        makePriceHistory(),
      );
      await store
        .getState()
        .cardDetails.fetchPriceHistory("poe1", "Settlers", "The Doctor");
      expect(store.getState().cardDetails.priceHistory).not.toBeNull();

      // 3. Switch league
      store.getState().cardDetails.setSelectedLeague("Necropolis");
      expect(store.getState().cardDetails.selectedLeague).toBe("Necropolis");

      // 4. Refresh analytics for new league
      const newAnalytics = makePersonalAnalytics({
        totalLifetimeDrops: 99,
      });
      electron.cardDetails.getPersonalAnalytics.mockResolvedValue(newAnalytics);
      await store
        .getState()
        .cardDetails.refreshPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
          "Necropolis",
        );
      expect(store.getState().cardDetails.personalAnalytics).toEqual(
        newAnalytics,
      );

      // 5. Clear everything
      store.getState().cardDetails.clearCardDetails();
      expect(store.getState().cardDetails.card).toBeNull();
      expect(store.getState().cardDetails.priceHistory).toBeNull();
      expect(store.getState().cardDetails.selectedLeague).toBe("all");
    });

    it("getFullSetValue and getFullSetChaosValue both return null when no data", () => {
      expect(store.getState().cardDetails.getFullSetValue()).toBeNull();
      expect(store.getState().cardDetails.getFullSetChaosValue()).toBeNull();
    });

    it("all loading flags are false after clear following a failed init", async () => {
      electron.cardDetails.resolveCardBySlug.mockRejectedValue(
        new Error("fail"),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", null, "all");

      store.getState().cardDetails.clearCardDetails();

      const state = store.getState().cardDetails;
      expect(state.isLoadingCard).toBe(false);
      expect(state.isLoadingPriceHistory).toBe(false);
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.isLoadingSessions).toBe(false);
      expect(state.isLoadingRelatedCards).toBe(false);
      expect(state.isLeagueSwitching).toBe(false);
    });
  });
});
