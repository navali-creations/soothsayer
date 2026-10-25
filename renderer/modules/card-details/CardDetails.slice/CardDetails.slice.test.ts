import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import { makeDivinationCardDTO as makeCard } from "~/renderer/__test-setup__/fixtures";
import {
  type CardDetailsSlice,
  createCardDetailsSlice,
} from "~/renderer/modules/card-details/CardDetails.slice/CardDetails.slice";

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

function makePersonalAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    totalLifetimeDrops: 5,
    totalDecksOpenedAllSessions: 200,
    weight: 500,
    dropTimeline: [],
    leagueDateRanges: [],
    ...overrides,
  };
}

function makeCommunityDropRate(overrides: Record<string, unknown> = {}) {
  return {
    league: "Mirage",
    referenceDropChance: 25 / 121_425,
    dropCount: 2475,
    referenceWeight: 25,
    sampleSize: 4_207_137,
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

    it("has no active route or request owners", () => {
      const state = store.getState().cardDetails;
      expect(state.activeCardKey).toBeNull();
      expect(state.cardDetailsRequestId).toBe(0);
      expect(state.sessionsRequestId).toBe(0);
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

    it("has no community drop rate request in progress", () => {
      const state = store.getState().cardDetails;
      expect(state.communityDropRate).toBeNull();
      expect(state.isLoadingCommunityDropRate).toBe(false);
      expect(state.communityDropRateRequestId).toBe(0);
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
  });

  describe("fetchCommunityDropRate", () => {
    it("stores the community rate returned by IPC", async () => {
      const rate = makeCommunityDropRate();
      electron.cardDetails.getCommunityDropRate.mockResolvedValue(rate);

      await store
        .getState()
        .cardDetails.fetchCommunityDropRate(
          "poe1",
          "Mirage",
          "A Chilling Wind",
        );

      expect(electron.cardDetails.getCommunityDropRate).toHaveBeenCalledWith(
        "poe1",
        "Mirage",
        "A Chilling Wind",
      );
      expect(store.getState().cardDetails.communityDropRate).toEqual(rate);
      expect(store.getState().cardDetails.isLoadingCommunityDropRate).toBe(
        false,
      );
    });

    it("clears the loading state when IPC fails", async () => {
      electron.cardDetails.getCommunityDropRate.mockRejectedValue(
        new Error("offline"),
      );

      await store
        .getState()
        .cardDetails.fetchCommunityDropRate(
          "poe1",
          "Mirage",
          "A Chilling Wind",
        );

      expect(store.getState().cardDetails.communityDropRate).toBeNull();
      expect(store.getState().cardDetails.isLoadingCommunityDropRate).toBe(
        false,
      );
    });

    it("does not let an older league response replace a newer one", async () => {
      let resolveMirage!: (
        value: ReturnType<typeof makeCommunityDropRate>,
      ) => void;
      let resolveStandard!: (
        value: ReturnType<typeof makeCommunityDropRate>,
      ) => void;
      electron.cardDetails.getCommunityDropRate
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveMirage = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveStandard = resolve;
          }),
        );

      const mirageRequest = store
        .getState()
        .cardDetails.fetchCommunityDropRate(
          "poe1",
          "Mirage",
          "A Chilling Wind",
        );
      const standardRequest = store
        .getState()
        .cardDetails.fetchCommunityDropRate(
          "poe1",
          "Standard",
          "A Chilling Wind",
        );

      const standardRate = makeCommunityDropRate({ league: "Standard" });
      resolveStandard(standardRate);
      await standardRequest;
      resolveMirage(makeCommunityDropRate());
      await mirageRequest;

      expect(store.getState().cardDetails.communityDropRate).toEqual(
        standardRate,
      );
    });

    it("does not let an older same-key failure clear a newer success", async () => {
      let rejectOlder!: (reason: Error) => void;
      let resolveNewer!: (
        value: ReturnType<typeof makeCommunityDropRate>,
      ) => void;
      electron.cardDetails.getCommunityDropRate
        .mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            rejectOlder = reject;
          }),
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
        );

      const olderRequest = store
        .getState()
        .cardDetails.fetchCommunityDropRate(
          "poe1",
          "Mirage",
          "A Chilling Wind",
        );
      const newerRequest = store
        .getState()
        .cardDetails.fetchCommunityDropRate(
          "poe1",
          "Mirage",
          "A Chilling Wind",
        );
      const newerRate = makeCommunityDropRate();

      resolveNewer(newerRate);
      await newerRequest;
      rejectOlder(new Error("older request failed"));
      await olderRequest;

      expect(store.getState().cardDetails.communityDropRate).toEqual(newerRate);
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
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      expect(store.getState().cardDetails.isLoadingCard).toBe(true);
      expect(store.getState().cardDetails.isLoadingPersonalAnalytics).toBe(
        true,
      );
      expect(store.getState().cardDetails.isLoadingRelatedCards).toBe(true);
      expect(store.getState().cardDetails.card).toBeNull();
      expect(store.getState().cardDetails.activeCardKey).toBe(
        "poe1:the-doctor",
      );

      resolveIpc(makeResolveResult());
      await promise;
    });

    it("synchronizes the selected league when initialization starts", async () => {
      store.getState().cardDetails.setSelectedLeague("Standard");
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.resolveCardBySlug.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      expect(store.getState().cardDetails.selectedLeague).toBe("all");

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
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      expect(store.getState().cardDetails.card).toBeNull();
      expect(store.getState().cardDetails.personalAnalytics).toBeNull();
      expect(store.getState().cardDetails.relatedCards).toBeNull();

      resolveIpc(makeResolveResult());
      await promise;
    });

    it("keeps matching card metadata visible while analytics refresh", async () => {
      const card = makeCard({
        name: "The Doctor",
        game: "poe1",
      });
      store.setState((state) => {
        state.cardDetails.card = card;
      });
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.resolveCardBySlug.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      expect(store.getState().cardDetails.card).toEqual(card);

      resolveIpc(makeResolveResult());
      await promise;
    });

    it("does not retain matching card metadata from another game", async () => {
      store.setState((state) => {
        state.cardDetails.card = makeCard({
          name: "The Doctor",
          game: "poe2",
        });
      });
      let resolveIpc!: (value: unknown) => void;
      electron.cardDetails.resolveCardBySlug.mockReturnValue(
        new Promise((resolve) => {
          resolveIpc = resolve;
        }),
      );

      const promise = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      expect(store.getState().cardDetails.card).toBeNull();

      resolveIpc(makeResolveResult());
      await promise;
    });

    it("populates card, personalAnalytics, and relatedCards on success", async () => {
      const result = makeResolveResult();
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(result);

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

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
          "all",
          "Settlers",
        );

      expect(electron.cardDetails.resolveCardBySlug).toHaveBeenCalledWith(
        "poe1",
        "the-doctor",
        undefined,
        "Settlers",
      );
    });

    it("passes leagueArg when selectedLeague is not 'all'", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "Necropolis");

      expect(electron.cardDetails.resolveCardBySlug).toHaveBeenCalledWith(
        "poe1",
        "the-doctor",
        "Necropolis",
        "Necropolis",
      );
    });

    it("sets cardError when card is not found (null result)", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(null);

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "nonexistent", "all");

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
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

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
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

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
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");
      expect(store.getState().cardDetails.cardError).toBe("first error");

      // Second call succeeds
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");
      expect(store.getState().cardDetails.cardError).toBeNull();
    });

    it("does not let an older initialization replace a newer card", async () => {
      let resolveOlder!: (value: ReturnType<typeof makeResolveResult>) => void;
      let resolveNewer!: (value: ReturnType<typeof makeResolveResult>) => void;
      electron.cardDetails.resolveCardBySlug
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
        );

      const olderRequest = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-a", "all");
      const newerRequest = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-b", "all");
      const newerResult = makeResolveResult({
        card: makeCard({ name: "Card B" }),
      });

      resolveNewer(newerResult);
      await newerRequest;
      resolveOlder(makeResolveResult({ card: makeCard({ name: "Card A" }) }));
      await olderRequest;

      expect(store.getState().cardDetails.card?.name).toBe("Card B");
    });

    it("ignores an older not-found response", async () => {
      let resolveOlder!: (value: null) => void;
      electron.cardDetails.resolveCardBySlug
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
        )
        .mockResolvedValueOnce(
          makeResolveResult({ card: makeCard({ name: "Card B" }) }),
        );

      const olderRequest = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "missing", "all");
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-b", "all");
      resolveOlder(null);
      await olderRequest;

      expect(store.getState().cardDetails.card?.name).toBe("Card B");
      expect(store.getState().cardDetails.cardError).toBeNull();
    });

    it("ignores an older failed response", async () => {
      let rejectOlder!: (reason: Error) => void;
      electron.cardDetails.resolveCardBySlug
        .mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            rejectOlder = reject;
          }),
        )
        .mockResolvedValueOnce(
          makeResolveResult({ card: makeCard({ name: "Card B" }) }),
        );

      const olderRequest = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-a", "all");
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-b", "all");
      rejectOlder(new Error("old failure"));
      await olderRequest;

      expect(store.getState().cardDetails.card?.name).toBe("Card B");
      expect(store.getState().cardDetails.cardError).toBeNull();
    });

    it("invalidates an in-flight initialization when state is cleared", async () => {
      let resolveRequest!: (
        value: ReturnType<typeof makeResolveResult>,
      ) => void;
      electron.cardDetails.resolveCardBySlug.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      const request = store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");
      store.getState().cardDetails.clearCardDetails();
      resolveRequest(makeResolveResult());
      await request;

      expect(store.getState().cardDetails.card).toBeNull();
    });
  });

  // ─── setSelectedLeague ─────────────────────────────────────────────

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

    it("does not let an older response replace a newer league", async () => {
      let resolveOlder!: (value: ReturnType<typeof makeSessionsPage>) => void;
      let resolveNewer!: (value: ReturnType<typeof makeSessionsPage>) => void;
      electron.sessions.searchByCard
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
        );

      const olderRequest = store
        .getState()
        .cardDetails.fetchSessionsForCard(
          "poe1",
          "The Doctor",
          1,
          5,
          "Standard",
        );
      const newerRequest = store
        .getState()
        .cardDetails.fetchSessionsForCard(
          "poe1",
          "The Doctor",
          1,
          5,
          "Settlers",
        );
      const newerPage = makeSessionsPage({
        sessions: [{ id: "newer", date: "2024-02-01" }],
      });

      resolveNewer(newerPage);
      await newerRequest;
      resolveOlder(
        makeSessionsPage({
          sessions: [{ id: "older", date: "2024-01-01" }],
        }),
      );
      await olderRequest;

      expect(store.getState().cardDetails.sessions).toEqual(newerPage);
    });

    it("does not let an older failure replace a newer response", async () => {
      let rejectOlder!: (reason: Error) => void;
      electron.sessions.searchByCard
        .mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            rejectOlder = reject;
          }),
        )
        .mockResolvedValueOnce(makeSessionsPage());

      const olderRequest = store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor", 1, 5);
      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor", 2, 5);
      rejectOlder(new Error("stale failure"));
      await olderRequest;

      expect(store.getState().cardDetails.sessionsError).toBeNull();
      expect(store.getState().cardDetails.sessionsPage).toBe(2);
    });

    it("invalidates an in-flight request when card details are cleared", async () => {
      let resolveRequest!: (value: ReturnType<typeof makeSessionsPage>) => void;
      electron.sessions.searchByCard.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      const request = store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor");
      store.getState().cardDetails.clearCardDetails();
      resolveRequest(makeSessionsPage());
      await request;

      expect(store.getState().cardDetails.sessions).toBeNull();
      expect(store.getState().cardDetails.isLoadingSessions).toBe(false);
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

  // ─── clearCardDetails ──────────────────────────────────────────────

  describe("clearCardDetails", () => {
    it("resets loaded state while preserving the selected league", async () => {
      // First populate everything
      const result = makeResolveResult();
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(result);
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      const sessionsPage = makeSessionsPage();
      electron.sessions.searchByCard.mockResolvedValue(sessionsPage);
      await store
        .getState()
        .cardDetails.fetchSessionsForCard("poe1", "The Doctor", 2, 5);

      store.getState().cardDetails.setSelectedLeague("Necropolis");
      // Verify state is populated
      expect(store.getState().cardDetails.card).not.toBeNull();
      expect(store.getState().cardDetails.sessions).not.toBeNull();

      // Clear
      store.getState().cardDetails.clearCardDetails();

      const state = store.getState().cardDetails;
      expect(state.card).toBeNull();
      expect(state.isLoadingCard).toBe(false);
      expect(state.cardError).toBeNull();
      expect(state.activeCardKey).toBeNull();
      expect(state.personalAnalytics).toBeNull();
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.personalAnalyticsError).toBeNull();
      expect(state.communityDropRate).toBeNull();
      expect(state.isLoadingCommunityDropRate).toBe(false);
      expect(state.communityDropRateRequestId).toBeGreaterThan(0);
      expect(state.sessions).toBeNull();
      expect(state.isLoadingSessions).toBe(false);
      expect(state.sessionsError).toBeNull();
      expect(state.sessionsPage).toBe(1);
      expect(state.sessionsSortState).toEqual({
        column: "date",
        direction: "desc",
      });
      expect(state.sessionsRequestId).toBeGreaterThan(0);
      expect(state.relatedCards).toBeNull();
      expect(state.isLoadingRelatedCards).toBe(false);
      expect(state.selectedLeague).toBe("Necropolis");
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

      it("uses card PL rarity over poe.ninja rarity", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 2,
            prohibitedLibraryRarity: 1,
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(1);
      });

      it("falls through to card rarity when PL rarity is null", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 1,
            prohibitedLibraryRarity: null,
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(1);
      });

      it("falls through to card rarity when PL rarity is unclassified", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 3,
            prohibitedLibraryRarity: 0,
          }) as any;
        });
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(3);
      });

      it("uses card PL rarity when available", () => {
        store.setState((s) => {
          s.cardDetails.card = makeCard({
            rarity: 4,
            prohibitedLibraryRarity: 2,
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
        });
        // null ?? 0 → 0
        expect(store.getState().cardDetails.getDisplayRarity()).toBe(0);
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

    // ─── getLuckComparison ───────────────────────────────────────────

    describe("getLuckComparison", () => {
      it("returns null when no personalAnalytics", () => {
        expect(store.getState().cardDetails.getLuckComparison(0.05)).toBeNull();
      });

      it("returns null when probability is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics() as any;
        });
        expect(store.getState().cardDetails.getLuckComparison(0)).toBeNull();
      });

      it("returns null when probability is negative", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics() as any;
        });
        expect(
          store.getState().cardDetails.getLuckComparison(-0.05),
        ).toBeNull();
      });

      it("returns edge-case result when totalDecksOpenedAllSessions is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 0,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        // expectedDrops = 0.05 * 0 = 0, but actualDrops defaults to 5
        // so we hit the expectedDrops <= 0 edge case
        expect(result).not.toBeNull();
        expect(result!.expectedDrops).toBe(0);
        expect(result!.actualDrops).toBe(5);
        expect(result!.luckRatio).toBe(Number.POSITIVE_INFINITY);
        expect(result!.label).toBe("∞× luckier");
        expect(result!.color).toBe("success");
        expect(result!.hasSufficientData).toBe(false);
      });

      it("returns luckRatio 1 and 'As expected' when expectedDrops <= 0 and actualDrops is 0", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 0,
            totalLifetimeDrops: 0,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        expect(result).not.toBeNull();
        expect(result!.expectedDrops).toBe(0);
        expect(result!.actualDrops).toBe(0);
        expect(result!.luckRatio).toBe(1);
        expect(result!.label).toBe("As expected");
        expect(result!.color).toBe("warning");
      });

      it("returns informative 'luckier' label when luckRatio >= 1.2", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            weight: 500,
            totalLifetimeDrops: 30,
            totalDecksOpenedAllSessions: 200,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        expect(result).not.toBeNull();
        // expected = 0.05 * 200 = 10, actual = 30, ratio = 3.0
        expect(result!.expectedDrops).toBeCloseTo(10);
        expect(result!.actualDrops).toBe(30);
        expect(result!.luckRatio).toBeCloseTo(3.0);
        expect(result!.label).toBe("3.0× luckier than average");
        expect(result!.color).toBe("success");
      });

      it("returns informative 'below expected' label when luckRatio <= 0.8", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            weight: 500,
            totalLifetimeDrops: 1,
            totalDecksOpenedAllSessions: 200,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        expect(result).not.toBeNull();
        // expected = 0.05 * 200 = 10, actual = 1, ratio = 0.1
        expect(result!.luckRatio).toBeCloseTo(0.1);
        expect(result!.label).toBe("0.1× — below expected");
        expect(result!.color).toBe("error");
      });

      it("returns 'About average' when luckRatio is between 0.8 and 1.2", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            weight: 500,
            totalLifetimeDrops: 10,
            totalDecksOpenedAllSessions: 200,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        expect(result).not.toBeNull();
        // expected = 10, actual = 10, ratio = 1.0
        expect(result!.luckRatio).toBeCloseTo(1.0);
        expect(result!.label).toBe("About average");
        expect(result!.color).toBe("warning");
      });

      it("reports hasSufficientData=true when decks >= 100", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 100,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        expect(result!.hasSufficientData).toBe(true);
      });

      it("reports hasSufficientData=false when decks < 100", () => {
        store.setState((s) => {
          s.cardDetails.personalAnalytics = makePersonalAnalytics({
            totalDecksOpenedAllSessions: 50,
          }) as any;
        });
        const result = store.getState().cardDetails.getLuckComparison(0.05);
        expect(result!.hasSufficientData).toBe(false);
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
        .cardDetails.initializeCardDetails("poe1", "card-a", "all");
      expect(store.getState().cardDetails.card!.name).toBe("Card A");

      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "card-b", "all");
      expect(store.getState().cardDetails.card!.name).toBe("Card B");
    });

    it("clearCardDetails after initialization resets everything", async () => {
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

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

    it("full workflow: init → switch league → clear", async () => {
      // 1. Initialize
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult(),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");
      expect(store.getState().cardDetails.card).not.toBeNull();

      // 2. Switch league
      store.getState().cardDetails.setSelectedLeague("Necropolis");
      expect(store.getState().cardDetails.selectedLeague).toBe("Necropolis");

      // 3. Reinitialize for the new league
      const newAnalytics = makePersonalAnalytics({
        totalLifetimeDrops: 99,
      });
      electron.cardDetails.resolveCardBySlug.mockResolvedValue(
        makeResolveResult({ personalAnalytics: newAnalytics }),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "Necropolis");
      expect(store.getState().cardDetails.personalAnalytics).toEqual(
        newAnalytics,
      );

      // 4. Clear loaded data while preserving the page-local filter
      store.getState().cardDetails.clearCardDetails();
      expect(store.getState().cardDetails.card).toBeNull();
      expect(store.getState().cardDetails.selectedLeague).toBe("Necropolis");
    });

    it("all loading flags are false after clear following a failed init", async () => {
      electron.cardDetails.resolveCardBySlug.mockRejectedValue(
        new Error("fail"),
      );
      await store
        .getState()
        .cardDetails.initializeCardDetails("poe1", "the-doctor", "all");

      store.getState().cardDetails.clearCardDetails();

      const state = store.getState().cardDetails;
      expect(state.isLoadingCard).toBe(false);
      expect(state.isLoadingPersonalAnalytics).toBe(false);
      expect(state.isLoadingSessions).toBe(false);
      expect(state.isLoadingRelatedCards).toBe(false);
    });
  });
});
