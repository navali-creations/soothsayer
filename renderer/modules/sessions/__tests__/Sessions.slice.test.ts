import { beforeEach, describe, expect, it } from "vitest";

import type { SessionSummary } from "~/main/modules/sessions";
import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { DetailedDivinationCardStats } from "~/types/data-stores";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSessionSummary(
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    sessionId: "sess-1",
    game: "poe1",
    league: "Settlers",
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "2024-01-01T01:00:00Z",
    durationMinutes: 60,
    totalDecksOpened: 100,
    totalExchangeValue: 500,
    totalStashValue: 480,
    totalExchangeNetProfit: 200,
    totalStashNetProfit: 180,
    exchangeChaosToDivine: 150,
    stashChaosToDivine: 145,
    stackedDeckChaosCost: 3,
    isActive: false,
    ...overrides,
  };
}

function makeSessionDetail(
  overrides: Partial<DetailedDivinationCardStats> = {},
): DetailedDivinationCardStats {
  return {
    totalCount: 50,
    cards: [
      {
        name: "The Doctor",
        count: 2,
        exchangePrice: { chaosValue: 1200, divineValue: 8, totalValue: 2400 },
        stashPrice: { chaosValue: 1100, divineValue: 7.3, totalValue: 2200 },
      },
      {
        name: "Rain of Chaos",
        count: 30,
        exchangePrice: { chaosValue: 1, divineValue: 0.007, totalValue: 30 },
        stashPrice: { chaosValue: 0.8, divineValue: 0.005, totalValue: 24 },
      },
    ],
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "2024-01-01T01:00:00Z",
    league: "Settlers",
    ...overrides,
  };
}

