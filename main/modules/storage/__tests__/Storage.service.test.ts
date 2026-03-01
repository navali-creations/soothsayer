import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetDb,
  mockGetPath,
  mockAppGetPath,
  mockStatfsSync,
  mockStatSync,
  mockReaddirSync,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetPath: vi.fn(() => "/mock-user-data/soothsayer.db"),
  mockAppGetPath: vi.fn(() => "/mock-user-data"),
  mockStatfsSync: vi.fn((_path?: any) => ({
    bsize: 4096,
    blocks: 250000000, // ~1 TB total
    bavail: 125000000, // ~500 GB free
  })),
  mockStatSync: vi.fn((_path?: any) => ({
    size: 1024 * 1024,
    isFile: () => true as const,
  })),
  mockReaddirSync: vi.fn((_path?: any, _opts?: any) => [] as any[]),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: mockAppGetPath,
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock DatabaseService ────────────────────────────────────────────────────
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getDb: mockGetDb,
      getPath: mockGetPath,
      getKysely: vi.fn(),
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      statfsSync: mockStatfsSync,
      statSync: mockStatSync,
      readdirSync: mockReaddirSync,
    },
    statfsSync: mockStatfsSync,
    statSync: mockStatSync,
    readdirSync: mockReaddirSync,
  };
});

