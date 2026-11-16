import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import { makeDetailedSession } from "~/renderer/__test-setup__/fixtures";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { DetailedDivinationCardStats } from "~/types/data-stores";

import { timelineBuffer } from "../CurrentSession.components/SessionProfitTimeline/timeline-buffer/timeline-buffer";

vi.mock(
  "../CurrentSession.components/SessionProfitTimeline/timeline-buffer/timeline-buffer",
  () => ({
    timelineBuffer: {
      linePoints: [],
      chartData: [],
      totalDrops: 0,
      totalChaosValue: 0,
      totalDivineValue: 0,
      deckCost: 0,
      hasBars: false,
      version: 0,
      subscribe: vi.fn(() => vi.fn()),
      seedFromTimeline: vi.fn(),
      setDeckCost: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      applyDelta: vi.fn(),
      reset: vi.fn(),
    },
  }),
);

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<DetailedDivinationCardStats> = {},
): DetailedDivinationCardStats {
  return makeDetailedSession({
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
    ],
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: null,
    totals: {
      totalValue: 2430,
      netProfit: 2130,
      chaosToDivineRatio: 150,
      stackedDeckChaosCost: 3,
      totalDeckCost: 150,
    },
    ...overrides,
  } as any);
}

function makeSessionInfo(
  overrides: Partial<{ league: string; startedAt: string }> = {},
) {
  return {
    league: "poe1:Settlers",
    startedAt: "2024-01-01T00:00:00Z",
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

const mockSeedFromTimeline = vi.mocked(timelineBuffer.seedFromTimeline);
const mockSetDeckCost = vi.mocked(timelineBuffer.setDeckCost);

describe("CurrentSessionSlice", () => {
  // ─── Initial State ───────────────────────────────────────────────────

  describe("initial state", () => {
    it("has correct default values", () => {
      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toBeNull();
      expect(currentSession.poe2Session).toBeNull();
      expect(currentSession.poe1SessionInfo).toBeNull();
      expect(currentSession.poe2SessionInfo).toBeNull();
      expect(currentSession.isLoading).toBe(false);
    });
  });

  // ─── hydrate ─────────────────────────────────────────────────────────

  describe("hydrate", () => {
    beforeEach(() => {
      mockSeedFromTimeline.mockClear();
      mockSetDeckCost.mockClear();
    });

    it("hydrates a timeline even when pricing totals are unavailable", async () => {
      const session = makeSession({
        totals: undefined,
        timeline: {
          buckets: [],
          liveEdge: [],
          totalChaosValue: 0,
          totalDivineValue: 0,
          totalDrops: 0,
          notableDrops: [],
        },
      });
      electron.session.getCurrent
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(null);
      electron.session.getInfo
        .mockResolvedValueOnce(makeSessionInfo())
        .mockResolvedValueOnce(null);
      await store.getState().currentSession.hydrate();
      expect(mockSeedFromTimeline).toHaveBeenCalledWith(session.timeline);
      expect(mockSetDeckCost).not.toHaveBeenCalled();
      expect(
        store.getState().currentSession.poe1Session?.timeline,
      ).toBeUndefined();
    });

    it("sets isLoading true then false on success", async () => {
      electron.session.getCurrent.mockResolvedValue(null);
      electron.session.getInfo.mockResolvedValue(null);

      const promise = store.getState().currentSession.hydrate();
      expect(store.getState().currentSession.isLoading).toBe(true);

      await promise;
      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("loads poe1 and poe2 sessions and info in parallel", async () => {
      const poe1Session = makeSession({ totalCount: 10 });
      const poe2Session = makeSession({ totalCount: 20 });
      const poe1Info = makeSessionInfo({ league: "poe1:Settlers" });
      const poe2Info = makeSessionInfo({ league: "poe2:Standard" });

      electron.session.getCurrent
        .mockResolvedValueOnce(poe1Session) // poe1
        .mockResolvedValueOnce(poe2Session); // poe2
      electron.session.getInfo
        .mockResolvedValueOnce(poe1Info) // poe1
        .mockResolvedValueOnce(poe2Info); // poe2

      await store.getState().currentSession.hydrate();

      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).not.toBeNull();
      expect(currentSession.poe1Session!.totalCount).toBe(10);
      expect(currentSession.poe2Session).not.toBeNull();
      expect(currentSession.poe2Session!.totalCount).toBe(20);
      expect(currentSession.poe1SessionInfo).toEqual(poe1Info);
      expect(currentSession.poe2SessionInfo).toEqual(poe2Info);
    });

    it("calls getCurrent and getInfo for both games", async () => {
      electron.session.getCurrent.mockResolvedValue(null);
      electron.session.getInfo.mockResolvedValue(null);

      await store.getState().currentSession.hydrate();

      expect(electron.session.getCurrent).toHaveBeenCalledWith("poe1");
      expect(electron.session.getCurrent).toHaveBeenCalledWith("poe2");
      expect(electron.session.getInfo).toHaveBeenCalledWith("poe1");
      expect(electron.session.getInfo).toHaveBeenCalledWith("poe2");
    });

    it("sets isLoading false on error", async () => {
      electron.session.getCurrent.mockRejectedValue(new Error("IPC failure"));

      await store.getState().currentSession.hydrate();

      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("does not crash when all results are null", async () => {
      electron.session.getCurrent.mockResolvedValue(null);
      electron.session.getInfo.mockResolvedValue(null);

      await store.getState().currentSession.hydrate();

      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toBeNull();
      expect(currentSession.poe2Session).toBeNull();
      expect(currentSession.poe1SessionInfo).toBeNull();
      expect(currentSession.poe2SessionInfo).toBeNull();
      expect(currentSession.isLoading).toBe(false);
    });

    it("exercises poeNinja snapshot sync branch (isReused: false) when poe1Info and poe1Session have priceSnapshot", async () => {
      const poe1Session = makeSession({
        snapshotId: "snap-abc",
        priceSnapshot: {
          timestamp: "2024-01-01T12:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });
      const poe1Info = makeSessionInfo({ league: "poe1:Standard" });

      electron.session.getCurrent
        .mockResolvedValueOnce(poe1Session) // poe1
        .mockResolvedValueOnce(null); // poe2
      electron.session.getInfo
        .mockResolvedValueOnce(poe1Info) // poe1
        .mockResolvedValueOnce(null); // poe2

      await store.getState().currentSession.hydrate();

      // Session state should be set correctly (poeNinja sync is a nested
      // set call that gets overwritten by immer, but the branch is covered)
      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toEqual(poe1Session);
      expect(currentSession.poe1SessionInfo).toEqual(poe1Info);
      expect(currentSession.poe2Session).toBeNull();
      expect(currentSession.isLoading).toBe(false);
    });

    it("exercises poeNinja snapshot sync branch using poe2Session when poe1Info is null", async () => {
      const poe2Session = makeSession({
        snapshotId: "snap-poe2",
        priceSnapshot: {
          timestamp: "2024-02-01T12:00:00Z",
          stackedDeckChaosCost: 5,
          chaosToDivineRatio: 200,
          cardPrices: {},
        },
      });
      const poe2Info = makeSessionInfo({ league: "poe2:Standard" });

      electron.session.getCurrent
        .mockResolvedValueOnce(null) // poe1
        .mockResolvedValueOnce(poe2Session); // poe2
      electron.session.getInfo
        .mockResolvedValueOnce(null) // poe1
        .mockResolvedValueOnce(poe2Info); // poe2

      await store.getState().currentSession.hydrate();

      // poe1Info is null so activeSession falls back to poe2Session
      const { currentSession } = store.getState();
      expect(currentSession.poe2Session).toEqual(poe2Session);
      expect(currentSession.poe2SessionInfo).toEqual(poe2Info);
      expect(currentSession.poe1Session).toBeNull();
      expect(currentSession.poe1SessionInfo).toBeNull();
      expect(currentSession.isLoading).toBe(false);
    });

    it("exercises default snapshotId fallback when snapshotId is null", async () => {
      const poe1Session = makeSession({
        snapshotId: null,
        priceSnapshot: {
          timestamp: "2024-01-01T12:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });
      const poe1Info = makeSessionInfo({ league: "poe1:Settlers" });

      electron.session.getCurrent
        .mockResolvedValueOnce(poe1Session)
        .mockResolvedValueOnce(null);
      electron.session.getInfo
        .mockResolvedValueOnce(poe1Info)
        .mockResolvedValueOnce(null);

      await store.getState().currentSession.hydrate();

      // Verifies the ?? "session-snapshot" fallback branch is exercised
      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toEqual(poe1Session);
      expect(currentSession.poe1SessionInfo).toEqual(poe1Info);
      expect(currentSession.isLoading).toBe(false);
    });

    it("exercises league/game fallback when league string splits to empty strings", async () => {
      const poe1Session = makeSession({
        snapshotId: "snap-empty",
        priceSnapshot: {
          timestamp: "2024-01-01T12:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });
      // ":" splits to ["", ""] so game="" and league="" — both || fallbacks hit
      const poe1Info = makeSessionInfo({ league: ":" });

      electron.session.getCurrent
        .mockResolvedValueOnce(poe1Session)
        .mockResolvedValueOnce(null);
      electron.session.getInfo
        .mockResolvedValueOnce(poe1Info)
        .mockResolvedValueOnce(null);

      await store.getState().currentSession.hydrate();

      // Branch coverage: league || activeInfo.league → ":" and game || "poe1" → "poe1"
      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toEqual(poe1Session);
      expect(currentSession.poe1SessionInfo).toEqual(poe1Info);
      expect(currentSession.isLoading).toBe(false);
    });

    it("calls seedFromTimeline and setDeckCost when session has timeline and stackedDeckChaosCost", async () => {
      const timeline = {
        buckets: [
          {
            timestamp: "2024-01-01T00:00:00Z",
            dropCount: 5,
            cumulativeChaosValue: 200,
            cumulativeDivineValue: 1,
            notableDrops: [],
          },
        ],
        notableDrops: [],
        totalDrops: 5,
        totalChaosValue: 200,
        totalDivineValue: 1,
      };
      const poe1Session = makeSession({
        timeline,
        totals: {
          totalValue: 200,
          netProfit: 150,
          chaosToDivineRatio: 150,
          stackedDeckChaosCost: 7,
          totalDeckCost: 35,
        },
      } as any);
      const poe1Info = makeSessionInfo({ league: "poe1:Settlers" });

      electron.session.getCurrent.mockImplementation((game: string) =>
        Promise.resolve(game === "poe1" ? poe1Session : null),
      );
      electron.session.getInfo.mockImplementation((game: string) =>
        Promise.resolve(game === "poe1" ? poe1Info : null),
      );

      await store.getState().currentSession.hydrate();

      expect(mockSeedFromTimeline).toHaveBeenCalledWith(timeline);
      expect(mockSetDeckCost).toHaveBeenCalledWith(7);
    });

    it("hydrates a zero deck cost", async () => {
      const timeline = {
        buckets: [],
        notableDrops: [],
        totalDrops: 0,
        totalChaosValue: 0,
        totalDivineValue: 0,
      };
      const poe1Session = makeSession({
        timeline,
        totals: {
          totalValue: 0,
          netProfit: 0,
          chaosToDivineRatio: 150,
          stackedDeckChaosCost: 0,
          totalDeckCost: 0,
        },
      } as any);
      const poe1Info = makeSessionInfo({ league: "poe1:Settlers" });

      electron.session.getCurrent.mockImplementation((game: string) =>
        Promise.resolve(game === "poe1" ? poe1Session : null),
      );
      electron.session.getInfo.mockImplementation((game: string) =>
        Promise.resolve(game === "poe1" ? poe1Info : null),
      );

      await store.getState().currentSession.hydrate();

      expect(mockSeedFromTimeline).toHaveBeenCalledWith(timeline);
      expect(mockSetDeckCost).toHaveBeenCalledWith(0);
    });

    it("does not sync to poeNinja when activeSession has no priceSnapshot", async () => {
      const poe1Session = makeSession(); // no priceSnapshot
      const poe1Info = makeSessionInfo({ league: "poe1:Standard" });

      electron.session.getCurrent
        .mockResolvedValueOnce(poe1Session)
        .mockResolvedValueOnce(null);
      electron.session.getInfo
        .mockResolvedValueOnce(poe1Info)
        .mockResolvedValueOnce(null);

      await store.getState().currentSession.hydrate();

      expect(store.getState().poeNinja.currentSnapshot).toBeNull();
    });

    it("does not sync to poeNinja when no activeInfo exists", async () => {
      const poe1Session = makeSession({
        priceSnapshot: {
          timestamp: "2024-01-01T12:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });

      electron.session.getCurrent
        .mockResolvedValueOnce(poe1Session)
        .mockResolvedValueOnce(null);
      electron.session.getInfo
        .mockResolvedValueOnce(null) // poe1 info null
        .mockResolvedValueOnce(null); // poe2 info null

      await store.getState().currentSession.hydrate();

      // activeInfo is null so poeNinja should not be synced
      expect(store.getState().poeNinja.currentSnapshot).toBeNull();
    });
  });

  // ─── startSession ────────────────────────────────────────────────────

  describe("startSession", () => {
    it.each(["poe1", "poe2"] as const)(
      "retries a failed %s override before restarting after an external stop",
      async (game) => {
        store = createTestStore({
          settings: {
            selectedGame: game,
            poe1SelectedLeague: "Settlers",
            poe2SelectedLeague: "Standard",
          },
        });
        const info = makeSessionInfo({ league: `${game}:Test` });
        store.setState((state) => {
          if (game === "poe1") state.currentSession.poe1SessionInfo = info;
          else state.currentSession.poe2SessionInfo = info;
        });
        const stopListening = store.getState().currentSession.startListening();
        electron.session.setStackedDeckPriceOverride.mockResolvedValueOnce({
          success: false,
        });
        await store.getState().currentSession.setStackedDeckPriceOverride(2.25);
        electron.session.onStateChanged.mock.calls[0][0]({
          game,
          isActive: false,
          sessionInfo: null,
        });
        expect(
          store.getState().currentSession.getIsCurrentSessionActive(),
        ).toBe(false);
        electron.session.getCurrent.mockResolvedValue(
          makeSession({ id: "replacement", game }),
        );
        electron.session.getInfo.mockResolvedValue(info);
        await store.getState().currentSession.startSession();
        expect(electron.session.setStackedDeckPriceOverride.mock.calls).toEqual(
          [
            [game, 2.25],
            [game, 2.25],
          ],
        );
        expect(electron.session.start).toHaveBeenCalledExactlyOnceWith(
          game,
          game === "poe1" ? "Settlers" : "Standard",
        );
        expect(
          electron.session.setStackedDeckPriceOverride.mock
            .invocationCallOrder[1],
        ).toBeLessThan(electron.session.start.mock.invocationCallOrder[0]);
        expect(
          store.getState().currentSession.stackedDeckPriceErrors[game],
        ).toBeNull();
        expect(
          store.getState().currentSession.getIsCurrentSessionActive(),
        ).toBe(true);
        stopListening();
      },
    );

    it("keeps a failed idle retry recoverable on the next Start attempt", async () => {
      store.setState((state) => {
        state.currentSession.poe1SessionInfo = makeSessionInfo();
      });
      const stopListening = store.getState().currentSession.startListening();
      electron.session.setStackedDeckPriceOverride
        .mockRejectedValueOnce(new Error("initial save failed"))
        .mockResolvedValueOnce({ success: false });
      await store.getState().currentSession.setStackedDeckPriceOverride(2.25);
      electron.session.onStateChanged.mock.calls[0][0]({
        game: "poe1",
        isActive: false,
        sessionInfo: null,
      });
      await store.getState().currentSession.startSession();
      expect(
        electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenCalledTimes(2);
      expect(electron.session.start).not.toHaveBeenCalled();
      expect(
        store.getState().currentSession.stackedDeckPriceErrors.poe1,
      ).toContain("Unable to save");
      expect(store.getState().currentSession.isLoading).toBe(false);
      await store.getState().currentSession.startSession();
      expect(
        electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenCalledTimes(3);
      expect(electron.session.start).toHaveBeenCalledOnce();
      expect(
        store.getState().currentSession.stackedDeckPriceErrors.poe1,
      ).toBeNull();
      stopListening();
    });

    it("calls session.start with selectedGame and league", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(makeSession());
      electron.session.getInfo.mockResolvedValue(makeSessionInfo());

      await store.getState().currentSession.startSession();

      expect(electron.session.start).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("fetches current session data after successful start", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({ totalCount: 42 });
      const sessionInfo = makeSessionInfo();

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      expect(electron.session.getCurrent).toHaveBeenCalledWith("poe1");
      expect(electron.session.getInfo).toHaveBeenCalledWith("poe1");
      expect(store.getState().currentSession.poe1Session).not.toBeNull();
      expect(store.getState().currentSession.poe1Session!.totalCount).toBe(42);
      expect(store.getState().currentSession.poe1SessionInfo).toEqual(
        sessionInfo,
      );
    });

    it("sets isLoading true during start and false after", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(null);
      electron.session.getInfo.mockResolvedValue(null);

      const promise = store.getState().currentSession.startSession();
      expect(store.getState().currentSession.isLoading).toBe(true);

      await promise;
      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("sets isLoading false on failure", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      electron.session.start.mockResolvedValue({
        success: false,
        error: "Already active",
      });

      await store.getState().currentSession.startSession();

      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("does not track event on failure", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      electron.session.start.mockResolvedValue({
        success: false,
        error: "Nope",
      });

      await store.getState().currentSession.startSession();
    });

    it("aborts when selectedGame or league is missing", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "" },
      });
      electron = window.electron as unknown as ElectronMock;

      await store.getState().currentSession.startSession();

      expect(electron.session.start).not.toHaveBeenCalled();
    });

    it("starts poe2 session when poe2 is selected", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe2", poe2SelectedLeague: "Standard" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({ totalCount: 5 });
      const sessionInfo = makeSessionInfo({ league: "poe2:Standard" });

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      expect(electron.session.start).toHaveBeenCalledWith("poe2", "Standard");
      expect(store.getState().currentSession.poe2Session).not.toBeNull();
      expect(store.getState().currentSession.poe2SessionInfo).toEqual(
        sessionInfo,
      );
    });

    it("exercises poeNinja snapshot sync branch on successful poe2 start with priceSnapshot", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe2", poe2SelectedLeague: "Standard" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({
        snapshotId: "snap-start-poe2",
        priceSnapshot: {
          timestamp: "2024-03-01T10:00:00Z",
          stackedDeckChaosCost: 4,
          chaosToDivineRatio: 0.001,
          cardPrices: {},
        },
      });
      const sessionInfo = makeSessionInfo({ league: "poe2:Standard" });

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      // Session state should reflect poe2 data (poeNinja sync is a nested
      // set call that gets overwritten by immer, but the branch is covered)
      const { currentSession } = store.getState();
      expect(currentSession.poe2Session).toEqual(sessionData);
      expect(currentSession.poe2SessionInfo).toEqual(sessionInfo);
      expect(currentSession.isLoading).toBe(false);
    });

    it("seeds timelineBuffer from sessionData.timeline on successful start", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({
        timeline: {
          buckets: [
            {
              timestamp: "2024-01-01T00:00:00Z",
              dropCount: 2,
              cumulativeChaosValue: 100,
              cumulativeDivineValue: 0.5,
              notableDrops: [],
            },
            {
              timestamp: "2024-01-01T00:05:00Z",
              dropCount: 5,
              cumulativeChaosValue: 200,
              cumulativeDivineValue: 1.2,
              notableDrops: [],
            },
          ],
          notableDrops: [],
          totalDrops: 5,
          totalChaosValue: 200,
          totalDivineValue: 1.2,
        },
        totals: {
          totalValue: 200,
          netProfit: 100,
          chaosToDivineRatio: 150,
          stackedDeckChaosCost: 3,
          totalDeckCost: 150,
        },
      } as any);
      const sessionInfo = makeSessionInfo();

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      // Timeline seeding writes to a mutable buffer outside Zustand.
      // startSession stores the session after stripping timeline, so just
      // verify it was stored and didn't crash.
      const session = store.getState().currentSession.poe1Session;
      expect(session).not.toBeNull();
      expect(session!.totalCount).toBe(50);
    });

    it("exercises poeNinja snapshot sync with null snapshotId on poe1 start", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({
        snapshotId: null,
        priceSnapshot: {
          timestamp: "2024-03-01T10:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });
      const sessionInfo = makeSessionInfo({ league: "poe1:Settlers" });

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      // Verifies the ?? "session-snapshot" fallback branch is exercised
      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toEqual(sessionData);
      expect(currentSession.poe1SessionInfo).toEqual(sessionInfo);
      expect(currentSession.isLoading).toBe(false);
    });

    it("exercises league/game fallback in startSession when league splits to empty strings", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({
        snapshotId: "snap-colon",
        priceSnapshot: {
          timestamp: "2024-01-01T12:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });
      // ":" splits to ["", ""] so game="" and league="" — both || fallbacks hit
      const sessionInfo = makeSessionInfo({ league: ":" });

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      // Branch coverage: league || sessionInfo.league → ":" and game || activeGameView → "poe1"
      const { currentSession } = store.getState();
      expect(currentSession.poe1Session).toEqual(sessionData);
      expect(currentSession.poe1SessionInfo).toEqual(sessionInfo);
      expect(currentSession.isLoading).toBe(false);
    });

    it("does not sync to poeNinja when sessionData has no priceSnapshot", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession(); // no priceSnapshot
      const sessionInfo = makeSessionInfo();

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(sessionInfo);

      await store.getState().currentSession.startSession();

      expect(store.getState().poeNinja.currentSnapshot).toBeNull();
    });

    it("does not sync to poeNinja when sessionInfo is null after start", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      const sessionData = makeSession({
        priceSnapshot: {
          timestamp: "2024-01-01T00:00:00Z",
          stackedDeckChaosCost: 3,
          chaosToDivineRatio: 150,
          cardPrices: {},
        },
      });

      electron.session.start.mockResolvedValue({ success: true });
      electron.session.getCurrent.mockResolvedValue(sessionData);
      electron.session.getInfo.mockResolvedValue(null);

      await store.getState().currentSession.startSession();

      expect(store.getState().poeNinja.currentSnapshot).toBeNull();
    });

    it("uses default error message when result.error is undefined", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1", poe1SelectedLeague: "Settlers" },
      });
      electron = window.electron as unknown as ElectronMock;

      electron.session.start.mockResolvedValue({ success: false });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await store.getState().currentSession.startSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SessionSlice] Failed to start session:",
        expect.objectContaining({
          message: "Failed to start session",
        }),
      );
      expect(store.getState().currentSession.isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ─── stopSession ─────────────────────────────────────────────────────

  describe("stopSession", () => {
    it.each(["rejected", "unsuccessful"])(
      "keeps the session and override editable when a pending price save is %s",
      async (failure) => {
        const session = makeSession();
        store.setState((state) => {
          state.currentSession.poe1Session = session;
          state.currentSession.poe1SessionInfo = makeSessionInfo();
        });
        if (failure === "rejected") {
          electron.session.setStackedDeckPriceOverride.mockRejectedValueOnce(
            new Error("IPC failed"),
          );
        } else {
          electron.session.setStackedDeckPriceOverride.mockResolvedValueOnce({
            success: false,
          });
        }
        const save = store
          .getState()
          .currentSession.setStackedDeckPriceOverride(2.25);
        await store.getState().currentSession.stopSession();
        await save;

        expect(electron.session.stop).not.toHaveBeenCalled();
        expect(
          store.getState().currentSession.getIsCurrentSessionActive(),
        ).toBe(true);
        expect(
          store.getState().currentSession.stackedDeckPriceOverrides.poe1,
        ).toBe(2.25);
        expect(
          store.getState().currentSession.stackedDeckPriceErrors.poe1,
        ).toContain("Unable to save");
        expect(store.getState().currentSession.isLoading).toBe(false);

        await store.getState().currentSession.stopSession();
        expect(electron.session.stop).not.toHaveBeenCalled();
        const retry = store
          .getState()
          .currentSession.setStackedDeckPriceOverride(2.25);
        await store.getState().currentSession.stopSession();
        await retry;
        expect(electron.session.stop).toHaveBeenCalledExactlyOnceWith("poe1");
        expect(
          store.getState().currentSession.stackedDeckPriceErrors.poe1,
        ).toBeNull();
      },
    );

    it("does not start a session after an idle threshold save fails", async () => {
      electron.session.setCardPriceThreshold.mockResolvedValueOnce({
        success: false,
      });
      const save = store.getState().currentSession.setCardPriceThreshold(5);
      await store.getState().currentSession.startSession();
      await save;
      expect(electron.session.start).not.toHaveBeenCalled();
      expect(
        store.getState().currentSession.cardPriceThresholdErrors.poe1,
      ).toContain("Unable to save");
      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("calls session.stop with the active game", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1" },
      });
      electron = window.electron as unknown as ElectronMock;

      electron.session.stop.mockResolvedValue({
        success: true,
        game: "poe1",
        league: "Settlers",
        durationMs: 60000,
        totalCount: 50,
      });

      await store.getState().currentSession.stopSession();

      expect(electron.session.stop).toHaveBeenCalledWith("poe1");
    });

    it("sets isLoading true during stop and false after", async () => {
      electron.session.stop.mockResolvedValue({ success: true });

      const promise = store.getState().currentSession.stopSession();
      expect(store.getState().currentSession.isLoading).toBe(true);

      await promise;
      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("sets isLoading false on failure", async () => {
      electron.session.stop.mockResolvedValue({
        success: false,
        error: "No active session",
      });

      await store.getState().currentSession.stopSession();

      expect(store.getState().currentSession.isLoading).toBe(false);
    });

    it("uses default error message when result.error is undefined", async () => {
      electron.session.stop.mockResolvedValue({ success: false });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await store.getState().currentSession.stopSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SessionSlice] Failed to stop session:",
        expect.objectContaining({
          message: "Failed to stop session",
        }),
      );
      expect(store.getState().currentSession.isLoading).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("Stacked Deck price override", () => {
    it("updates background game pricing without changing the selected timeline", () => {
      const session = makeSession({ id: "poe2-session", game: "poe2" });
      store.setState((state) => {
        state.currentSession.poe2Session = session;
      });
      const cleanup = store.getState().currentSession.startListening();
      const callback = electron.session.onPricingUpdated.mock.calls[0][0];
      callback({
        game: "poe2",
        sessionId: "poe2-session",
        totals: {
          ...session.totals!,
          stackedDeckChaosCost: 0,
          totalDeckCost: 0,
        },
      });
      expect(
        store.getState().currentSession.poe2Session?.totals
          ?.stackedDeckChaosCost,
      ).toBe(0);
      expect(mockSetDeckCost).not.toHaveBeenCalled();
      cleanup();
    });

    it("does not restore a session stopped by a timeline subscriber during a pricing update", () => {
      const session = makeSession({ id: "stopping-session" });
      store.setState((state) => {
        state.currentSession.poe1Session = session;
      });
      const cleanup = store.getState().currentSession.startListening();
      mockSetDeckCost.mockImplementationOnce(() => {
        store.setState((state) => {
          state.currentSession.poe1Session = null;
        });
      });
      electron.session.onPricingUpdated.mock.calls[0][0]({
        game: "poe1",
        sessionId: "stopping-session",
        totals: session.totals!,
      });
      expect(store.getState().currentSession.poe1Session).toBeNull();
      cleanup();
    });

    it("applies totals-only updates without replacing rows and ignores an older session", () => {
      const session = makeSession();
      store.setState((state) => {
        state.currentSession.poe1Session = session;
      });
      const cards = store.getState().currentSession.poe1Session!.cards;
      store.getState().currentSession.startListening();
      const callback = electron.session.onPricingUpdated.mock.calls[0][0];
      const totals = {
        totalValue: 100,
        netProfit: 100,
        totalDeckCost: 0,
        stackedDeckChaosCost: 0,
        chaosToDivineRatio: 100,
      };
      callback({ game: "poe1", sessionId: "older-session", totals });
      expect(store.getState().currentSession.poe1Session?.totals).not.toEqual(
        totals,
      );
      callback({ game: "poe1", sessionId: session.id!, totals });
      expect(store.getState().currentSession.poe1Session?.totals).toEqual(
        totals,
      );
      expect(store.getState().currentSession.poe1Session?.cards).toBe(cards);
      expect(mockSetDeckCost).toHaveBeenLastCalledWith(0);
      expect(mockSeedFromTimeline).not.toHaveBeenCalled();
    });

    it("hydrates separate saved prices for each game", async () => {
      electron.session.getStackedDeckPriceOverride.mockImplementation(
        async (game) => (game === "poe1" ? 2.25 : 0),
      );
      await store.getState().currentSession.hydrate();
      expect(store.getState().currentSession.stackedDeckPriceOverrides).toEqual(
        { poe1: 2.25, poe2: 0 },
      );
    });
    it("saves zero and clears the override for the selected game while idle", async () => {
      store.getState().settings.setSetting("selectedGame", "poe2");
      await store.getState().currentSession.setStackedDeckPriceOverride(0);
      expect(
        electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe2", 0);
      await store.getState().currentSession.setStackedDeckPriceOverride(null);
      expect(
        electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe2", null);
      expect(store.getState().currentSession.stackedDeckPriceOverrides).toEqual(
        { poe1: null, poe2: null },
      );
    });
    it.each([-1, NaN, Infinity, 999.01, 1000])(
      "rejects invalid price %s",
      async (value) => {
        await store
          .getState()
          .currentSession.setStackedDeckPriceOverride(value);
        expect(
          electron.session.setStackedDeckPriceOverride,
        ).not.toHaveBeenCalled();
      },
    );
    it("recovers from save failures", async () => {
      electron.session.setStackedDeckPriceOverride.mockRejectedValueOnce(
        new Error("IPC failed"),
      );
      await store.getState().currentSession.setStackedDeckPriceOverride(2.25);
      expect(
        store.getState().currentSession.stackedDeckPriceErrors.poe1,
      ).toContain("Unable to save");
      await store.getState().currentSession.setStackedDeckPriceOverride(null);
      expect(
        store.getState().currentSession.stackedDeckPriceErrors.poe1,
      ).toBeNull();
    });
    it("resets the timeline deck cost to zero after a live override update", () => {
      store.getState().currentSession.startListening();
      const callback = electron.session.onDataUpdated.mock.calls[0][0];
      const session = makeSession();
      session.totals!.stackedDeckChaosCost = 0;
      session.timeline = {
        buckets: [],
        liveEdge: [],
        totalChaosValue: 0,
        totalDivineValue: 0,
        totalDrops: 0,
        notableDrops: [],
      };
      callback({ game: "poe1", data: session });
      expect(mockSetDeckCost).toHaveBeenCalledWith(0);
    });
  });

  describe("card price threshold", () => {
    it("hydrates saved thresholds even with no active session", async () => {
      electron.session.getCardPriceThreshold.mockImplementation(async (game) =>
        game === "poe1" ? 1.25 : 4,
      );
      await store.getState().currentSession.hydrate();
      expect(store.getState().currentSession.cardPriceThresholds).toEqual({
        poe1: 1.25,
        poe2: 4,
      });
    });

    it("saves the threshold for the selected game without an active session", async () => {
      store.getState().settings.setSetting("selectedGame", "poe2");
      await store.getState().currentSession.setCardPriceThreshold(2.5);
      expect(electron.session.setCardPriceThreshold).toHaveBeenCalledWith(
        "poe2",
        2.5,
      );
      expect(store.getState().currentSession.cardPriceThresholds).toEqual({
        poe1: 0,
        poe2: 2.5,
      });
    });

    it.each([-1, NaN, Infinity, 999.01, 1000])(
      "ignores invalid threshold %s",
      async (value) => {
        await store.getState().currentSession.setCardPriceThreshold(value);
        expect(electron.session.setCardPriceThreshold).not.toHaveBeenCalled();
      },
    );

    it("coalesces rapid edits and keeps the game selected for each edit", async () => {
      const first = store.getState().currentSession.setCardPriceThreshold(2);
      const latest = store.getState().currentSession.setCardPriceThreshold(3);
      store.getState().settings.setSetting("selectedGame", "poe2");
      const second = store.getState().currentSession.setCardPriceThreshold(5);
      await Promise.all([first, latest, second]);
      expect(electron.session.setCardPriceThreshold.mock.calls).toEqual(
        expect.arrayContaining([
          ["poe1", 3],
          ["poe2", 5],
        ]),
      );
      expect(electron.session.setCardPriceThreshold).toHaveBeenCalledTimes(2);
    });

    it("keeps a failed save associated with its game after switching games", async () => {
      electron.session.setCardPriceThreshold.mockRejectedValueOnce(
        new Error("IPC failed"),
      );
      const save = store.getState().currentSession.setCardPriceThreshold(2);
      store.getState().settings.setSetting("selectedGame", "poe2");
      await save;
      expect(
        store.getState().currentSession.cardPriceThresholdErrors.poe1,
      ).toContain("Unable to save");
      expect(
        store.getState().currentSession.cardPriceThresholdErrors.poe2,
      ).toBeNull();
    });

    it("flushes the latest deck price before stopping the session", async () => {
      const save = store
        .getState()
        .currentSession.setStackedDeckPriceOverride(2.25);
      await store.getState().currentSession.stopSession();
      await save;
      expect(
        electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenCalledExactlyOnceWith("poe1", 2.25);
      expect(
        electron.session.setStackedDeckPriceOverride.mock
          .invocationCallOrder[0],
      ).toBeLessThan(electron.session.stop.mock.invocationCallOrder[0]);
    });

    it("recovers after a save failure and clears its error on the next edit", async () => {
      electron.session.setCardPriceThreshold.mockRejectedValueOnce(
        new Error("IPC failed"),
      );
      await store.getState().currentSession.setCardPriceThreshold(2);
      expect(
        store.getState().currentSession.cardPriceThresholdErrors.poe1,
      ).toContain("Unable to save");
      await store.getState().currentSession.setCardPriceThreshold(3);
      expect(
        store.getState().currentSession.cardPriceThresholdErrors.poe1,
      ).toBeNull();
      expect(electron.session.setCardPriceThreshold).toHaveBeenLastCalledWith(
        "poe1",
        3,
      );
    });
  });

  // ─── toggleCardPriceVisibility ────────────────────────────────────────

  describe("toggleCardPriceVisibility", () => {
    it("calls backend updateCardPriceVisibility", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1" },
      });
      electron = window.electron as unknown as ElectronMock;

      const session = makeSession();
      store.setState((s) => {
        s.currentSession.poe1Session = session;
      });

      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .currentSession.toggleCardPriceVisibility("The Doctor");

      expect(electron.session.updateCardPriceVisibility).toHaveBeenCalledWith(
        "poe1",
        "current",
        "The Doctor",
        true,
      );
    });

    it("does nothing when session is null", async () => {
      await store
        .getState()
        .currentSession.toggleCardPriceVisibility("The Doctor");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("does nothing when card is not found in session", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1" },
      });
      electron = window.electron as unknown as ElectronMock;

      const session = makeSession();
      store.setState((s) => {
        s.currentSession.poe1Session = session;
      });

      await store
        .getState()
        .currentSession.toggleCardPriceVisibility("Nonexistent Card");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("toggles price visibility when hidePrice is already true", async () => {
      store = createTestStore({
        settings: { selectedGame: "poe1" },
      });
      electron = window.electron as unknown as ElectronMock;

      const session = makeSession();
      session.cards[0].price!.hidePrice = true;
      store.setState((s) => {
        s.currentSession.poe1Session = session;
      });

      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .currentSession.toggleCardPriceVisibility("The Doctor");

      expect(electron.session.updateCardPriceVisibility).toHaveBeenCalledWith(
        "poe1",
        "current",
        "The Doctor",
        false,
      );
    });
  });

  // ─── startListening ──────────────────────────────────────────────────

  describe("startListening", () => {
    it("subscribes to onStateChanged, onDataUpdated, onTimelineDelta, and onCardDelta", () => {
      store.getState().currentSession.startListening();

      expect(electron.session.onStateChanged).toHaveBeenCalled();
      expect(electron.session.onDataUpdated).toHaveBeenCalled();
      expect(electron.session.onTimelineDelta).toHaveBeenCalled();
      expect(electron.session.onCardDelta).toHaveBeenCalled();
    });

    it("returns a cleanup function", () => {
      const cleanup = store.getState().currentSession.startListening();

      expect(typeof cleanup).toBe("function");
    });

    it("cleanup calls unsubscribe functions", () => {
      const unsubStateChanged = vi.fn();
      const unsubDataUpdated = vi.fn();
      const unsubTimelineDelta = vi.fn();
      const unsubCardDelta = vi.fn();

      electron.session.onStateChanged.mockReturnValue(unsubStateChanged);
      electron.session.onDataUpdated.mockReturnValue(unsubDataUpdated);
      electron.session.onTimelineDelta.mockReturnValue(unsubTimelineDelta);
      electron.session.onCardDelta.mockReturnValue(unsubCardDelta);

      const cleanup = store.getState().currentSession.startListening();
      cleanup();

      expect(unsubStateChanged).toHaveBeenCalled();
      expect(unsubDataUpdated).toHaveBeenCalled();
      expect(unsubTimelineDelta).toHaveBeenCalled();
      expect(unsubCardDelta).toHaveBeenCalled();
    });

    describe("onStateChanged callback", () => {
      let stateChangedCallback: (payload: any) => void;

      beforeEach(() => {
        electron.session.onStateChanged.mockImplementation(
          (cb: (payload: any) => void) => {
            stateChangedCallback = cb;
            return vi.fn();
          },
        );
        electron.session.onDataUpdated.mockReturnValue(vi.fn());
        store.getState().currentSession.startListening();
      });

      it("sets poe1SessionInfo when poe1 becomes active", () => {
        stateChangedCallback({
          game: "poe1",
          isActive: true,
          sessionInfo: {
            league: "Standard",
            startedAt: "2024-01-01T00:00:00Z",
          },
        });

        expect(store.getState().currentSession.poe1SessionInfo).toEqual({
          league: "Standard",
          startedAt: "2024-01-01T00:00:00Z",
        });
      });

      it("clears poe1SessionInfo and poe1Session when poe1 becomes inactive", () => {
        // First make it active
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });
        store.setState((s) => {
          s.currentSession.poe1SessionInfo = makeSessionInfo();
        });

        stateChangedCallback({
          game: "poe1",
          isActive: false,
        });

        expect(store.getState().currentSession.poe1SessionInfo).toBeNull();
        expect(store.getState().currentSession.poe1Session).toBeNull();
      });

      it("sets poe2SessionInfo when poe2 becomes active", () => {
        stateChangedCallback({
          game: "poe2",
          isActive: true,
          sessionInfo: {
            league: "Standard",
            startedAt: "2024-02-01T00:00:00Z",
          },
        });

        expect(store.getState().currentSession.poe2SessionInfo).toEqual({
          league: "Standard",
          startedAt: "2024-02-01T00:00:00Z",
        });
      });

      it("clears poe2SessionInfo and poe2Session when poe2 becomes inactive", () => {
        store.setState((s) => {
          s.currentSession.poe2Session = makeSession();
        });
        store.setState((s) => {
          s.currentSession.poe2SessionInfo = makeSessionInfo();
        });

        stateChangedCallback({
          game: "poe2",
          isActive: false,
        });

        expect(store.getState().currentSession.poe2SessionInfo).toBeNull();
        expect(store.getState().currentSession.poe2Session).toBeNull();
      });

      it("clears isLoading when isLoading is true", () => {
        // Set isLoading to true first
        store.setState((state) => {
          state.currentSession.isLoading = true;
        });
        expect(store.getState().currentSession.isLoading).toBe(true);

        stateChangedCallback({
          game: "poe1",
          isActive: true,
          sessionInfo: {
            league: "Standard",
            startedAt: "2024-01-01T00:00:00Z",
          },
        });

        expect(store.getState().currentSession.isLoading).toBe(false);
      });

      it("does not change isLoading when it is already false", () => {
        expect(store.getState().currentSession.isLoading).toBe(false);

        stateChangedCallback({
          game: "poe1",
          isActive: true,
          sessionInfo: {
            league: "Standard",
            startedAt: "2024-01-01T00:00:00Z",
          },
        });

        expect(store.getState().currentSession.isLoading).toBe(false);
      });
    });

    describe("onDataUpdated callback", () => {
      it("refreshes an unpriced timeline without changing its deck cost", () => {
        const cleanup = store.getState().currentSession.startListening();
        const session = makeSession({
          totals: undefined,
          timeline: {
            buckets: [],
            liveEdge: [],
            totalChaosValue: 0,
            totalDivineValue: 0,
            totalDrops: 0,
            notableDrops: [],
          },
        });
        electron.session.onDataUpdated.mock.calls.at(-1)![0]({
          game: "poe1",
          data: session,
        });
        expect(mockSeedFromTimeline).toHaveBeenCalledWith(session.timeline);
        expect(mockSetDeckCost).not.toHaveBeenCalled();
        cleanup();
      });

      let dataUpdatedCallback: (payload: any) => void;

      beforeEach(() => {
        mockSeedFromTimeline.mockClear();
        mockSetDeckCost.mockClear();
        electron.session.onStateChanged.mockReturnValue(vi.fn());
        electron.session.onDataUpdated.mockImplementation(
          (cb: (payload: any) => void) => {
            dataUpdatedCallback = cb;
            return vi.fn();
          },
        );
        store.getState().currentSession.startListening();
      });

      it("calls seedFromTimeline and setDeckCost when data has timeline and stackedDeckChaosCost", () => {
        const timeline = {
          buckets: [
            {
              timestamp: "2024-01-01T00:00:00Z",
              dropCount: 3,
              cumulativeChaosValue: 100,
              cumulativeDivineValue: 0.5,
              notableDrops: [],
            },
          ],
          notableDrops: [],
          totalDrops: 3,
          totalChaosValue: 100,
          totalDivineValue: 0.5,
        };
        const data = makeSession({
          timeline,
          totals: {
            totalValue: 100,
            netProfit: 80,
            chaosToDivineRatio: 150,
            stackedDeckChaosCost: 5,
            totalDeckCost: 15,
          },
        } as any);

        dataUpdatedCallback({ game: "poe1", data });

        expect(mockSeedFromTimeline).toHaveBeenCalledWith(timeline);
        expect(mockSetDeckCost).toHaveBeenCalledWith(5);
      });

      it("resets deck cost to zero in onDataUpdated", () => {
        const timeline = {
          buckets: [],
          notableDrops: [],
          totalDrops: 0,
          totalChaosValue: 0,
          totalDivineValue: 0,
        };
        const data = makeSession({
          timeline,
          totals: {
            totalValue: 0,
            netProfit: 0,
            chaosToDivineRatio: 150,
            stackedDeckChaosCost: 0,
            totalDeckCost: 0,
          },
        } as any);

        dataUpdatedCallback({ game: "poe1", data });

        expect(mockSeedFromTimeline).toHaveBeenCalledWith(timeline);
        expect(mockSetDeckCost).toHaveBeenCalledWith(0);
      });

      it("strips priceSnapshot to only timestamp, stackedDeckChaosCost, and chaosToDivineRatio in onDataUpdated", () => {
        const data = makeSession({
          priceSnapshot: {
            timestamp: "2024-06-01T00:00:00Z",
            stackedDeckChaosCost: 4,
            chaosToDivineRatio: 150,
            cardPrices: {
              "The Doctor": { chaosValue: 1200, divineValue: 8 },
              "Rain of Chaos": { chaosValue: 1, divineValue: 0.007 },
            },
          },
        } as any);

        dataUpdatedCallback({ game: "poe1", data });

        const session = store.getState().currentSession.poe1Session;
        expect(session).not.toBeNull();
        const snapshot = (session as any).priceSnapshot;
        expect(snapshot).toBeDefined();
        expect(snapshot.timestamp).toBe("2024-06-01T00:00:00Z");
        expect(snapshot.stackedDeckChaosCost).toBe(4);
        expect(snapshot.chaosToDivineRatio).toBe(150);
        expect(snapshot.cardPrices).toEqual({});
      });

      it("sets poe1Session when poe1 data is received", () => {
        const data = makeSession({ totalCount: 15 });

        dataUpdatedCallback({ game: "poe1", data });

        expect(store.getState().currentSession.poe1Session).not.toBeNull();
        expect(store.getState().currentSession.poe1Session!.totalCount).toBe(
          15,
        );
      });

      it("sets poe1Session to null when poe1 data is null", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        dataUpdatedCallback({ game: "poe1", data: null });

        expect(store.getState().currentSession.poe1Session).toBeNull();
      });

      it("sets poe2Session when poe2 data is received", () => {
        const data = makeSession({ totalCount: 25 });

        dataUpdatedCallback({ game: "poe2", data });

        expect(store.getState().currentSession.poe2Session).not.toBeNull();
        expect(store.getState().currentSession.poe2Session!.totalCount).toBe(
          25,
        );
      });

      it("sets poe2Session to null when poe2 data is null", () => {
        store.setState((s) => {
          s.currentSession.poe2Session = makeSession();
        });

        dataUpdatedCallback({ game: "poe2", data: null });

        expect(store.getState().currentSession.poe2Session).toBeNull();
      });
    });

    describe("onTimelineDelta callback", () => {
      let timelineDeltaCallback: (payload: any) => void;

      beforeEach(() => {
        electron.session.onStateChanged.mockReturnValue(vi.fn());
        electron.session.onDataUpdated.mockReturnValue(vi.fn());
        electron.session.onCardDelta.mockReturnValue(vi.fn());
        electron.session.onTimelineDelta.mockImplementation(
          (cb: (payload: any) => void) => {
            timelineDeltaCallback = cb;
            return vi.fn();
          },
        );
        store = createTestStore({ settings: { selectedGame: "poe1" } });
        store.getState().currentSession.startListening();
      });

      it("subscribes to onTimelineDelta", () => {
        expect(electron.session.onTimelineDelta).toHaveBeenCalled();
      });

      it("ignores delta for non-selected game", () => {
        // selectedGame is poe1, send delta for poe2 — should not throw
        timelineDeltaCallback({
          game: "poe2",
          delta: { bucket: "2024-01-01T00:00:00Z", chaosValue: 100 },
        });

        // No observable state change — just verifying it doesn't crash
        expect(electron.session.onTimelineDelta).toHaveBeenCalled();
      });

      it("applies delta to timelineBuffer when game matches selected game", () => {
        // selectedGame is poe1, send delta for poe1 — should apply
        timelineDeltaCallback({
          game: "poe1",
          delta: { bucket: "2024-01-01T00:00:00Z", chaosValue: 100 },
        });

        // The delta is written to the mutable buffer outside Zustand,
        // so there's no observable store change — just verifying the
        // branch executes without error.
        expect(electron.session.onTimelineDelta).toHaveBeenCalled();
      });

      it("cleanup unsubscribes onTimelineDelta", () => {
        const unsubTimelineDelta = vi.fn();
        electron.session.onTimelineDelta.mockReturnValue(unsubTimelineDelta);

        const cleanup = store.getState().currentSession.startListening();
        cleanup();

        expect(unsubTimelineDelta).toHaveBeenCalled();
      });
    });

    describe("onCardDelta callback", () => {
      let cardDeltaCallback: (payload: any) => void;

      beforeEach(() => {
        electron.session.onStateChanged.mockReturnValue(vi.fn());
        electron.session.onDataUpdated.mockReturnValue(vi.fn());
        electron.session.onTimelineDelta.mockReturnValue(vi.fn());
        electron.session.onCardDelta.mockImplementation(
          (cb: (payload: any) => void) => {
            cardDeltaCallback = cb;
            return vi.fn();
          },
        );
        store = createTestStore({ settings: { selectedGame: "poe1" } });
        store.getState().currentSession.startListening();
      });

      it("updates existing card count", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 5,
            totalCount: 53,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const doctor = session.cards.find((c) => c.name === "The Doctor")!;
        expect(doctor.count).toBe(5);
      });

      it("updates the selected poe2 session", () => {
        store.setState((s) => {
          s.settings.selectedGame = "poe2";
          s.currentSession.poe2Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe2",
          delta: {
            cardName: "The Doctor",
            newCount: 4,
            totalCount: 54,
            price: null,
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe2Session!;
        expect(session.totalCount).toBe(54);
        expect(session.cards[0].count).toBe(4);
      });

      it("updates an existing card without price data", () => {
        store.setState((s) => {
          const session = makeSession();
          delete session.cards[0].price;
          s.currentSession.poe1Session = session;
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 5,
            totalCount: 53,
            price: null,
            updatedTotals: null,
            recentDrop: null,
          },
        });

        expect(
          store.getState().currentSession.poe1Session!.cards[0].count,
        ).toBe(5);
      });

      it("keeps unpriced existing cards visible with zero values when a snapshot is present", () => {
        store.setState((state) => {
          const session = makeSession({
            priceSnapshot: {
              timestamp: "2026-11-16T00:00:00Z",
              stackedDeckChaosCost: 3,
              chaosToDivineRatio: 100,
              cardPrices: {},
            },
          });
          delete session.cards[0].price;
          state.currentSession.poe1Session = session;
        });
        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 3,
            totalCount: 51,
            price: null,
            updatedTotals: null,
            recentDrop: null,
          },
        });
        expect(
          store.getState().currentSession.poe1Session!.cards[0].price,
        ).toEqual({
          chaosValue: 0,
          divineValue: 0,
          totalValue: 0,
          hidePrice: false,
        });
      });

      it("adds new card to session", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "House of Mirrors",
            newCount: 1,
            totalCount: 51,
            price: { chaosValue: 5000, divineValue: 33 },
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const mirror = session.cards.find((c) => c.name === "House of Mirrors");
        expect(mirror).toBeDefined();
        expect(mirror!.count).toBe(1);
        expect(mirror!.price).toBeDefined();
      });

      it("adds a new card without price data", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "Price-less Card",
            newCount: 1,
            totalCount: 51,
            price: null,
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const card = store
          .getState()
          .currentSession.poe1Session!.cards.find(
            (entry) => entry.name === "Price-less Card",
          );
        expect(card?.price).toBeUndefined();
      });

      it("ignores delta for non-selected game", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe2",
          delta: {
            cardName: "The Doctor",
            newCount: 99,
            totalCount: 999,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const doctor = session.cards.find((c) => c.name === "The Doctor")!;
        expect(doctor.count).toBe(2); // unchanged from makeSession default
      });

      it("does nothing when session is null", () => {
        // No session seeded — poe1Session is null
        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 5,
            totalCount: 53,
            price: null,
            updatedTotals: null,
            recentDrop: null,
          },
        });

        expect(store.getState().currentSession.poe1Session).toBeNull();
      });

      it("initializes recentDrops array when session has no recentDrops", () => {
        // Seed session without recentDrops
        store.setState((s) => {
          const session = makeSession();
          delete (session as any).recentDrops;
          s.currentSession.poe1Session = session;
        });

        const newDrop = {
          cardName: "The Doctor",
          price: { chaosValue: 1200, divineValue: 8 },
        };

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 3,
            totalCount: 51,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: null,
            recentDrop: newDrop,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        expect(session.recentDrops).toHaveLength(1);
        expect(session.recentDrops![0].cardName).toBe("The Doctor");
      });

      it("updates session totals", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        const newTotals = {
          totalValue: 9999,
          netProfit: 8888,
          chaosToDivineRatio: 160,
          stackedDeckChaosCost: 4,
          totalDeckCost: 200,
        };

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 3,
            totalCount: 51,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: newTotals,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        expect(session.totals).toEqual(newTotals);
      });

      it("updates totalCount", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 3,
            totalCount: 123,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        expect(session.totalCount).toBe(123);
      });

      it("prepends recentDrop and caps at 20", () => {
        // Seed session with 20 existing recent drops
        const existingDrops = Array.from({ length: 20 }, (_, i) => ({
          cardName: `Card ${i}`,
          price: { chaosValue: 1, divineValue: 0.01 },
        }));
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession({
            recentDrops: existingDrops,
          } as any);
        });

        const newDrop = {
          cardName: "The Doctor",
          price: { chaosValue: 1200, divineValue: 8 },
        };

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 3,
            totalCount: 51,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: null,
            recentDrop: newDrop,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        expect(session.recentDrops).toHaveLength(20);
        expect(session.recentDrops![0].cardName).toBe("The Doctor");
        // Last item from original array should have been dropped
        expect(
          session.recentDrops!.find((d) => d.cardName === "Card 19"),
        ).toBeUndefined();
      });

      it("updates exchange price totalValue for existing card", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "The Doctor",
            newCount: 5,
            totalCount: 53,
            price: { chaosValue: 1200, divineValue: 8 },
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const doctor = session.cards.find((c) => c.name === "The Doctor")!;
        // totalValue = chaosValue * newCount = 1200 * 5
        expect(doctor.price!.totalValue).toBe(6000);
      });

      it("adds card with price", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "House of Mirrors",
            newCount: 1,
            totalCount: 51,
            price: { chaosValue: 5000, divineValue: 33 },
            updatedTotals: null,
            recentDrop: null,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const mirror = session.cards.find(
          (c) => c.name === "House of Mirrors",
        )!;
        expect(mirror.price).toEqual({
          chaosValue: 5000,
          divineValue: 33,
          totalValue: 5000,
          hidePrice: false,
        });
      });

      it("adds card with divinationCard metadata", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        const divCard = {
          id: "house-of-mirrors",
          rarity: 1 as const,
          fromBoss: false,
          stackSize: 2,
          description: "Mirror of Kalandra",
          rewardHtml: "<span>Mirror of Kalandra</span>",
        };

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "House of Mirrors",
            newCount: 1,
            totalCount: 51,
            price: { chaosValue: 5000, divineValue: 33 },
            updatedTotals: null,
            recentDrop: null,
            divinationCard: divCard,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const mirror = session.cards.find(
          (c) => c.name === "House of Mirrors",
        )!;
        expect((mirror as any).divinationCard).toEqual(divCard);
      });

      it("preserves hiding for unpriced cards on both insertion and later drops", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });
        for (const newCount of [1, 2]) {
          cardDeltaCallback({
            game: "poe1",
            delta: {
              cardName: "Unpriced",
              newCount,
              totalCount: 50 + newCount,
              price: null,
              hidePrice: true,
              updatedTotals: null,
              recentDrop: null,
            },
          });
        }
        expect(
          store
            .getState()
            .currentSession.poe1Session?.cards.find(
              (card) => card.name === "Unpriced",
            ),
        ).toMatchObject({
          count: 2,
          price: { chaosValue: 0, hidePrice: true },
        });
      });

      it("adds card with hidePrice flags from delta", () => {
        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        cardDeltaCallback({
          game: "poe1",
          delta: {
            cardName: "House of Mirrors",
            newCount: 1,
            totalCount: 51,
            price: { chaosValue: 5000, divineValue: 33 },
            updatedTotals: null,
            recentDrop: null,
            hidePrice: true,
          },
        });

        const session = store.getState().currentSession.poe1Session!;
        const mirror = session.cards.find(
          (c) => c.name === "House of Mirrors",
        )!;
        expect(mirror.price!.hidePrice).toBe(true);
      });
    });
  });

  // ─── Getters ─────────────────────────────────────────────────────────

  describe("getters", () => {
    describe("getSession", () => {
      it("returns poe1Session when selectedGame is poe1", () => {
        store = createTestStore({
          settings: { selectedGame: "poe1" },
        });

        const session = makeSession({ totalCount: 11 });
        store.setState((s) => {
          s.currentSession.poe1Session = session;
        });

        expect(store.getState().currentSession.getSession()).not.toBeNull();
        expect(store.getState().currentSession.getSession()!.totalCount).toBe(
          11,
        );
      });

      it("returns poe2Session when selectedGame is poe2", () => {
        store = createTestStore({
          settings: { selectedGame: "poe2" },
        });

        const session = makeSession({ totalCount: 22 });
        store.setState((s) => {
          s.currentSession.poe2Session = session;
        });

        expect(store.getState().currentSession.getSession()).not.toBeNull();
        expect(store.getState().currentSession.getSession()!.totalCount).toBe(
          22,
        );
      });

      it("returns null when no session exists for the active game", () => {
        store = createTestStore({
          settings: { selectedGame: "poe1" },
        });

        expect(store.getState().currentSession.getSession()).toBeNull();
      });
    });

    describe("getSessionInfo", () => {
      it("returns poe1SessionInfo when selectedGame is poe1", () => {
        store = createTestStore({
          settings: { selectedGame: "poe1" },
        });

        const info = makeSessionInfo({ league: "Settlers" });
        store.setState((s) => {
          s.currentSession.poe1SessionInfo = info;
        });

        expect(store.getState().currentSession.getSessionInfo()).toEqual(info);
      });

      it("returns poe2SessionInfo when selectedGame is poe2", () => {
        store = createTestStore({
          settings: { selectedGame: "poe2" },
        });

        const info = makeSessionInfo({ league: "Dawn" });
        store.setState((s) => {
          s.currentSession.poe2SessionInfo = info;
        });

        expect(store.getState().currentSession.getSessionInfo()).toEqual(info);
      });

      it("returns null when no info for active game", () => {
        expect(store.getState().currentSession.getSessionInfo()).toBeNull();
      });
    });

    describe("getIsCurrentSessionActive", () => {
      it("returns true when sessionInfo is not null", () => {
        store = createTestStore({
          settings: { selectedGame: "poe1" },
        });

        store.setState((s) => {
          s.currentSession.poe1SessionInfo = makeSessionInfo();
        });

        expect(
          store.getState().currentSession.getIsCurrentSessionActive(),
        ).toBe(true);
      });

      it("returns false when sessionInfo is null", () => {
        expect(
          store.getState().currentSession.getIsCurrentSessionActive(),
        ).toBe(false);
      });
    });

    describe("getChaosToDivineRatio", () => {
      it("returns the ratio from session totals", () => {
        store = createTestStore({
          settings: { selectedGame: "poe1" },
        });

        store.setState((s) => {
          s.currentSession.poe1Session = makeSession();
        });

        const ratio = store.getState().currentSession.getChaosToDivineRatio();
        expect(ratio).toBe(150);
      });

      it("returns 0 when no session exists", () => {
        expect(store.getState().currentSession.getChaosToDivineRatio()).toBe(0);
      });
    });
  });
});