function makePageResponse(
  sessions: SessionSummary[],
  overrides: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  } = {},
) {
  return {
    sessions,
    total: overrides.total ?? sessions.length,
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 20,
    totalPages: overrides.totalPages ?? 1,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("SessionsSlice", () => {
  // ─── Initial State ─────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has correct default values", () => {
      const { sessions } = store.getState();
      expect(sessions.allSessions).toEqual([]);
      expect(sessions.currentSessionDetail).toBeNull();
      expect(sessions.isLoading).toBe(false);
      expect(sessions.error).toBeNull();
      expect(sessions.currentPage).toBe(1);
      expect(sessions.pageSize).toBe(20);
      expect(sessions.totalPages).toBe(0);
      expect(sessions.totalSessions).toBe(0);
      expect(sessions.selectedLeague).toBe("all");
      expect(sessions.searchQuery).toBe("");
    });
  });

  // ─── loadAllSessions ──────────────────────────────────────────────────

  describe("loadAllSessions", () => {
    it("sets isLoading true then false on success", async () => {
      const sessionsList = [makeSessionSummary()];
      const response = makePageResponse(sessionsList, {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      electron.sessions.getAll.mockResolvedValue(response);

      const promise = store.getState().sessions.loadAllSessions();
      expect(store.getState().sessions.isLoading).toBe(true);

      await promise;
      expect(store.getState().sessions.isLoading).toBe(false);
    });

    it("populates allSessions and pagination state on success", async () => {
      const sessionsList = [
        makeSessionSummary({ sessionId: "s1" }),
        makeSessionSummary({ sessionId: "s2" }),
      ];
      const response = makePageResponse(sessionsList, {
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });

      electron.sessions.getAll.mockResolvedValue(response);

      await store.getState().sessions.loadAllSessions(2);

      const { sessions } = store.getState();
      expect(sessions.allSessions).toHaveLength(2);
      expect(sessions.allSessions[0].sessionId).toBe("s1");
      expect(sessions.currentPage).toBe(2);
      expect(sessions.pageSize).toBe(10);
      expect(sessions.totalPages).toBe(3);
      expect(sessions.totalSessions).toBe(25);
    });

    it("passes activeGame, page, and pageSize to IPC", async () => {
      const response = makePageResponse([]);
      electron.sessions.getAll.mockResolvedValue(response);

      store = createTestStore({
        settings: { selectedGame: "poe2" },
      });

      await store.getState().sessions.loadAllSessions(3);

      expect(electron.sessions.getAll).toHaveBeenCalledWith("poe2", 3, 20);
    });

    it("uses currentPage when page argument is omitted", async () => {
      const response = makePageResponse([]);
      electron.sessions.getAll.mockResolvedValue(response);

      // Set page to 5 first
      store = createTestStore({
        sessions: { currentPage: 5 },
      });

      await store.getState().sessions.loadAllSessions();

      expect(electron.sessions.getAll).toHaveBeenCalledWith("poe1", 5, 20);
    });

    it("sets error on failure", async () => {
      electron.sessions.getAll.mockRejectedValue(new Error("Network failure"));

      await store.getState().sessions.loadAllSessions();

      const { sessions } = store.getState();
      expect(sessions.error).toBe("Network failure");
      expect(sessions.isLoading).toBe(false);
    });

    it("clears previous error on new load", async () => {
      // First: fail
      electron.sessions.getAll.mockRejectedValueOnce(new Error("First error"));
      await store.getState().sessions.loadAllSessions();
      expect(store.getState().sessions.error).toBe("First error");

      // Second: succeed
      electron.sessions.getAll.mockResolvedValueOnce(makePageResponse([]));
      await store.getState().sessions.loadAllSessions();
      expect(store.getState().sessions.error).toBeNull();
    });
  });

  // ─── loadSessionDetail ────────────────────────────────────────────────

  describe("loadSessionDetail", () => {
    it("sets isLoading true then false on success", async () => {
      const detail = makeSessionDetail();
      electron.sessions.getById.mockResolvedValue(detail);

      const promise = store.getState().sessions.loadSessionDetail("sess-1");
      expect(store.getState().sessions.isLoading).toBe(true);

      await promise;
      expect(store.getState().sessions.isLoading).toBe(false);
    });

    it("populates currentSessionDetail on success", async () => {
      const detail = makeSessionDetail({ totalCount: 75 });
      electron.sessions.getById.mockResolvedValue(detail);

      await store.getState().sessions.loadSessionDetail("sess-1");

      expect(store.getState().sessions.currentSessionDetail).not.toBeNull();
      expect(store.getState().sessions.currentSessionDetail!.totalCount).toBe(
        75,
      );
    });

    it("passes sessionId to IPC", async () => {
      electron.sessions.getById.mockResolvedValue(null);

      await store.getState().sessions.loadSessionDetail("my-session-id");

      expect(electron.sessions.getById).toHaveBeenCalledWith("my-session-id");
    });

    it("sets error on failure", async () => {
      electron.sessions.getById.mockRejectedValue(
        new Error("Session not found"),
      );

      await store.getState().sessions.loadSessionDetail("bad-id");

      const { sessions } = store.getState();
      expect(sessions.error).toBe("Session not found");
      expect(sessions.isLoading).toBe(false);
      expect(sessions.currentSessionDetail).toBeNull();
    });

    it("clears error before loading", async () => {
      // First: error
      electron.sessions.getById.mockRejectedValueOnce(new Error("Oops"));
      await store.getState().sessions.loadSessionDetail("bad");
      expect(store.getState().sessions.error).toBe("Oops");

      // Second: success
      electron.sessions.getById.mockResolvedValueOnce(makeSessionDetail());
      await store.getState().sessions.loadSessionDetail("good");
      expect(store.getState().sessions.error).toBeNull();
    });
  });

  // ─── clearSessionDetail ───────────────────────────────────────────────

  describe("clearSessionDetail", () => {
    it("sets currentSessionDetail to null", async () => {
      const detail = makeSessionDetail();
      electron.sessions.getById.mockResolvedValue(detail);
      await store.getState().sessions.loadSessionDetail("sess-1");
      expect(store.getState().sessions.currentSessionDetail).not.toBeNull();

      store.getState().sessions.clearSessionDetail();

      expect(store.getState().sessions.currentSessionDetail).toBeNull();
    });
  });

  // ─── setPage ──────────────────────────────────────────────────────────

  describe("setPage", () => {
    it("sets currentPage and calls loadAllSessions with the new page", async () => {
      electron.sessions.getAll.mockResolvedValue(makePageResponse([]));

      store.getState().sessions.setPage(3);

      expect(store.getState().sessions.currentPage).toBe(3);
      expect(electron.sessions.getAll).toHaveBeenCalledWith("poe1", 3, 20);
    });
  });

  // ─── setPageSize ──────────────────────────────────────────────────────

  describe("setPageSize", () => {
    it("sets pageSize, resets to page 1, and calls loadAllSessions", async () => {
      // Start on page 3
      store = createTestStore({
        sessions: { currentPage: 3 },
      });

      electron.sessions.getAll.mockResolvedValue(makePageResponse([]));

      store.getState().sessions.setPageSize(50);

      expect(store.getState().sessions.pageSize).toBe(50);
      expect(store.getState().sessions.currentPage).toBe(1);
      expect(electron.sessions.getAll).toHaveBeenCalledWith("poe1", 1, 50);
    });
  });

  // ─── setSelectedLeague ────────────────────────────────────────────────

  describe("setSelectedLeague", () => {
    it("sets selectedLeague, resets to page 1, and calls loadAllSessions", async () => {
      store = createTestStore({
        sessions: { currentPage: 5 },
      });

      electron.sessions.getAll.mockResolvedValue(makePageResponse([]));

      store.getState().sessions.setSelectedLeague("Necropolis");

      expect(store.getState().sessions.selectedLeague).toBe("Necropolis");
      expect(store.getState().sessions.currentPage).toBe(1);
      expect(electron.sessions.getAll).toHaveBeenCalledWith("poe1", 1, 20);
    });
  });

  // ─── setSearchQuery ───────────────────────────────────────────────────

  describe("setSearchQuery", () => {
    it("sets searchQuery", () => {
      store.getState().sessions.setSearchQuery("Doctor");

      expect(store.getState().sessions.searchQuery).toBe("Doctor");
    });

    it("can clear searchQuery", () => {
      store.getState().sessions.setSearchQuery("Doctor");
      store.getState().sessions.setSearchQuery("");

      expect(store.getState().sessions.searchQuery).toBe("");
    });
  });

  // ─── searchSessions ──────────────────────────────────────────────────

  describe("searchSessions", () => {
    it("sets isLoading true then false on success", async () => {
      electron.sessions.searchByCard.mockResolvedValue(makePageResponse([]));

      const promise = store.getState().sessions.searchSessions("The Doctor");
      expect(store.getState().sessions.isLoading).toBe(true);

      await promise;
      expect(store.getState().sessions.isLoading).toBe(false);
    });

    it("populates sessions from search results", async () => {
      const sessionsList = [
        makeSessionSummary({ sessionId: "s1", cardCount: 3 }),
        makeSessionSummary({ sessionId: "s2", cardCount: 1 }),
      ];
      const response = makePageResponse(sessionsList, {
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      electron.sessions.searchByCard.mockResolvedValue(response);

      await store.getState().sessions.searchSessions("The Doctor");

      const { sessions } = store.getState();
      expect(sessions.allSessions).toHaveLength(2);
      expect(sessions.totalSessions).toBe(2);
    });

    it("passes activeGame, cardName, page, and pageSize to IPC", async () => {
      electron.sessions.searchByCard.mockResolvedValue(makePageResponse([]));

      store = createTestStore({
        settings: { selectedGame: "poe2" },
        sessions: { pageSize: 10 },
      });

      await store.getState().sessions.searchSessions("Rain of Chaos", 2);

      expect(electron.sessions.searchByCard).toHaveBeenCalledWith(
        "poe2",
        "Rain of Chaos",
        2,
        10,
      );
    });

    it("uses currentPage when page argument is omitted", async () => {
      electron.sessions.searchByCard.mockResolvedValue(makePageResponse([]));

      store = createTestStore({
        sessions: { currentPage: 4 },
      });

      await store.getState().sessions.searchSessions("The Nurse");

      expect(electron.sessions.searchByCard).toHaveBeenCalledWith(
        "poe1",
        "The Nurse",
        4,
        20,
      );
    });

    it("sets error on failure", async () => {
      electron.sessions.searchByCard.mockRejectedValue(
        new Error("Search failed"),
      );

      await store.getState().sessions.searchSessions("The Doctor");

      const { sessions } = store.getState();
      expect(sessions.error).toBe("Search failed");
      expect(sessions.isLoading).toBe(false);
    });
  });

  // ─── Getters ──────────────────────────────────────────────────────────

  describe("getters", () => {
    it("getAllSessions returns allSessions", async () => {
      const sessionsList = [makeSessionSummary({ sessionId: "s1" })];
      electron.sessions.getAll.mockResolvedValue(
        makePageResponse(sessionsList),
      );

      await store.getState().sessions.loadAllSessions();

      expect(store.getState().sessions.getAllSessions()).toHaveLength(1);
      expect(store.getState().sessions.getAllSessions()[0].sessionId).toBe(
        "s1",
      );
    });

    it("getSessionDetail returns currentSessionDetail", async () => {
      expect(store.getState().sessions.getSessionDetail()).toBeNull();

      electron.sessions.getById.mockResolvedValue(
        makeSessionDetail({ totalCount: 42 }),
      );
      await store.getState().sessions.loadSessionDetail("x");

      expect(store.getState().sessions.getSessionDetail()!.totalCount).toBe(42);
    });

    it("getIsLoading returns isLoading", () => {
      expect(store.getState().sessions.getIsLoading()).toBe(false);
    });

    it("getError returns error", () => {
      expect(store.getState().sessions.getError()).toBeNull();
    });

    it("getCurrentPage returns currentPage", () => {
      expect(store.getState().sessions.getCurrentPage()).toBe(1);
    });

    it("getPageSize returns pageSize", () => {
      expect(store.getState().sessions.getPageSize()).toBe(20);
    });

    it("getTotalPages returns totalPages", () => {
      expect(store.getState().sessions.getTotalPages()).toBe(0);
    });

    it("getTotalSessions returns totalSessions", () => {
      expect(store.getState().sessions.getTotalSessions()).toBe(0);
    });

    it("getSelectedLeague returns selectedLeague", () => {
      expect(store.getState().sessions.getSelectedLeague()).toBe("all");
    });

    it("getSearchQuery returns searchQuery", () => {
      expect(store.getState().sessions.getSearchQuery()).toBe("");
    });
  });

  // ─── getUniqueLeagues ─────────────────────────────────────────────────

  describe("getUniqueLeagues", () => {
    it("returns ['all'] when there are no sessions", () => {
      expect(store.getState().sessions.getUniqueLeagues()).toEqual(["all"]);
    });

    it("returns unique leagues prefixed with 'all'", async () => {
      const sessionsList = [
        makeSessionSummary({ sessionId: "s1", league: "Settlers" }),
        makeSessionSummary({ sessionId: "s2", league: "Necropolis" }),
        makeSessionSummary({ sessionId: "s3", league: "Settlers" }),
        makeSessionSummary({ sessionId: "s4", league: "Standard" }),
      ];
      electron.sessions.getAll.mockResolvedValue(
        makePageResponse(sessionsList),
      );

      await store.getState().sessions.loadAllSessions();

      const leagues = store.getState().sessions.getUniqueLeagues();
      expect(leagues[0]).toBe("all");
      expect(leagues).toContain("Settlers");
      expect(leagues).toContain("Necropolis");
      expect(leagues).toContain("Standard");
      // "Settlers" should appear only once (deduped)
      expect(leagues.filter((l) => l === "Settlers")).toHaveLength(1);
    });
  });

  // ─── getFilteredSessions ──────────────────────────────────────────────

  describe("getFilteredSessions", () => {
    const sessionsList = [
      makeSessionSummary({ sessionId: "s1", league: "Settlers" }),
      makeSessionSummary({ sessionId: "s2", league: "Necropolis" }),
      makeSessionSummary({ sessionId: "s3", league: "Settlers" }),
      makeSessionSummary({ sessionId: "s4", league: "Standard" }),
    ];

    beforeEach(async () => {
      electron.sessions.getAll.mockResolvedValue(
        makePageResponse(sessionsList),
      );
      await store.getState().sessions.loadAllSessions();
    });

    it("returns all sessions when selectedLeague is 'all'", () => {
      const filtered = store.getState().sessions.getFilteredSessions();
      expect(filtered).toHaveLength(4);
    });

    it("returns only matching sessions when a specific league is selected", () => {
      electron.sessions.getAll.mockResolvedValue(
        makePageResponse(sessionsList),
      );
      store.getState().sessions.setSelectedLeague("Settlers");

      const filtered = store.getState().sessions.getFilteredSessions();
      expect(filtered).toHaveLength(2);
      expect(filtered.every((s) => s.league === "Settlers")).toBe(true);
    });

    it("returns empty array when no sessions match the league", () => {
      electron.sessions.getAll.mockResolvedValue(
        makePageResponse(sessionsList),
      );
      store.getState().sessions.setSelectedLeague("Affliction");

      const filtered = store.getState().sessions.getFilteredSessions();
      expect(filtered).toHaveLength(0);
    });

    it("returns single session when league has one match", () => {
      electron.sessions.getAll.mockResolvedValue(
        makePageResponse(sessionsList),
      );
      store.getState().sessions.setSelectedLeague("Standard");

      const filtered = store.getState().sessions.getFilteredSessions();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe("s4");
    });
  });
});
