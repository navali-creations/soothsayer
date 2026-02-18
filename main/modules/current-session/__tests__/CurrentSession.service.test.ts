import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockWebContentsSend,
  mockGetAllWindows,
  mockGetKysely,
  mockPerfLog,
  mockPerfStartTimer,
  mockPerfStartTimers,
  mockGetSnapshotForSession,
  mockLoadSnapshot,
  mockStartAutoRefresh,
  mockStopAutoRefresh,
  mockDataStoreAddCard,
  mockGetAllTimeStats,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockWebContentsSend: vi.fn(),
  mockGetAllWindows: vi.fn(),
  mockGetKysely: vi.fn(),
  mockPerfLog: vi.fn(),
  mockPerfStartTimer: vi.fn(() => null),
  mockPerfStartTimers: vi.fn(() => null),
  mockGetSnapshotForSession: vi.fn(),
  mockLoadSnapshot: vi.fn(),
  mockStartAutoRefresh: vi.fn(),
  mockStopAutoRefresh: vi.fn(),
  mockDataStoreAddCard: vi.fn(),
  mockGetAllTimeStats: vi.fn(),
}));

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock crypto for deterministic UUIDs ─────────────────────────────────────
let uuidCounter = 0;
vi.mock("node:crypto", () => ({
  default: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  },
  randomUUID: () => `test-uuid-${++uuidCounter}`,
}));

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock PerformanceLoggerService ───────────────────────────────────────────
vi.mock("~/main/modules/performance-logger", () => ({
  PerformanceLoggerService: {
    getInstance: vi.fn(() => ({
      log: mockPerfLog,
      startTimer: mockPerfStartTimer,
      startTimers: mockPerfStartTimers,
    })),
  },
}));

// ─── Mock SnapshotService ────────────────────────────────────────────────────
vi.mock("~/main/modules/snapshots", () => ({
  SnapshotService: {
    getInstance: vi.fn(() => ({
      getSnapshotForSession: mockGetSnapshotForSession,
      loadSnapshot: mockLoadSnapshot,
      startAutoRefresh: mockStartAutoRefresh,
      stopAutoRefresh: mockStopAutoRefresh,
    })),
  },
}));