// ─── Import test utilities and module under test ─────────────────────────────
import {
  createTestDatabase,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSessionSummary,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { StorageChannel } from "../Storage.channels";
import { StorageService } from "../Storage.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => any {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    const registered = mockIpcHandle.mock.calls
      .map(([ch]: [string]) => ch)
      .join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered: ${registered}`,
    );
  }
  return call[1];
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("StorageService", () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetDb.mockReturnValue(testDb.db);
    mockGetPath.mockReturnValue("/mock-user-data/soothsayer.db");
    mockAppGetPath.mockReturnValue("/mock-user-data");

    // Default FS mocks
    mockStatfsSync.mockReturnValue({
      bsize: 4096,
      blocks: 250000000,
      bavail: 125000000,
    });
    mockStatSync.mockReturnValue({ size: 1024 * 1024, isFile: () => true });
    mockReaddirSync.mockReturnValue([]);

    // Reset the singleton
    // @ts-expect-error accessing private static for testing
    StorageService._instance = undefined;

    StorageService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    StorageService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Singleton
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      // @ts-expect-error accessing private static for testing
      StorageService._instance = undefined;
      const a = StorageService.getInstance();
      const b = StorageService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler Registration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("IPC handlers", () => {
    it("should register all expected IPC handlers", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(StorageChannel.GetInfo);
      expect(registeredChannels).toContain(StorageChannel.GetLeagueUsage);
      expect(registeredChannels).toContain(StorageChannel.DeleteLeagueData);
      expect(registeredChannels).toContain(StorageChannel.CheckDiskSpace);
    });

    it("should register exactly 4 handlers", () => {
      // The singleton is created once in beforeEach, so we count its registrations
      const storageHandlers = mockIpcHandle.mock.calls.filter(
        ([ch]: [string]) => ch.startsWith("storage:"),
      );
      expect(storageHandlers).toHaveLength(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getLeagueStorageUsage (via IPC)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getLeagueStorageUsage", () => {
    it("should return empty array when no leagues exist", async () => {
      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toEqual([]);
    });

    it("should return league with zero counts when league has no data", async () => {
      await seedLeague(testDb.kysely, { name: "Empty League", game: "poe1" });

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        leagueName: "Empty League",
        game: "poe1",
        sessionCount: 0,
        snapshotCount: 0,
        estimatedSizeBytes: 0,
        hasActiveSession: false,
      });
    });

    it("should calculate estimated size based on row counts", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Settlers",
        game: "poe1",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 1200,
            divineValue: 6,
          },
        ],
      });
      const sessionId = await seedSession(testDb.kysely, {
        leagueId,
        snapshotId,
        totalCount: 10,
        isActive: false,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);
      await seedSessionSummary(testDb.kysely, {
        sessionId,
        game: "poe1",
        league: "Settlers",
      });

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(1);
      expect(result[0].sessionCount).toBe(1);
      expect(result[0].snapshotCount).toBe(1);
      expect(result[0].estimatedSizeBytes).toBeGreaterThan(0);
      expect(result[0].hasActiveSession).toBe(false);
    });

    it("should detect active sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Active League",
        game: "poe1",
      });
      await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 5,
        isActive: true,
      });

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(1);
      expect(result[0].hasActiveSession).toBe(true);
    });

    it("should return multiple leagues sorted by session count descending", async () => {
      const league1 = await seedLeague(testDb.kysely, {
        name: "League A",
        game: "poe1",
      });
      const league2 = await seedLeague(testDb.kysely, {
        name: "League B",
        game: "poe2",
      });

      // League A: 1 session
      await seedSession(testDb.kysely, {
        leagueId: league1,
        totalCount: 5,
        isActive: false,
      });

      // League B: 3 sessions
      await seedSession(testDb.kysely, {
        leagueId: league2,
        totalCount: 10,
        isActive: false,
      });
      await seedSession(testDb.kysely, {
        leagueId: league2,
        totalCount: 20,
        isActive: false,
      });
      await seedSession(testDb.kysely, {
        leagueId: league2,
        totalCount: 15,
        isActive: false,
      });

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(2);
      // League B should come first (3 sessions vs 1)
      expect(result[0].leagueName).toBe("League B");
      expect(result[0].sessionCount).toBe(3);
      expect(result[1].leagueName).toBe("League A");
      expect(result[1].sessionCount).toBe(1);
    });

    it("should include rarity data in size estimate", async () => {
      await seedLeague(testDb.kysely, {
        name: "Rarity League",
        game: "poe1",
      });
      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Rarity League",
        cardName: "The Doctor",
        rarity: 4,
      });
      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Rarity League",
        cardName: "Rain of Chaos",
        rarity: 1,
      });

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(1);
      // Should include AVG_RARITY_ROW_BYTES * 2 = 160 bytes for rarity rows
      expect(result[0].estimatedSizeBytes).toBe(160);
    });

    it("should handle poe2 leagues correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Dawn of the Hunt",
        game: "poe2",
      });
      await seedSession(testDb.kysely, {
        leagueId,
        game: "poe2",
        totalCount: 5,
        isActive: false,
      });

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(1);
      expect(result[0].game).toBe("poe2");
      expect(result[0].leagueName).toBe("Dawn of the Hunt");
    });

    it("should include prohibited library data in size estimate", async () => {
      await seedLeague(testDb.kysely, {
        name: "PL League",
        game: "poe1",
      });

      // Insert prohibited_library_card_weights directly
      testDb.db
        .prepare(
          `INSERT INTO prohibited_library_card_weights
           (card_name, game, league, weight, rarity, from_boss, loaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("The Doctor", "poe1", "PL League", 100, 4, 0, "2025-01-01");

      // Insert prohibited_library_cache_metadata directly
      testDb.db
        .prepare(
          `INSERT INTO prohibited_library_cache_metadata
           (game, league, loaded_at, app_version, card_count)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("poe1", "PL League", "2025-01-01", "0.7.0", 1);

      const handler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const result = await handler({});

      expect(result).toHaveLength(1);
      // Should include AVG_PL_WEIGHT_ROW_BYTES (120) + AVG_PL_CACHE_META_ROW_BYTES (100)
      expect(result[0].estimatedSizeBytes).toBe(220);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteLeagueData (via IPC)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("deleteLeagueData", () => {
    it("should return error for empty league ID", async () => {
      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, "");

      expect(result).toMatchObject({
        success: false,
        freedBytes: 0,
        error: "Invalid league ID",
      });
    });

    it("should return error for null league ID", async () => {
      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, null);

      expect(result).toMatchObject({
        success: false,
        freedBytes: 0,
        error: "Invalid league ID",
      });
    });

    it("should return error for non-string league ID", async () => {
      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, 12345);

      expect(result).toMatchObject({
        success: false,
        freedBytes: 0,
        error: "Invalid league ID",
      });
    });

    it("should return error when league has an active session", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Active League",
        game: "poe1",
      });
      await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 5,
        isActive: true,
      });

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result).toMatchObject({
        success: false,
        freedBytes: 0,
      });
      expect(result.error).toContain("active session");
    });

    it("should return error when league does not exist", async () => {
      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, "non-existent-league-id");

      expect(result).toMatchObject({
        success: false,
        freedBytes: 0,
        error: "League not found",
      });
    });

    it("should successfully delete a league with no associated data", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Empty League",
        game: "poe1",
      });

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result.success).toBe(true);
      expect(result.freedBytes).toBeGreaterThanOrEqual(0);

      // League should be gone
      const league = testDb.db
        .prepare("SELECT id FROM leagues WHERE id = ?")
        .get(leagueId);
      expect(league).toBeUndefined();
    });

    it("should cascade delete all related data for a league", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Full League",
        game: "poe1",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 1200,
            divineValue: 6,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "stash",
            chaosValue: 2,
            divineValue: 0.01,
          },
        ],
      });
      const sessionId = await seedSession(testDb.kysely, {
        leagueId,
        snapshotId,
        totalCount: 10,
        isActive: false,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 9 },
      ]);
      await seedSessionSummary(testDb.kysely, {
        sessionId,
        game: "poe1",
        league: "Full League",
      });
      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Full League",
        cardName: "The Doctor",
        rarity: 4,
      });

      // Insert prohibited library data
      testDb.db
        .prepare(
          `INSERT INTO prohibited_library_card_weights
           (card_name, game, league, weight, rarity, from_boss, loaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("The Doctor", "poe1", "Full League", 100, 4, 0, "2025-01-01");

      testDb.db
        .prepare(
          `INSERT INTO prohibited_library_cache_metadata
           (game, league, loaded_at, app_version, card_count)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("poe1", "Full League", "2025-01-01", "0.7.0", 1);

      // Insert poe_leagues_cache
      testDb.db
        .prepare(
          `INSERT INTO poe_leagues_cache
           (id, game, league_id, name, is_active, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("cache-1", "poe1", leagueId, "Full League", 1, "2025-01-01");

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result.success).toBe(true);

      // Verify all related data is deleted
      const remainingLeagues = testDb.db
        .prepare("SELECT * FROM leagues WHERE id = ?")
        .all(leagueId);
      expect(remainingLeagues).toHaveLength(0);

      const remainingSessions = testDb.db
        .prepare("SELECT * FROM sessions WHERE league_id = ?")
        .all(leagueId);
      expect(remainingSessions).toHaveLength(0);

      const remainingSnapshots = testDb.db
        .prepare("SELECT * FROM snapshots WHERE league_id = ?")
        .all(leagueId);
      expect(remainingSnapshots).toHaveLength(0);

      const remainingSessionCards = testDb.db
        .prepare("SELECT * FROM session_cards WHERE session_id = ?")
        .all(sessionId);
      expect(remainingSessionCards).toHaveLength(0);

      const remainingSnapshotPrices = testDb.db
        .prepare("SELECT * FROM snapshot_card_prices WHERE snapshot_id = ?")
        .all(snapshotId);
      expect(remainingSnapshotPrices).toHaveLength(0);

      const remainingSummaries = testDb.db
        .prepare("SELECT * FROM session_summaries WHERE session_id = ?")
        .all(sessionId);
      expect(remainingSummaries).toHaveLength(0);

      const remainingRarities = testDb.db
        .prepare(
          "SELECT * FROM divination_card_rarities WHERE game = ? AND league = ?",
        )
        .all("poe1", "Full League");
      expect(remainingRarities).toHaveLength(0);

      const remainingPlWeights = testDb.db
        .prepare(
          "SELECT * FROM prohibited_library_card_weights WHERE game = ? AND league = ?",
        )
        .all("poe1", "Full League");
      expect(remainingPlWeights).toHaveLength(0);

      const remainingPlMeta = testDb.db
        .prepare(
          "SELECT * FROM prohibited_library_cache_metadata WHERE game = ? AND league = ?",
        )
        .all("poe1", "Full League");
      expect(remainingPlMeta).toHaveLength(0);

      const remainingLeagueCache = testDb.db
        .prepare(
          "SELECT * FROM poe_leagues_cache WHERE game = ? AND league_id = ?",
        )
        .all("poe1", leagueId);
      expect(remainingLeagueCache).toHaveLength(0);
    });

    it("should not delete data from other leagues during cascade delete", async () => {
      const leagueToDelete = await seedLeague(testDb.kysely, {
        name: "Delete Me",
        game: "poe1",
      });
      const leagueToKeep = await seedLeague(testDb.kysely, {
        name: "Keep Me",
        game: "poe1",
      });

      const sessionToDelete = await seedSession(testDb.kysely, {
        leagueId: leagueToDelete,
        totalCount: 5,
        isActive: false,
      });
      const sessionToKeep = await seedSession(testDb.kysely, {
        leagueId: leagueToKeep,
        totalCount: 10,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, sessionToDelete, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, sessionToKeep, [
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      await seedSnapshot(testDb.kysely, { leagueId: leagueToDelete });
      await seedSnapshot(testDb.kysely, { leagueId: leagueToKeep });

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      await handler({}, leagueToDelete);

      // Deleted league's data should be gone
      const deletedSessions = testDb.db
        .prepare("SELECT * FROM sessions WHERE league_id = ?")
        .all(leagueToDelete);
      expect(deletedSessions).toHaveLength(0);

      // Kept league's data should still exist
      const keptSessions = testDb.db
        .prepare("SELECT * FROM sessions WHERE league_id = ?")
        .all(leagueToKeep);
      expect(keptSessions).toHaveLength(1);

      const keptCards = testDb.db
        .prepare("SELECT * FROM session_cards WHERE session_id = ?")
        .all(sessionToKeep);
      expect(keptCards).toHaveLength(1);

      const keptSnapshots = testDb.db
        .prepare("SELECT * FROM snapshots WHERE league_id = ?")
        .all(leagueToKeep);
      expect(keptSnapshots).toHaveLength(1);
    });

    it("should handle deletion of league with multiple sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Multi Session",
        game: "poe1",
      });

      const session1 = await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 10,
        isActive: false,
      });
      const session2 = await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 20,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "The Doctor", count: 2 },
      ]);
      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "Rain of Chaos", count: 15 },
      ]);

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result.success).toBe(true);

      // All sessions and their cards should be deleted
      const sessions = testDb.db
        .prepare("SELECT * FROM sessions WHERE league_id = ?")
        .all(leagueId);
      expect(sessions).toHaveLength(0);

      const cards1 = testDb.db
        .prepare("SELECT * FROM session_cards WHERE session_id = ?")
        .all(session1);
      expect(cards1).toHaveLength(0);

      const cards2 = testDb.db
        .prepare("SELECT * FROM session_cards WHERE session_id = ?")
        .all(session2);
      expect(cards2).toHaveLength(0);
    });

    it("should allow deletion when session is inactive (is_active = 0)", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Inactive League",
        game: "poe1",
      });
      await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 5,
        isActive: false,
      });

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result.success).toBe(true);
    });

    it("should return error when an unexpected database error occurs", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Error League",
        game: "poe1",
      });
      await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 5,
        isActive: false,
      });

      // Sabotage the DB so the transaction throws: drop a table that the
      // cascade DELETE references, causing an SQL error mid-transaction.
      testDb.db.exec("DROP TABLE snapshot_card_prices");

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result.success).toBe(false);
      expect(result.freedBytes).toBe(0);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");

      // Recreate the table so afterEach cleanup doesn't blow up
      testDb.db.exec(`
        CREATE TABLE snapshot_card_prices (
          snapshot_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          price_source TEXT NOT NULL CHECK (price_source IN ('exchange', 'stash')),
          chaos_value REAL NOT NULL,
          divine_value REAL NOT NULL,
          confidence INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (snapshot_id, card_name, price_source)
        )
      `);
    });

    it("should delete poe2 league data correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Dawn of the Hunt",
        game: "poe2",
      });
      const sessionId = await seedSession(testDb.kysely, {
        leagueId,
        game: "poe2",
        totalCount: 5,
        isActive: false,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Some Card", count: 3 },
      ]);
      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe2",
        league: "Dawn of the Hunt",
        cardName: "Some Card",
        rarity: 2,
      });

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);

      expect(result.success).toBe(true);

      const rarities = testDb.db
        .prepare(
          "SELECT * FROM divination_card_rarities WHERE game = ? AND league = ?",
        )
        .all("poe2", "Dawn of the Hunt");
      expect(rarities).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkDiskSpace (via IPC)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("checkDiskSpace", () => {
    it("should return isLow = false when disk has plenty of space", async () => {
      // 500 GB free
      mockStatfsSync.mockReturnValue({
        bsize: 4096,
        blocks: 250000000,
        bavail: 125000000,
      });

      const handler = getIpcHandler(StorageChannel.CheckDiskSpace);
      const result = await handler({});

      expect(result.isLow).toBe(false);
      expect(result.diskFreeBytes).toBe(4096 * 125000000);
    });

    it("should return isLow = true when disk space is below 1 GB", async () => {
      // ~500 MB free (below 1 GB threshold)
      mockStatfsSync.mockReturnValue({
        bsize: 4096,
        blocks: 250000000,
        bavail: 122070, // ~500 MB
      });

      const handler = getIpcHandler(StorageChannel.CheckDiskSpace);
      const result = await handler({});

      expect(result.isLow).toBe(true);
      expect(result.diskFreeBytes).toBe(4096 * 122070);
    });

    it("should return isLow = true when disk space is exactly 0", async () => {
      mockStatfsSync.mockReturnValue({
        bsize: 4096,
        blocks: 250000000,
        bavail: 0,
      });

      const handler = getIpcHandler(StorageChannel.CheckDiskSpace);
      const result = await handler({});

      expect(result.isLow).toBe(true);
      expect(result.diskFreeBytes).toBe(0);
    });

    it("should return isLow = false when disk space is exactly 1 GB", async () => {
      // Exactly 1 GB = 1024*1024*1024 = 1073741824 bytes
      // bsize * bavail = 1073741824
      // bsize = 4096, bavail = 262144
      mockStatfsSync.mockReturnValue({
        bsize: 4096,
        blocks: 250000000,
        bavail: 262144, // 4096 * 262144 = 1073741824 = exactly 1 GB
      });

      const handler = getIpcHandler(StorageChannel.CheckDiskSpace);
      const result = await handler({});

      // 1 GB is not "less than 1 GB", so it should not be low
      expect(result.isLow).toBe(false);
    });

    it("should return isLow = true when disk space is just under 1 GB", async () => {
      mockStatfsSync.mockReturnValue({
        bsize: 4096,
        blocks: 250000000,
        bavail: 262143, // just under 1 GB
      });

      const handler = getIpcHandler(StorageChannel.CheckDiskSpace);
      const result = await handler({});

      expect(result.isLow).toBe(true);
    });

    it("should handle statfsSync throwing an error gracefully", async () => {
      mockStatfsSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const handler = getIpcHandler(StorageChannel.CheckDiskSpace);
      const result = await handler({});

      // getDiskStats returns { total: 0, free: 0 } on error, so free < 1GB → isLow
      expect(result.isLow).toBe(true);
      expect(result.diskFreeBytes).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getStorageInfo (via IPC)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getStorageInfo", () => {
    it("should return storage info with correct paths", async () => {
      mockAppGetPath.mockReturnValue("/app-data");
      mockGetPath.mockReturnValue("/app-data/soothsayer.db");

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.appDataPath).toBe("/app-data");
      expect(result.dbPath).toBe("/app-data/soothsayer.db");
    });

    it("should include disk space metrics", async () => {
      mockStatfsSync.mockReturnValue({
        bsize: 4096,
        blocks: 1000000,
        bavail: 500000,
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.diskTotalBytes).toBe(4096 * 1000000);
      expect(result.diskFreeBytes).toBe(4096 * 500000);
    });

    it("should include database size", async () => {
      mockStatSync.mockReturnValue({
        size: 82 * 1024 * 1024, // 82 MB
        isFile: () => true,
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.dbSizeBytes).toBe(82 * 1024 * 1024);
    });

    it("should include breakdown array", async () => {
      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
    });

    it("should handle file stat failure gracefully for db size", async () => {
      mockStatSync.mockImplementation((filePath: string) => {
        if (typeof filePath === "string" && filePath.endsWith(".db")) {
          throw new Error("File not found");
        }
        return { size: 0, isFile: () => true };
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.dbSizeBytes).toBe(0);
    });

    it("should handle disk stats on different drives for app data and db", async () => {
      mockGetPath.mockReturnValue("D:/databases/soothsayer.db");
      mockAppGetPath.mockReturnValue("C:/Users/test/AppData/Soothsayer");

      let callCount = 0;
      mockStatfsSync.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          // App data drive
          return { bsize: 4096, blocks: 500000, bavail: 250000 };
        }
        // DB drive
        return { bsize: 4096, blocks: 1000000, bavail: 800000 };
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      // Results should include both drive stats
      expect(result.diskTotalBytes).toBeDefined();
      expect(result.dbDiskTotalBytes).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getDirectoryBreakdown / categorizeFile / walkAndCategorize
  // ═══════════════════════════════════════════════════════════════════════════

  describe("directory breakdown and file categorization", () => {
    it("should categorize .db files as database", async () => {
      mockReaddirSync.mockReturnValue([
        { name: "soothsayer.db", isDirectory: () => false, isFile: () => true },
      ]);
      mockStatSync.mockReturnValue({
        size: 50 * 1024 * 1024,
        isFile: () => true,
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      expect(dbCategory).toBeDefined();
      expect(dbCategory!.sizeBytes).toBeGreaterThan(0);
    });

    it("should categorize .sqlite files as database", async () => {
      mockReaddirSync.mockReturnValue([
        { name: "data.sqlite", isDirectory: () => false, isFile: () => true },
      ]);
      mockStatSync.mockReturnValue({ size: 1024, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      expect(dbCategory).toBeDefined();
    });

    it("should categorize WAL and SHM files as database", async () => {
      mockReaddirSync.mockReturnValue([
        {
          name: "soothsayer.db-wal",
          isDirectory: () => false,
          isFile: () => true,
        },
        {
          name: "soothsayer.db-shm",
          isDirectory: () => false,
          isFile: () => true,
        },
      ]);
      mockStatSync.mockReturnValue({ size: 512, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      expect(dbCategory).toBeDefined();
      // Two files, each 512 bytes
      expect(dbCategory!.sizeBytes).toBe(1024);
      expect(dbCategory!.fileCount).toBe(2);
    });

    it("should categorize session storage files as database", async () => {
      // Simulate a directory structure with session storage
      const topLevelEntries = [
        {
          name: "Session Storage",
          isDirectory: () => true,
          isFile: () => false,
        },
      ];
      const sessionEntries = [
        { name: "000003.log", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (
          typeof dirPath === "string" &&
          dirPath.includes("Session Storage")
        ) {
          return sessionEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 256, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      expect(dbCategory).toBeDefined();
    });

    it("should categorize files in cache directories as cache", async () => {
      const topLevelEntries = [
        { name: "Cache", isDirectory: () => true, isFile: () => false },
      ];
      const cacheEntries = [
        {
          name: "data_0",
          isDirectory: () => false,
          isFile: () => true,
        },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("Cache")) {
          return cacheEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 4096, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      expect(cacheCategory).toBeDefined();
      expect(cacheCategory!.sizeBytes).toBeGreaterThan(0);
    });

    it("should categorize files in GPUCache as cache", async () => {
      const topLevelEntries = [
        { name: "GPUCache", isDirectory: () => true, isFile: () => false },
      ];
      const gpuEntries = [
        { name: "data_0", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("GPUCache")) {
          return gpuEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 2048, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      expect(cacheCategory).toBeDefined();
    });

    it("should categorize files in blob_storage as cache", async () => {
      const topLevelEntries = [
        { name: "blob_storage", isDirectory: () => true, isFile: () => false },
      ];
      const blobEntries = [
        { name: "blob1.bin", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("blob_storage")) {
          return blobEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 1024, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      expect(cacheCategory).toBeDefined();
    });

    it("should categorize files in Service Worker directory as cache", async () => {
      const topLevelEntries = [
        {
          name: "Service Worker",
          isDirectory: () => true,
          isFile: () => false,
        },
      ];
      const swEntries = [
        { name: "sw.js", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("Service Worker")) {
          return swEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 512, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      expect(cacheCategory).toBeDefined();
    });

    it("should categorize unknown files as other", async () => {
      mockReaddirSync.mockReturnValue([
        {
          name: "settings.json",
          isDirectory: () => false,
          isFile: () => true,
        },
      ]);
      mockStatSync.mockReturnValue({ size: 128, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const otherCategory = result.breakdown.find(
        (b: any) => b.category === "other",
      );
      expect(otherCategory).toBeDefined();
      expect(otherCategory!.label).toBe("Logs, config & other files");
    });

    it("should handle directory read errors gracefully", async () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      // Should return empty breakdown, not throw
      expect(result.breakdown).toEqual([]);
    });

    it("should handle inaccessible files within a directory gracefully", async () => {
      mockReaddirSync.mockReturnValue([
        { name: "readable.txt", isDirectory: () => false, isFile: () => true },
        {
          name: "unreadable.txt",
          isDirectory: () => false,
          isFile: () => true,
        },
      ]);

      mockStatSync.mockImplementation((filePath: string) => {
        // First call for getFileSize(dbPath), second for readable, third should fail
        if (typeof filePath === "string" && filePath.includes("unreadable")) {
          throw new Error("Permission denied");
        }
        return { size: 256, isFile: () => true };
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      // Should still include the readable file
      expect(result).toBeDefined();
    });

    it("should sort breakdown by size descending", async () => {
      // Simulate multiple file types with different sizes
      const topLevel = [
        { name: "soothsayer.db", isDirectory: () => false, isFile: () => true },
        { name: "Cache", isDirectory: () => true, isFile: () => false },
        { name: "config.json", isDirectory: () => false, isFile: () => true },
      ];
      const cacheFiles = [
        { name: "big_cache", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("Cache")) {
          return cacheFiles;
        }
        return topLevel;
      });

      mockStatSync.mockImplementation((filePath: string) => {
        if (typeof filePath === "string") {
          if (filePath.includes("soothsayer.db")) {
            return { size: 50 * 1024, isFile: () => true };
          }
          if (filePath.includes("big_cache")) {
            return { size: 100 * 1024, isFile: () => true };
          }
          if (filePath.includes("config")) {
            return { size: 1024, isFile: () => true };
          }
        }
        return { size: 0, isFile: () => true };
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      // breakdown should be sorted by size descending
      if (result.breakdown.length >= 2) {
        for (let i = 0; i < result.breakdown.length - 1; i++) {
          expect(result.breakdown[i].sizeBytes).toBeGreaterThanOrEqual(
            result.breakdown[i + 1].sizeBytes,
          );
        }
      }
    });

    it("should filter out categories with zero size and zero file count", async () => {
      // Only database files exist
      mockReaddirSync.mockReturnValue([
        { name: "soothsayer.db", isDirectory: () => false, isFile: () => true },
      ]);
      mockStatSync.mockReturnValue({ size: 1024, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      // Should only include the "database" category
      const categories = result.breakdown.map((b: any) => b.category);
      expect(categories).toContain("database");
      expect(categories).not.toContain("cache");
      expect(categories).not.toContain("other");
    });

    it("should categorize cookie files as database", async () => {
      mockReaddirSync.mockReturnValue([
        { name: "Cookies", isDirectory: () => false, isFile: () => true },
      ]);
      mockStatSync.mockReturnValue({ size: 512, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      expect(dbCategory).toBeDefined();
    });

    it("should categorize .enc files as database", async () => {
      mockReaddirSync.mockReturnValue([
        { name: "auth-data.enc", isDirectory: () => false, isFile: () => true },
      ]);
      mockStatSync.mockReturnValue({ size: 128, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      expect(dbCategory).toBeDefined();
    });

    it("should categorize files in IndexedDB directory as cache", async () => {
      const topLevelEntries = [
        { name: "IndexedDB", isDirectory: () => true, isFile: () => false },
      ];
      const indexedDbEntries = [
        { name: "leveldb", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("IndexedDB")) {
          return indexedDbEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 2048, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      expect(cacheCategory).toBeDefined();
    });

    it("should categorize files in Code Cache directory as cache", async () => {
      const topLevelEntries = [
        { name: "Code Cache", isDirectory: () => true, isFile: () => false },
      ];
      const codeCacheEntries = [
        { name: "js", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("Code Cache")) {
          return codeCacheEntries;
        }
        return topLevelEntries;
      });
      mockStatSync.mockReturnValue({ size: 3072, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      expect(cacheCategory).toBeDefined();
    });

    it("should have correct labels for each category", async () => {
      const topLevel = [
        { name: "soothsayer.db", isDirectory: () => false, isFile: () => true },
        { name: "Cache", isDirectory: () => true, isFile: () => false },
        { name: "config.json", isDirectory: () => false, isFile: () => true },
      ];
      const cacheFiles = [
        { name: "data_0", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("Cache")) {
          return cacheFiles;
        }
        return topLevel;
      });
      mockStatSync.mockReturnValue({ size: 1024, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      const dbCategory = result.breakdown.find(
        (b: any) => b.category === "database",
      );
      const cacheCategory = result.breakdown.find(
        (b: any) => b.category === "cache",
      );
      const otherCategory = result.breakdown.find(
        (b: any) => b.category === "other",
      );

      if (dbCategory) {
        expect(dbCategory.label).toBe("Database & session data");
      }
      if (cacheCategory) {
        expect(cacheCategory.label).toBe("Temporary files");
      }
      if (otherCategory) {
        expect(otherCategory.label).toBe("Logs, config & other files");
      }
    });

    it("should recursively walk subdirectories", async () => {
      const topLevel = [
        { name: "subdir", isDirectory: () => true, isFile: () => false },
      ];
      const subDirFiles = [
        { name: "nested", isDirectory: () => true, isFile: () => false },
      ];
      const nestedFiles = [
        { name: "deep.log", isDirectory: () => false, isFile: () => true },
      ];

      mockReaddirSync.mockImplementation((dirPath: string, _opts?: any) => {
        if (typeof dirPath === "string" && dirPath.includes("nested")) {
          return nestedFiles;
        }
        if (typeof dirPath === "string" && dirPath.includes("subdir")) {
          return subDirFiles;
        }
        return topLevel;
      });
      mockStatSync.mockReturnValue({ size: 64, isFile: () => true });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      // The deeply nested file should be categorized
      const otherCategory = result.breakdown.find(
        (b: any) => b.category === "other",
      );
      expect(otherCategory).toBeDefined();
      expect(otherCategory!.fileCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // File system helper edge cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe("file system helpers", () => {
    it("getFileSize should return 0 when statSync throws", async () => {
      mockStatSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue([]);

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.dbSizeBytes).toBe(0);
    });

    it("getDiskStats should return zero total and free on error", async () => {
      mockStatfsSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const handler = getIpcHandler(StorageChannel.GetInfo);
      const result = await handler({});

      expect(result.diskTotalBytes).toBe(0);
      expect(result.diskFreeBytes).toBe(0);
      expect(result.dbDiskTotalBytes).toBe(0);
      expect(result.dbDiskFreeBytes).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration: full flow scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe("integration scenarios", () => {
    it("should show league as having active session then allow delete after deactivation", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Test League",
        game: "poe1",
      });
      const sessionId = await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 10,
        isActive: true,
      });

      const deleteHandler = getIpcHandler(StorageChannel.DeleteLeagueData);

      // Attempt to delete while session is active should fail
      const failResult = await deleteHandler({}, leagueId);
      expect(failResult.success).toBe(false);
      expect(failResult.error).toContain("active session");

      // Deactivate the session
      testDb.db
        .prepare("UPDATE sessions SET is_active = 0 WHERE id = ?")
        .run(sessionId);

      // Now deletion should succeed
      const successResult = await deleteHandler({}, leagueId);
      expect(successResult.success).toBe(true);
    });

    it("should reflect league removal in subsequent getLeagueUsage calls", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Temp League",
        game: "poe1",
      });
      await seedSession(testDb.kysely, {
        leagueId,
        totalCount: 5,
        isActive: false,
      });

      const usageHandler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const deleteHandler = getIpcHandler(StorageChannel.DeleteLeagueData);

      // Should appear in usage
      const beforeUsage = await usageHandler({});
      expect(beforeUsage).toHaveLength(1);

      // Delete it
      await deleteHandler({}, leagueId);

      // Should no longer appear
      const afterUsage = await usageHandler({});
      expect(afterUsage).toHaveLength(0);
    });

    it("should handle mixed poe1 and poe2 leagues independently", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        name: "Settlers",
        game: "poe1",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        name: "Dawn of the Hunt",
        game: "poe2",
      });

      await seedSession(testDb.kysely, {
        leagueId: poe1League,
        totalCount: 5,
        isActive: false,
      });
      await seedSession(testDb.kysely, {
        leagueId: poe2League,
        game: "poe2",
        totalCount: 10,
        isActive: false,
      });

      // Delete only the poe1 league
      const deleteHandler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await deleteHandler({}, poe1League);
      expect(result.success).toBe(true);

      // poe2 league should still exist
      const usageHandler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const usage = await usageHandler({});
      expect(usage).toHaveLength(1);
      expect(usage[0].game).toBe("poe2");
    });

    it("should handle league with snapshot card prices correctly during delete", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Price League",
        game: "poe1",
      });

      // Create multiple snapshots with prices
      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 1200,
            divineValue: 6,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 2,
            divineValue: 0.01,
          },
        ],
      });
      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 1100,
            divineValue: 5.5,
          },
        ],
      });

      const handler = getIpcHandler(StorageChannel.DeleteLeagueData);
      const result = await handler({}, leagueId);
      expect(result.success).toBe(true);

      // All snapshot prices should be gone
      const prices = testDb.db
        .prepare("SELECT * FROM snapshot_card_prices")
        .all();
      expect(prices).toHaveLength(0);
    });

    it("should estimate size including poe_leagues_cache rows", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Cached League",
        game: "poe1",
      });

      // Insert a poe_leagues_cache entry (PK is (game, league_id), so one row per game)
      testDb.db
        .prepare(
          `INSERT INTO poe_leagues_cache
           (id, game, league_id, name, is_active, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("cache-1", "poe1", leagueId, "Cached League", 1, "2025-01-01");

      const usageHandler = getIpcHandler(StorageChannel.GetLeagueUsage);
      const usage = await usageHandler({});

      expect(usage).toHaveLength(1);
      // 1 * AVG_POE_LEAGUE_CACHE_ROW_BYTES (150) = 150
      expect(usage[0].estimatedSizeBytes).toBe(150);
    });
  });
});