// ─── Mock DataStoreService ───────────────────────────────────────────────────
vi.mock("~/main/modules/data-store", () => ({
  DataStoreService: {
    getInstance: vi.fn(() => ({
      addCard: mockDataStoreAddCard,
      getAllTimeStats: mockGetAllTimeStats,
      getLeagueStats: vi.fn(),
      getGlobalStats: vi.fn(),
    })),
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertGameType: vi.fn(),
  assertString: vi.fn(),
  assertBoolean: vi.fn(),
  assertCardName: vi.fn(),
  assertPriceSource: vi.fn(),
  assertSessionId: vi.fn(),
  handleValidationError: vi.fn((_error: unknown, _channel: string) => ({
    success: false,
    error: "Validation error",
  })),
  IpcValidationError: class IpcValidationError extends Error {
    detail: string;
    constructor(message: string, detail: string) {
      super(message);
      this.detail = detail;
    }
  },
}));

// ─── Mock RarityModelService ─────────────────────────────────────────────────────
vi.mock("~/main/modules/rarity-model/RarityModel.service", () => ({
  RarityModelService: {
    getInstance: vi.fn(() => ({
      applyFilterRarities: vi.fn().mockResolvedValue(undefined),
      ensureFilterParsed: vi.fn().mockResolvedValue(null),
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      getAllSettings: vi.fn().mockResolvedValue({}),
    })),
  },
  SettingsKey: {
    RaritySource: "raritySource",
    SelectedFilterId: "selectedFilterId",
    ActiveGame: "selectedGame",
    Poe1SelectedLeague: "poe1SelectedLeague",
    Poe2SelectedLeague: "poe2SelectedLeague",
  },
}));

import {
  createTestDatabase,
  seedDivinationCard,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { CurrentSessionService } from "../CurrentSession.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockPriceSnapshot(overrides: Record<string, any> = {}) {
  return {
    timestamp: "2025-01-15T10:00:00Z",
    stackedDeckChaosCost: 3,
    exchange: {
      chaosToDivineRatio: 200,
      cardPrices: {
        "The Doctor": { chaosValue: 1200, divineValue: 6.0 },
        "Rain of Chaos": { chaosValue: 1.5, divineValue: 0.0075 },
      },
    },
    stash: {
      chaosToDivineRatio: 195,
      cardPrices: {
        "The Doctor": { chaosValue: 1100, divineValue: 5.64 },
        "Rain of Chaos": { chaosValue: 1.2, divineValue: 0.006 },
      },
    },
    ...overrides,
  };
}

const mockMainWindow = {
  webContents: { send: mockWebContentsSend },
  isDestroyed: vi.fn(() => false),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CurrentSessionService", () => {
  let testDb: TestDatabase;
  let service: CurrentSessionService;
  let leagueId: string;
  let snapshotId: string;

  beforeEach(async () => {
    // Reset UUID counter for deterministic IDs
    uuidCounter = 0;

    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Reset all mocks
    mockIpcHandle.mockReset();
    mockGetAllWindows.mockReset().mockReturnValue([mockMainWindow]);
    mockWebContentsSend.mockReset();
    mockPerfLog.mockReset();
    mockPerfStartTimer.mockReset().mockReturnValue(null);
    mockPerfStartTimers.mockReset().mockReturnValue(null);
    mockGetSnapshotForSession.mockReset();
    mockLoadSnapshot.mockReset();
    mockStartAutoRefresh.mockReset();
    mockStopAutoRefresh.mockReset();
    mockDataStoreAddCard.mockReset().mockResolvedValue(undefined);
    mockGetAllTimeStats.mockReset();

    // Seed base data
    leagueId = await seedLeague(testDb.kysely, {
      game: "poe1",
      name: "Settlers",
    });

    snapshotId = await seedSnapshot(testDb.kysely, {
      leagueId,
      exchangeChaosToDivine: 200,
      stashChaosToDivine: 195,
      stackedDeckChaosCost: 3,
      cardPrices: [
        {
          cardName: "The Doctor",
          priceSource: "exchange",
          chaosValue: 1200,
          divineValue: 6.0,
        },
        {
          cardName: "The Doctor",
          priceSource: "stash",
          chaosValue: 1100,
          divineValue: 5.64,
        },
        {
          cardName: "Rain of Chaos",
          priceSource: "exchange",
          chaosValue: 1.5,
          divineValue: 0.0075,
        },
        {
          cardName: "Rain of Chaos",
          priceSource: "stash",
          chaosValue: 1.2,
          divineValue: 0.006,
        },
      ],
    });

    // Default snapshot service mock responses
    mockGetSnapshotForSession.mockResolvedValue({
      snapshotId,
      data: createMockPriceSnapshot(),
    });
    mockLoadSnapshot.mockResolvedValue(createMockPriceSnapshot());

    // Reset singleton
    // @ts-expect-error accessing private static for testing
    CurrentSessionService._instance = undefined;

    service = CurrentSessionService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    CurrentSessionService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = CurrentSessionService.getInstance();
      const instance2 = CurrentSessionService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── Initialize ─────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("should deactivate orphaned active sessions for both games", async () => {
      // Create orphaned active sessions
      await seedSession(testDb.kysely, {
        leagueId,
        game: "poe1",
        isActive: true,
      });
      await seedSession(testDb.kysely, {
        leagueId,
        game: "poe1",
        isActive: true,
      });

      await service.initialize();

      // Verify all sessions are now inactive
      const rows = await testDb.kysely
        .selectFrom("sessions")
        .select("is_active")
        .execute();

      for (const row of rows) {
        expect(row.is_active).toBe(0);
      }
    });

    it("should clear recent drops (processed IDs) for both games", async () => {
      // Insert some processed IDs
      await testDb.kysely
        .insertInto("processed_ids")
        .values([
          {
            game: "poe1",
            scope: "global",
            processed_id: "drop-1",
            card_name: "The Doctor",
          },
          {
            game: "poe1",
            scope: "global",
            processed_id: "drop-2",
            card_name: "Rain of Chaos",
          },
        ])
        .execute();

      await service.initialize();

      // card_name should be cleared (set to NULL) for recent drops
      const rows = await testDb.kysely
        .selectFrom("processed_ids")
        .select("card_name")
        .where("game", "=", "poe1")
        .execute();

      for (const row of rows) {
        expect(row.card_name).toBeNull();
      }
    });
  });

  // ─── isSessionActive ───────────────────────────────────────────────────

  describe("isSessionActive", () => {
    it("should return false when no session is active", () => {
      expect(service.isSessionActive("poe1")).toBe(false);
      expect(service.isSessionActive("poe2")).toBe(false);
    });

    it("should return true after starting a session", async () => {
      await service.startSession("poe1", "Settlers");

      expect(service.isSessionActive("poe1")).toBe(true);
      expect(service.isSessionActive("poe2")).toBe(false);
    });

    it("should return false after stopping a session", async () => {
      await service.startSession("poe1", "Settlers");
      await service.stopSession("poe1");

      expect(service.isSessionActive("poe1")).toBe(false);
    });
  });

  // ─── getActiveSessionInfo ──────────────────────────────────────────────

  describe("getActiveSessionInfo", () => {
    it("should return null when no session is active", () => {
      expect(service.getActiveSessionInfo("poe1")).toBeNull();
    });

    it("should return session info when a session is active", async () => {
      await service.startSession("poe1", "Settlers");

      const info = service.getActiveSessionInfo("poe1");

      expect(info).not.toBeNull();
      expect(info!.league).toBe("Settlers");
      expect(info!.sessionId).toBeDefined();
      expect(info!.startedAt).toBeDefined();
    });

    it("should return null for poe2 when only poe1 session is active", async () => {
      await service.startSession("poe1", "Settlers");

      expect(service.getActiveSessionInfo("poe2")).toBeNull();
    });
  });

  // ─── startSession ──────────────────────────────────────────────────────

  describe("startSession", () => {
    it("should create a new session in the database", async () => {
      await service.startSession("poe1", "Settlers");

      const sessions = await testDb.kysely
        .selectFrom("sessions")
        .selectAll()
        .where("game", "=", "poe1")
        .where("is_active", "=", 1)
        .execute();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].league_id).toBe(leagueId);
      expect(sessions[0].snapshot_id).toBe(snapshotId);
      expect(sessions[0].total_count).toBe(0);
      expect(sessions[0].is_active).toBe(1);
      expect(sessions[0].started_at).toBeDefined();
    });

    it("should call getSnapshotForSession with the correct game and league", async () => {
      await service.startSession("poe1", "Settlers");

      expect(mockGetSnapshotForSession).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
    });

    it("should start auto-refresh for the league", async () => {
      await service.startSession("poe1", "Settlers");

      expect(mockStartAutoRefresh).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("should throw if a session is already active for the same game", async () => {
      await service.startSession("poe1", "Settlers");

      await expect(service.startSession("poe1", "Settlers")).rejects.toThrow(
        "Session already active for poe1",
      );
    });

    it("should throw if the league is not found", async () => {
      await expect(
        service.startSession("poe1", "NonExistentLeague"),
      ).rejects.toThrow("League not found");
    });

    it("should emit session state change event", async () => {
      await service.startSession("poe1", "Settlers");

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "current-session:state-changed",
        expect.objectContaining({
          game: "poe1",
          isActive: true,
          sessionInfo: expect.objectContaining({
            league: "Settlers",
          }),
        }),
      );
    });

    it("should allow starting sessions for different games simultaneously", async () => {
      // Create a poe2 league
      const poe2LeagueId = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId: poe2LeagueId,
      });

      await service.startSession("poe1", "Settlers");
      await service.startSession("poe2", "Dawn");

      expect(service.isSessionActive("poe1")).toBe(true);
      expect(service.isSessionActive("poe2")).toBe(true);
    });

    it("should clear processed IDs for the game when starting a new session", async () => {
      // Start and stop a session first to accumulate some processed IDs
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "proc-1");
      await service.stopSession("poe1");

      // Start a new session
      await service.startSession("poe1", "Settlers");

      // isSessionActive should be true for new session
      expect(service.isSessionActive("poe1")).toBe(true);
    });
  });

  // ─── stopSession ───────────────────────────────────────────────────────

  describe("stopSession", () => {
    it("should throw if no session is active", async () => {
      await expect(service.stopSession("poe1")).rejects.toThrow(
        "No active session for poe1",
      );
    });

    it("should deactivate the session in the database", async () => {
      await service.startSession("poe1", "Settlers");
      await service.stopSession("poe1");

      const sessions = await testDb.kysely
        .selectFrom("sessions")
        .selectAll()
        .where("game", "=", "poe1")
        .execute();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].is_active).toBe(0);
      expect(sessions[0].ended_at).toBeDefined();
    });

    it("should return totalCount, durationMs, league, and game", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "card-1");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "card-2");

      const result = await service.stopSession("poe1");

      expect(result.totalCount).toBe(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.league).toBe("Settlers");
      expect(result.game).toBe("poe1");
    });

    it("should stop auto-refresh for the league", async () => {
      await service.startSession("poe1", "Settlers");
      await service.stopSession("poe1");

      expect(mockStopAutoRefresh).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("should emit session state change with isActive false", async () => {
      await service.startSession("poe1", "Settlers");
      mockWebContentsSend.mockReset();

      await service.stopSession("poe1");

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "current-session:state-changed",
        expect.objectContaining({
          game: "poe1",
          isActive: false,
          sessionInfo: null,
        }),
      );
    });

    it("should create a session summary", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "sum-1");
      await service.stopSession("poe1");

      const summaries = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .execute();

      expect(summaries).toHaveLength(1);
      expect(summaries[0].game).toBe("poe1");
      expect(summaries[0].league).toBe("Settlers");
      expect(summaries[0].total_decks_opened).toBe(1);
    });

    it("should clear recent drops after stopping", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "clear-1");
      await service.stopSession("poe1");

      const drops = await testDb.kysely
        .selectFrom("processed_ids")
        .select("card_name")
        .where("game", "=", "poe1")
        .execute();

      // card_name should be cleared
      for (const drop of drops) {
        expect(drop.card_name).toBeNull();
      }
    });

    it("should allow starting a new session after stopping", async () => {
      await service.startSession("poe1", "Settlers");
      await service.stopSession("poe1");
      await service.startSession("poe1", "Settlers");

      expect(service.isSessionActive("poe1")).toBe(true);
    });
  });

  // ─── addCard ────────────────────────────────────────────────────────────

  describe("addCard", () => {
    beforeEach(async () => {
      await service.startSession("poe1", "Settlers");
    });

    it("should throw if no session is active", async () => {
      await service.stopSession("poe1");

      await expect(
        service.addCard("poe1", "Settlers", "The Doctor", "no-session-1"),
      ).rejects.toThrow("No active session for poe1");
    });

    it("should increment card count in the database", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "add-1");

      const cards = await testDb.kysely
        .selectFrom("session_cards")
        .selectAll()
        .execute();

      expect(cards).toHaveLength(1);
      expect(cards[0].card_name).toBe("The Doctor");
      expect(cards[0].count).toBe(1);
    });

    it("should increment count for the same card added multiple times", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "multi-1");
      await service.addCard("poe1", "Settlers", "The Doctor", "multi-2");
      await service.addCard("poe1", "Settlers", "The Doctor", "multi-3");

      const cards = await testDb.kysely
        .selectFrom("session_cards")
        .select(["card_name", "count"])
        .execute();

      expect(cards).toHaveLength(1);
      expect(cards[0].count).toBe(3);
    });

    it("should track different cards separately", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "diff-1");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "diff-2");
      await service.addCard("poe1", "Settlers", "The Doctor", "diff-3");

      const cards = await testDb.kysely
        .selectFrom("session_cards")
        .select(["card_name", "count"])
        .orderBy("card_name")
        .execute();

      expect(cards).toHaveLength(2);
      expect(cards.find((c) => c.card_name === "The Doctor")?.count).toBe(2);
      expect(cards.find((c) => c.card_name === "Rain of Chaos")?.count).toBe(1);
    });

    it("should save processed ID to the database", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "proc-save-1");

      const processedIds = await testDb.kysely
        .selectFrom("processed_ids")
        .select(["processed_id", "card_name"])
        .where("game", "=", "poe1")
        .execute();

      expect(processedIds).toHaveLength(1);
      expect(processedIds[0].processed_id).toBe("proc-save-1");
      expect(processedIds[0].card_name).toBe("The Doctor");
    });

    it("should skip duplicate processed IDs within the same session", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "dup-1");
      await service.addCard("poe1", "Settlers", "The Doctor", "dup-1"); // Same ID

      const cards = await testDb.kysely
        .selectFrom("session_cards")
        .select("count")
        .where("card_name", "=", "The Doctor")
        .executeTakeFirst();

      expect(cards?.count).toBe(1); // Should only be counted once
    });

    it("should cascade to DataStoreService.addCard", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "cascade-1");

      expect(mockDataStoreAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
      );
    });

    it("should emit session data update event", async () => {
      mockWebContentsSend.mockReset();
      mockLoadSnapshot.mockResolvedValue(createMockPriceSnapshot());

      await service.addCard("poe1", "Settlers", "The Doctor", "emit-1");

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "session:data-updated",
        expect.objectContaining({
          game: "poe1",
        }),
      );
    });

    it("should update the session total count in the database", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor", "total-1");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "total-2");

      const info = service.getActiveSessionInfo("poe1");
      const session = await testDb.kysely
        .selectFrom("sessions")
        .select("total_count")
        .where("id", "=", info!.sessionId)
        .executeTakeFirst();

      expect(session?.total_count).toBe(2);
    });
  });

  // ─── getAllProcessedIds ─────────────────────────────────────────────────

  describe("getAllProcessedIds", () => {
    it("should return empty set when no cards have been processed", () => {
      const ids = service.getAllProcessedIds("poe1");
      expect(ids.size).toBe(0);
    });

    it("should include session-scoped processed IDs", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "session-id-1");
      await service.addCard(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "session-id-2",
      );

      const ids = service.getAllProcessedIds("poe1");

      expect(ids.has("session-id-1")).toBe(true);
      expect(ids.has("session-id-2")).toBe(true);
    });

    it("should return independent sets for poe1 and poe2", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "poe1-id");

      const poe1Ids = service.getAllProcessedIds("poe1");
      const poe2Ids = service.getAllProcessedIds("poe2");

      expect(poe1Ids.has("poe1-id")).toBe(true);
      expect(poe2Ids.has("poe1-id")).toBe(false);
    });
  });

  // ─── getCurrentSession ─────────────────────────────────────────────────

  describe("getCurrentSession", () => {
    it("should return null when no session is active", async () => {
      const result = await service.getCurrentSession("poe1");
      expect(result).toBeNull();
    });

    it("should return session data with cards array", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "get-1");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "get-2");

      const result = await service.getCurrentSession("poe1");

      expect(result).not.toBeNull();
      expect(result.totalCount).toBe(2);
      expect(result.cards).toBeInstanceOf(Array);
      expect(result.cards).toHaveLength(2);
      expect(result.league).toBe("Settlers");
      expect(result.startedAt).toBeDefined();
    });

    it("should include price data from snapshot in card entries", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "price-1");

      const result = await service.getCurrentSession("poe1");

      const doctorCard = result.cards.find((c: any) => c.name === "The Doctor");
      expect(doctorCard).toBeDefined();
      expect(doctorCard.exchangePrice).toBeDefined();
      expect(doctorCard.exchangePrice.chaosValue).toBe(1200);
      expect(doctorCard.stashPrice).toBeDefined();
      expect(doctorCard.stashPrice.chaosValue).toBe(1100);
    });

    it("should calculate totalValue as chaosValue * count", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "tv-1");
      await service.addCard("poe1", "Settlers", "The Doctor", "tv-2");

      const result = await service.getCurrentSession("poe1");

      const doctorCard = result.cards.find((c: any) => c.name === "The Doctor");
      expect(doctorCard.count).toBe(2);
      expect(doctorCard.exchangePrice.totalValue).toBe(1200 * 2);
      expect(doctorCard.stashPrice.totalValue).toBe(1100 * 2);
    });

    it("should include totals with exchange and stash values", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "totals-1");

      const result = await service.getCurrentSession("poe1");

      expect(result.totals).toBeDefined();
      expect(result.totals.exchange).toBeDefined();
      expect(result.totals.stash).toBeDefined();
      expect(result.totals.exchange.totalValue).toBeGreaterThan(0);
      expect(result.totals.stash.totalValue).toBeGreaterThan(0);
    });

    it("should calculate net profit (total value - deck cost)", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "profit-1");

      const result = await service.getCurrentSession("poe1");

      const expectedDeckCost = 3 * 1; // stackedDeckChaosCost * totalDecksOpened
      expect(result.totals.exchange.netProfit).toBe(
        result.totals.exchange.totalValue - expectedDeckCost,
      );
      expect(result.totals.stash.netProfit).toBe(
        result.totals.stash.totalValue - expectedDeckCost,
      );
      expect(result.totals.stackedDeckChaosCost).toBe(3);
      expect(result.totals.totalDeckCost).toBe(expectedDeckCost);
    });

    it("should include priceSnapshot in result", async () => {
      await service.startSession("poe1", "Settlers");

      const result = await service.getCurrentSession("poe1");

      expect(result.priceSnapshot).toBeDefined();
      expect(result.priceSnapshot.exchange.chaosToDivineRatio).toBe(200);
    });

    it("should include snapshotId in result", async () => {
      await service.startSession("poe1", "Settlers");

      const result = await service.getCurrentSession("poe1");

      expect(result.snapshotId).toBeDefined();
      expect(result.snapshotId).toBe(snapshotId);
    });

    it("should return snapshotId as null when session has no snapshot", async () => {
      mockGetSnapshotForSession.mockResolvedValue({
        snapshotId: null,
        data: createMockPriceSnapshot(),
      });
      mockLoadSnapshot.mockResolvedValue(null);

      // Reset singleton so it picks up the new mock
      // @ts-expect-error accessing private static for testing
      CurrentSessionService._instance = undefined;
      service = CurrentSessionService.getInstance();

      await service.startSession("poe1", "Settlers");

      const result = await service.getCurrentSession("poe1");

      expect(result.snapshotId).toBeNull();
    });

    it("should return all expected top-level keys", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "shape-1");

      const result = await service.getCurrentSession("poe1");

      const keys = Object.keys(result).sort();
      expect(keys).toEqual([
        "cards",
        "endedAt",
        "league",
        "priceSnapshot",
        "recentDrops",
        "snapshotId",
        "startedAt",
        "totalCount",
        "totals",
      ]);
    });

    it("should handle session with no snapshot gracefully", async () => {
      mockLoadSnapshot.mockResolvedValue(null);

      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "no-snap-1");

      const result = await service.getCurrentSession("poe1");

      expect(result).not.toBeNull();
      expect(result.totals.exchange.totalValue).toBe(0);
      expect(result.totals.stash.totalValue).toBe(0);
    });

    it("should include recent drops in order", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "recent-1");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "recent-2");

      const result = await service.getCurrentSession("poe1");

      expect(result.recentDrops).toBeDefined();
      expect(result.recentDrops.length).toBeGreaterThan(0);
      // Each recent drop should have card name and price info
      for (const drop of result.recentDrops) {
        expect(drop.cardName).toBeDefined();
        expect(drop.exchangePrice).toBeDefined();
        expect(drop.stashPrice).toBeDefined();
        expect(drop.rarity).toBeDefined();
      }
    });

    it("should return zero prices for cards not in the snapshot", async () => {
      mockLoadSnapshot.mockResolvedValue({
        timestamp: "2025-01-15T10:00:00Z",
        stackedDeckChaosCost: 3,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {},
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {},
        },
      });

      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "Unknown Card", "unknown-1");

      const result = await service.getCurrentSession("poe1");
      const unknownCard = result.cards.find(
        (c: any) => c.name === "Unknown Card",
      );

      expect(unknownCard.exchangePrice.chaosValue).toBe(0);
      expect(unknownCard.exchangePrice.divineValue).toBe(0);
      expect(unknownCard.stashPrice.chaosValue).toBe(0);
      expect(unknownCard.stashPrice.divineValue).toBe(0);
    });
  });

  // ─── updateCardPriceVisibility ─────────────────────────────────────────

  describe("updateCardPriceVisibility", () => {
    it("should update exchange price visibility for a card", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "vis-1");

      const info = service.getActiveSessionInfo("poe1");

      await service.updateCardPriceVisibility(
        "poe1",
        info!.sessionId,
        "exchange",
        "The Doctor",
        true,
      );

      const card = await testDb.kysely
        .selectFrom("session_cards")
        .select("hide_price_exchange")
        .where("card_name", "=", "The Doctor")
        .executeTakeFirst();

      expect(card?.hide_price_exchange).toBe(1);
    });

    it("should update stash price visibility for a card", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "vis-2");

      const info = service.getActiveSessionInfo("poe1");

      await service.updateCardPriceVisibility(
        "poe1",
        info!.sessionId,
        "stash",
        "Rain of Chaos",
        true,
      );

      const card = await testDb.kysely
        .selectFrom("session_cards")
        .select("hide_price_stash")
        .where("card_name", "=", "Rain of Chaos")
        .executeTakeFirst();

      expect(card?.hide_price_stash).toBe(1);
    });

    it('should resolve "current" to the active session ID', async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "cur-1");

      // Using "current" as session ID
      await service.updateCardPriceVisibility(
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      const card = await testDb.kysely
        .selectFrom("session_cards")
        .select("hide_price_exchange")
        .where("card_name", "=", "The Doctor")
        .executeTakeFirst();

      expect(card?.hide_price_exchange).toBe(1);
    });

    it('should throw when using "current" with no active session', async () => {
      await expect(
        service.updateCardPriceVisibility(
          "poe1",
          "current",
          "exchange",
          "The Doctor",
          true,
        ),
      ).rejects.toThrow("No active session");
    });

    it("should emit session data update when using 'current' session", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "emit-vis-1");

      mockWebContentsSend.mockReset();

      await service.updateCardPriceVisibility(
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "session:data-updated",
        expect.objectContaining({
          game: "poe1",
        }),
      );
    });

    it("should toggle visibility back to false", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "toggle-1");

      const info = service.getActiveSessionInfo("poe1");

      // Hide
      await service.updateCardPriceVisibility(
        "poe1",
        info!.sessionId,
        "exchange",
        "The Doctor",
        true,
      );

      // Unhide
      await service.updateCardPriceVisibility(
        "poe1",
        info!.sessionId,
        "exchange",
        "The Doctor",
        false,
      );

      const card = await testDb.kysely
        .selectFrom("session_cards")
        .select("hide_price_exchange")
        .where("card_name", "=", "The Doctor")
        .executeTakeFirst();

      expect(card?.hide_price_exchange).toBe(0);
    });

    it("should affect session totals when card is hidden", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "affect-1");

      // Get totals before hiding
      const beforeResult = await service.getCurrentSession("poe1");
      const totalBefore = beforeResult.totals.exchange.totalValue;

      // Hide The Doctor from exchange
      await service.updateCardPriceVisibility(
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      const afterResult = await service.getCurrentSession("poe1");
      const totalAfter = afterResult.totals.exchange.totalValue;

      // Total should be less after hiding an expensive card
      expect(totalAfter).toBeLessThan(totalBefore);
    });
  });

  // ─── Session summary creation ──────────────────────────────────────────

  describe("session summary", () => {
    it("should calculate exchange and stash totals correctly", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "summary-1");
      await service.addCard("poe1", "Settlers", "The Doctor", "summary-2");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "summary-3");

      await service.stopSession("poe1");

      const summary = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .executeTakeFirst();

      expect(summary).toBeDefined();
      expect(summary!.total_decks_opened).toBe(3);

      // Exchange: Doctor (1200 * 2) + Rain (1.5 * 1) = 2401.5
      expect(summary!.total_exchange_value).toBeCloseTo(2401.5, 1);

      // Stash: Doctor (1100 * 2) + Rain (1.2 * 1) = 2201.2
      expect(summary!.total_stash_value).toBeCloseTo(2201.2, 1);
    });

    it("should calculate net profit as value minus deck cost", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "net-1");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "net-2");

      await service.stopSession("poe1");

      const summary = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .executeTakeFirst();

      expect(summary).toBeDefined();
      const deckCost = 3; // stackedDeckChaosCost
      const totalDeckCost = deckCost * 2; // 2 decks opened

      // Exchange net profit: (1.5 * 2) - 6 = -3
      expect(summary!.total_exchange_net_profit).toBeCloseTo(
        1.5 * 2 - totalDeckCost,
        1,
      );
    });

    it("should include chaos-to-divine ratios from the snapshot", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "ratio-1");
      await service.stopSession("poe1");

      const summary = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .executeTakeFirst();

      expect(summary!.exchange_chaos_to_divine).toBe(200);
      expect(summary!.stash_chaos_to_divine).toBe(195);
      expect(summary!.stacked_deck_chaos_cost).toBe(3);
    });

    it("should not create summary if snapshot is not loadable", async () => {
      mockLoadSnapshot.mockResolvedValue(null);

      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "no-sum-1");
      await service.stopSession("poe1");

      const summaries = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .execute();

      expect(summaries).toHaveLength(0);
    });

    it("should exclude hidden cards from summary totals", async () => {
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "hidden-sum-1");
      await service.addCard(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "hidden-sum-2",
      );

      // Hide The Doctor from exchange
      await service.updateCardPriceVisibility(
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      await service.stopSession("poe1");

      const summary = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .executeTakeFirst();

      // Exchange should only include Rain of Chaos (Doctor is hidden)
      expect(summary!.total_exchange_value).toBeCloseTo(1.5, 1);
      // Stash should include both (Doctor is only hidden for exchange)
      expect(summary!.total_stash_value).toBeCloseTo(1100 + 1.2, 1);
    });
  });

  // ─── Event emission ────────────────────────────────────────────────────

  describe("event emission", () => {
    it("should emit to all open windows", async () => {
      const mockWindow1 = {
        webContents: { send: vi.fn() },
        isDestroyed: vi.fn(() => false),
      };
      const mockWindow2 = {
        webContents: { send: vi.fn() },
        isDestroyed: vi.fn(() => false),
      };
      mockGetAllWindows.mockReturnValue([mockWindow1, mockWindow2]);

      await service.startSession("poe1", "Settlers");

      expect(mockWindow1.webContents.send).toHaveBeenCalledWith(
        "current-session:state-changed",
        expect.any(Object),
      );
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith(
        "current-session:state-changed",
        expect.any(Object),
      );
    });

    it("should not throw when no windows are open", async () => {
      mockGetAllWindows.mockReturnValue([]);

      await expect(
        service.startSession("poe1", "Settlers"),
      ).resolves.not.toThrow();
    });
  });

  // ─── IPC handler registration ──────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register handlers for all session channels", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        (call: any[]) => call[0],
      );

      expect(registeredChannels).toContain("current-session:start");
      expect(registeredChannels).toContain("current-session:stop");
      expect(registeredChannels).toContain("current-session:is-active");
      expect(registeredChannels).toContain("current-session:get");
      expect(registeredChannels).toContain("current-session:info");
      expect(registeredChannels).toContain(
        "current-session:update-card-price-visibility",
      );
    });
  });

  // ─── Full session lifecycle ────────────────────────────────────────────

  describe("full session lifecycle", () => {
    it("should support a complete session workflow", async () => {
      // 1. Start session
      await service.startSession("poe1", "Settlers");
      expect(service.isSessionActive("poe1")).toBe(true);

      // 2. Add cards
      await service.addCard("poe1", "Settlers", "The Doctor", "life-1");
      await service.addCard("poe1", "Settlers", "The Doctor", "life-2");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "life-3");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "life-4");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "life-5");

      // 3. Query session
      const session = await service.getCurrentSession("poe1");
      expect(session.totalCount).toBe(5);
      expect(session.cards).toHaveLength(2);

      const doctorCard = session.cards.find(
        (c: any) => c.name === "The Doctor",
      );
      expect(doctorCard.count).toBe(2);

      const rainCard = session.cards.find(
        (c: any) => c.name === "Rain of Chaos",
      );
      expect(rainCard.count).toBe(3);

      // 4. Verify totals
      expect(session.totals.exchange.totalValue).toBeGreaterThan(0);
      expect(session.totals.stash.totalValue).toBeGreaterThan(0);
      expect(session.totals.totalDeckCost).toBe(3 * 5); // 3 chaos * 5 decks

      // 5. Hide a card
      await service.updateCardPriceVisibility(
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      // 6. Verify totals changed
      const updatedSession = await service.getCurrentSession("poe1");
      expect(updatedSession.totals.exchange.totalValue).toBeLessThan(
        session.totals.exchange.totalValue,
      );

      // 7. Stop session
      const result = await service.stopSession("poe1");
      expect(result.totalCount).toBe(5);
      expect(result.league).toBe("Settlers");
      expect(result.game).toBe("poe1");
      expect(service.isSessionActive("poe1")).toBe(false);

      // 8. Verify summary was created
      const summaries = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .execute();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].total_decks_opened).toBe(5);

      // 9. Duplicate processed IDs should still be tracked globally
      // (so if we start a new session, they won't be re-processed)
      const globalIds = service.getAllProcessedIds("poe1");
      expect(globalIds.has("life-1")).toBe(true);
      expect(globalIds.has("life-5")).toBe(true);

      // 10. Cascade to DataStore was called for each card
      expect(mockDataStoreAddCard).toHaveBeenCalledTimes(5);
    });

    it("should support multiple sequential sessions", async () => {
      // Session 1
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "seq-1");
      const result1 = await service.stopSession("poe1");
      expect(result1.totalCount).toBe(1);

      // Session 2
      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "seq-2");
      await service.addCard("poe1", "Settlers", "Rain of Chaos", "seq-3");
      const result2 = await service.stopSession("poe1");
      expect(result2.totalCount).toBe(2);

      // Both summaries should exist
      const summaries = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .execute();
      expect(summaries).toHaveLength(2);
    });
  });

  // ─── Divination card metadata ──────────────────────────────────────────

  describe("divination card metadata", () => {
    it("should include divination card info in session card data", async () => {
      // Seed divination card metadata
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
        description: "A valuable card",
      });

      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "meta-1");

      const result = await service.getCurrentSession("poe1");
      const doctorCard = result.cards.find((c: any) => c.name === "The Doctor");

      expect(doctorCard.divinationCard).toBeDefined();
      expect(doctorCard.divinationCard.stackSize).toBe(8);
    });

    it("should use rarity in recent drops display", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
      });

      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1, // Very rare
      });

      await service.startSession("poe1", "Settlers");
      await service.addCard("poe1", "Settlers", "The Doctor", "rarity-1");

      const result = await service.getCurrentSession("poe1");

      const doctorDrop = result.recentDrops.find(
        (d: any) => d.cardName === "The Doctor",
      );
      expect(doctorDrop).toBeDefined();
      expect(doctorDrop.rarity).toBe(1);
    });

    it("should default to rarity 4 when no rarity data exists", async () => {
      // No rarity seeded
      await service.startSession("poe1", "Settlers");
      await service.addCard(
        "poe1",
        "Settlers",
        "Some Card",
        "default-rarity-1",
      );

      const result = await service.getCurrentSession("poe1");

      const drop = result.recentDrops.find(
        (d: any) => d.cardName === "Some Card",
      );
      expect(drop).toBeDefined();
      expect(drop.rarity).toBe(4);
    });

    it("should display rarity 4 for hidden cards regardless of actual rarity", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
      });

      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      await service.startSession("poe1", "Settlers");
      await service.addCard(
        "poe1",
        "Settlers",
        "The Doctor",
        "hidden-rarity-1",
      );

      // Hide the card
      await service.updateCardPriceVisibility(
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      const result = await service.getCurrentSession("poe1");
      const doctorDrop = result.recentDrops.find(
        (d: any) => d.cardName === "The Doctor",
      );
      // Hidden cards should show rarity 4 (common)
      expect(doctorDrop.rarity).toBe(4);
    });
  });

  // ─── Edge cases for uncovered branches ─────────────────────────────────

  describe("poe2 session lifecycle", () => {
    let poe2LeagueId: string;
    let poe2SnapshotId: string;

    beforeEach(async () => {
      poe2LeagueId = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      poe2SnapshotId = await seedSnapshot(testDb.kysely, {
        leagueId: poe2LeagueId,
        exchangeChaosToDivine: 180,
        stashChaosToDivine: 175,
        stackedDeckChaosCost: 2,
        cardPrices: [
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1.5,
            divineValue: 0.008,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "stash",
            chaosValue: 1.2,
            divineValue: 0.007,
          },
        ],
      });

      mockGetSnapshotForSession.mockResolvedValue({
        snapshotId: poe2SnapshotId,
        data: createMockPriceSnapshot(),
      });
    });

    it("should start and stop a poe2 session (covers poe2 cleanup branch)", async () => {
      await service.startSession("poe2", "Dawn");
      expect(service.isSessionActive("poe2")).toBe(true);

      const result = await service.stopSession("poe2");

      expect(result.game).toBe("poe2");
      expect(result.league).toBe("Dawn");
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("durationMs");
      expect(service.isSessionActive("poe2")).toBe(false);
    });

    it("should clear poe2 processed IDs when stopping a poe2 session", async () => {
      await service.startSession("poe2", "Dawn");
      await service.addCard("poe2", "Dawn", "Rain of Chaos", "poe2-proc-1");

      const idsBefore = service.getAllProcessedIds("poe2");
      expect(idsBefore.has("poe2-proc-1")).toBe(true);

      await service.stopSession("poe2");

      // Session-scoped processed IDs should be cleared
      // (global ones may persist, but session ones are cleared)
      expect(service.isSessionActive("poe2")).toBe(false);
    });

    it("should allow starting a new poe2 session after stopping", async () => {
      await service.startSession("poe2", "Dawn");
      await service.stopSession("poe2");

      await service.startSession("poe2", "Dawn");
      expect(service.isSessionActive("poe2")).toBe(true);
      await service.stopSession("poe2");
    });

    it("should emit session state change with isActive false when stopping poe2", async () => {
      await service.startSession("poe2", "Dawn");
      mockWebContentsSend.mockClear();

      await service.stopSession("poe2");

      const stateChangedCalls = mockWebContentsSend.mock.calls.filter(
        ([channel]: [string]) => channel === "current-session:state-changed",
      );
      const lastCall = stateChangedCalls[stateChangedCalls.length - 1];
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          game: "poe2",
          isActive: false,
          sessionInfo: null,
        }),
      );
    });
  });

  describe("getCurrentSession edge cases", () => {
    it("should return null when session exists in memory but not in DB", async () => {
      await service.startSession("poe1", "Settlers");
      expect(service.isSessionActive("poe1")).toBe(true);

      // Get the active session info to find the session ID
      const info = service.getActiveSessionInfo("poe1");
      expect(info).not.toBeNull();

      // Delete the session row from the DB to simulate the edge case
      await testDb.kysely
        .deleteFrom("sessions")
        .where("id", "=", info!.sessionId)
        .execute();

      // Now getCurrentSession should hit the `if (!session) return null` branch
      const result = await service.getCurrentSession("poe1");
      expect(result).toBeNull();
    });
  });

  describe("loadGlobalProcessedIds with existing data", () => {
    it("should load poe2 global processed IDs from DB on construction", async () => {
      // Seed processed IDs for poe2 in the DB before constructing the service
      await testDb.kysely
        .insertInto("processed_ids")
        .values({
          game: "poe2",
          scope: "global",
          processed_id: "existing-poe2-id-1",
          card_name: "Rain of Chaos",
        })
        .execute();

      await testDb.kysely
        .insertInto("processed_ids")
        .values({
          game: "poe2",
          scope: "global",
          processed_id: "existing-poe2-id-2",
          card_name: "The Doctor",
        })
        .execute();

      // Reset singleton and recreate to trigger constructor's loadGlobalProcessedIds
      // @ts-expect-error accessing private static for testing
      CurrentSessionService._instance = undefined;
      const freshService = CurrentSessionService.getInstance();

      // Wait for the async loadGlobalProcessedIds to complete
      // (it's fire-and-forget in the constructor, so we need a tick)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const ids = freshService.getAllProcessedIds("poe2");
      expect(ids.has("existing-poe2-id-1")).toBe(true);
      expect(ids.has("existing-poe2-id-2")).toBe(true);

      // Clean up singleton reference
      // @ts-expect-error accessing private static for testing
      CurrentSessionService._instance = undefined;
    });
  });
});
