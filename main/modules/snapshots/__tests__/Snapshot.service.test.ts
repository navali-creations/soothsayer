import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ─────────────────────────────────────────────────
const { mockGetAllWindows } = vi.hoisted(() => ({
  mockGetAllWindows: vi.fn(() => [] as any[]),
}));

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
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

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
const mockGetKysely = vi.fn();
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock DivinationCardsService ─────────────────────────────────────────────
const mockUpdateRaritiesFromPrices = vi.fn().mockResolvedValue(undefined);
vi.mock("~/main/modules/divination-cards", () => ({
  DivinationCardsService: {
    getInstance: vi.fn(() => ({
      updateRaritiesFromPrices: mockUpdateRaritiesFromPrices,
      initialize: vi.fn(),
    })),
  },
}));

// ─── Mock SupabaseClientService ──────────────────────────────────────────────
const mockIsConfigured = vi.fn().mockReturnValue(true);
const mockGetLatestSnapshot = vi.fn();
vi.mock("~/main/modules/supabase", () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      isConfigured: mockIsConfigured,
      getLatestSnapshot: mockGetLatestSnapshot,
    })),
  },
}));

import {
  createTestDatabase,
  seedLeague,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { SnapshotChannel } from "../Snapshot.channels";
import { SnapshotService } from "../Snapshot.service";

describe("SnapshotService", () => {
  let testDb: TestDatabase;
  let service: SnapshotService;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Reset mock return values to defaults (clearAllMocks doesn't reset these)
    mockIsConfigured.mockReturnValue(true);
    mockGetLatestSnapshot.mockReset();
    mockUpdateRaritiesFromPrices.mockReset().mockResolvedValue(undefined);
    mockGetAllWindows.mockReturnValue([]);

    // Reset the singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static for testing
    SnapshotService._instance = undefined;

    service = SnapshotService.getInstance();
  });

  afterEach(async () => {
    service.stopAllAutoRefresh();
    // @ts-expect-error accessing private static for testing
    SnapshotService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = SnapshotService.getInstance();
      const instance2 = SnapshotService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── ensureLeague ───────────────────────────────────────────────────────

  describe("ensureLeague", () => {
    it("should create a new league when none exists", async () => {
      const leagueId = await service.ensureLeague("poe1", "Settlers");

      expect(leagueId).toBeDefined();
      expect(typeof leagueId).toBe("string");
      expect(leagueId.length).toBeGreaterThan(0);

      // Verify it was stored
      const row = await testDb.kysely
        .selectFrom("leagues")
        .selectAll()
        .where("id", "=", leagueId)
        .executeTakeFirst();

      expect(row).toBeDefined();
      expect(row!.game).toBe("poe1");
      expect(row!.name).toBe("Settlers");
    });

    it("should return existing league id when league already exists", async () => {
      const existingId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const returnedId = await service.ensureLeague("poe1", "Settlers");

      expect(returnedId).toBe(existingId);
    });

    it("should create separate leagues for different games", async () => {
      const poe1Id = await service.ensureLeague("poe1", "Standard");
      const poe2Id = await service.ensureLeague("poe2", "Standard");

      expect(poe1Id).not.toBe(poe2Id);
    });

    it("should create separate leagues for different names", async () => {
      const id1 = await service.ensureLeague("poe1", "Settlers");
      const id2 = await service.ensureLeague("poe1", "Standard");

      expect(id1).not.toBe(id2);
    });

    it("should pass through startDate when creating a league", async () => {
      const startDate = "2025-06-01T00:00:00Z";
      const leagueId = await service.ensureLeague(
        "poe1",
        "NewLeague",
        startDate,
      );

      const row = await testDb.kysely
        .selectFrom("leagues")
        .selectAll()
        .where("id", "=", leagueId)
        .executeTakeFirst();

      expect(row!.start_date).toBe(startDate);
    });

    it("should be idempotent — calling multiple times returns the same id", async () => {
      const id1 = await service.ensureLeague("poe1", "Settlers");
      const id2 = await service.ensureLeague("poe1", "Settlers");
      const id3 = await service.ensureLeague("poe1", "Settlers");

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });
  });

  // ─── loadSnapshot ──────────────────────────────────────────────────────

  describe("loadSnapshot", () => {
    it("should return null for a non-existent snapshot", async () => {
      const result = await service.loadSnapshot("non-existent-id");
      expect(result).toBeNull();
    });

    it("should return a correctly formatted SessionPriceSnapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: "2025-01-15T12:00:00Z",
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 800,
            divineValue: 4.0,
            stackSize: 8,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 780,
            divineValue: 3.9,
            stackSize: 8,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      const result = await service.loadSnapshot(snapshotId);

      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe("2025-01-15T12:00:00Z");
      expect(result!.stackedDeckChaosCost).toBe(3);

      // Exchange prices
      expect(result!.exchange.chaosToDivineRatio).toBe(200);
      expect(result!.exchange.cardPrices["The Doctor"]).toEqual({
        chaosValue: 800,
        divineValue: 4.0,
        stackSize: 8,
      });
      expect(result!.exchange.cardPrices["Rain of Chaos"]).toEqual({
        chaosValue: 1,
        divineValue: 0.005,
        stackSize: undefined,
      });

      // Stash prices
      expect(result!.stash.chaosToDivineRatio).toBe(195);
      expect(result!.stash.cardPrices["The Doctor"]).toEqual({
        chaosValue: 780,
        divineValue: 3.9,
        stackSize: 8,
      });
    });

    it("should separate exchange and stash prices correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "Card A",
            priceSource: "exchange",
            chaosValue: 100,
            divineValue: 0.5,
          },
          {
            cardName: "Card B",
            priceSource: "stash",
            chaosValue: 50,
            divineValue: 0.25,
          },
          {
            cardName: "Card C",
            priceSource: "exchange",
            chaosValue: 200,
            divineValue: 1.0,
          },
          {
            cardName: "Card C",
            priceSource: "stash",
            chaosValue: 190,
            divineValue: 0.95,
          },
        ],
      });

      const result = await service.loadSnapshot(snapshotId);

      // Exchange should have Card A and Card C
      expect(Object.keys(result!.exchange.cardPrices)).toHaveLength(2);
      expect(result!.exchange.cardPrices["Card A"]).toBeDefined();
      expect(result!.exchange.cardPrices["Card C"]).toBeDefined();
      expect(result!.exchange.cardPrices["Card B"]).toBeUndefined();

      // Stash should have Card B and Card C
      expect(Object.keys(result!.stash.cardPrices)).toHaveLength(2);
      expect(result!.stash.cardPrices["Card B"]).toBeDefined();
      expect(result!.stash.cardPrices["Card C"]).toBeDefined();
      expect(result!.stash.cardPrices["Card A"]).toBeUndefined();
    });

    it("should handle a snapshot with no card prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 5,
        cardPrices: [],
      });

      const result = await service.loadSnapshot(snapshotId);

      expect(result).not.toBeNull();
      expect(result!.exchange.chaosToDivineRatio).toBe(200);
      expect(result!.stash.chaosToDivineRatio).toBe(195);
      expect(result!.stackedDeckChaosCost).toBe(5);
      expect(Object.keys(result!.exchange.cardPrices)).toHaveLength(0);
      expect(Object.keys(result!.stash.cardPrices)).toHaveLength(0);
    });

    it("should handle stackSize being null (returns undefined in DTO)", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Gambler",
            priceSource: "exchange",
            chaosValue: 2,
            divineValue: 0.01,
            // stackSize not provided → null in DB
          },
        ],
      });

      const result = await service.loadSnapshot(snapshotId);

      expect(
        result!.exchange.cardPrices["The Gambler"].stackSize,
      ).toBeUndefined();
    });

    it("should return stackedDeckChaosCost as 0 when null in DB", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      // Seed snapshot with stackedDeckChaosCost explicitly 0
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        stackedDeckChaosCost: 0,
        cardPrices: [],
      });

      const result = await service.loadSnapshot(snapshotId);

      expect(result!.stackedDeckChaosCost).toBe(0);
    });
  });

  // ─── getSnapshotForSession ─────────────────────────────────────────────

  describe("getSnapshotForSession", () => {
    it("should reuse a recent snapshot when one exists", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Seed a very recent snapshot (now)
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: new Date().toISOString(),
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 800,
            divineValue: 4.0,
          },
        ],
      });

      const result = await service.getSnapshotForSession("poe1", "Settlers");

      expect(result.snapshotId).toBe(snapshotId);
      expect(result.data).toBeDefined();
      expect(result.data.exchange.cardPrices["The Doctor"]).toBeDefined();

      // Supabase should NOT have been called since we reused
      expect(mockGetLatestSnapshot).not.toHaveBeenCalled();
    });

    it("should call updateRaritiesFromPrices when reusing a snapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: new Date().toISOString(),
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 800,
            divineValue: 4.0,
          },
        ],
      });

      await service.getSnapshotForSession("poe1", "Settlers");

      expect(mockUpdateRaritiesFromPrices).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        200,
        expect.objectContaining({
          "The Doctor": expect.objectContaining({ chaosValue: 800 }),
        }),
      );
    });

    it("should fetch from Supabase when no recent snapshot exists", async () => {
      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 3,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {
            "The Doctor": { chaosValue: 800, divineValue: 4.0 },
          },
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {
            "The Doctor": { chaosValue: 780, divineValue: 3.9 },
          },
        },
      };

      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      const result = await service.getSnapshotForSession("poe1", "Settlers");

      expect(result.snapshotId).toBeDefined();
      expect(result.data).toBeDefined();
      expect(mockGetLatestSnapshot).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("should store the fetched snapshot locally", async () => {
      const mockSnapshotData = {
        timestamp: "2025-01-20T12:00:00Z",
        stackedDeckChaosCost: 3,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {
            "The Doctor": { chaosValue: 800, divineValue: 4.0 },
          },
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {},
        },
      };

      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      const result = await service.getSnapshotForSession("poe1", "Settlers");

      // Verify the snapshot was stored in the DB
      const storedSnapshot = await testDb.kysely
        .selectFrom("snapshots")
        .selectAll()
        .where("id", "=", result.snapshotId)
        .executeTakeFirst();

      expect(storedSnapshot).toBeDefined();
      expect(storedSnapshot!.exchange_chaos_to_divine).toBe(200);
      expect(storedSnapshot!.stash_chaos_to_divine).toBe(195);
    });

    it("should call updateRaritiesFromPrices when fetching a new snapshot", async () => {
      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 3,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {
            "The Doctor": { chaosValue: 800, divineValue: 4.0 },
          },
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {},
        },
      };

      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "Settlers");

      expect(mockUpdateRaritiesFromPrices).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        200,
        { "The Doctor": { chaosValue: 800, divineValue: 4.0 } },
      );
    });

    it("should fall back to local data when Supabase fails", async () => {
      // Create a league and an old snapshot (well within 24*30 hour fallback window)
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Seed an old snapshot — 5 hours ago (stale for auto-refresh but within fallback)
      const fiveHoursAgo = new Date(
        Date.now() - 5 * 60 * 60 * 1000,
      ).toISOString();

      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: fiveHoursAgo,
        exchangeChaosToDivine: 180,
        stashChaosToDivine: 175,
        cardPrices: [
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      // Supabase fails
      mockGetLatestSnapshot.mockRejectedValue(new Error("Network error"));

      const result = await service.getSnapshotForSession("poe1", "Settlers");

      // Should have used the local fallback
      expect(result.data).toBeDefined();
      expect(result.data.exchange.chaosToDivineRatio).toBe(180);
      expect(result.data.exchange.cardPrices["Rain of Chaos"]).toBeDefined();
    });

    it("should throw when Supabase fails and no local snapshot exists", async () => {
      mockGetLatestSnapshot.mockRejectedValue(new Error("Network error"));

      await expect(
        service.getSnapshotForSession("poe1", "NonExistentLeague"),
      ).rejects.toThrow(/No snapshot available/);
    });

    it("should fall back to local data when Supabase is not configured", async () => {
      mockIsConfigured.mockReturnValue(false);

      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();

      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: twoHoursAgo,
        exchangeChaosToDivine: 190,
        stashChaosToDivine: 185,
        cardPrices: [],
      });

      const result = await service.getSnapshotForSession("poe1", "Settlers");

      expect(result.data).toBeDefined();
      expect(result.data.exchange.chaosToDivineRatio).toBe(190);
      expect(mockGetLatestSnapshot).not.toHaveBeenCalled();
    });

    it("should reach the not-configured branch in fetchSnapshotWithFallback when no recent snapshot", async () => {
      mockIsConfigured.mockReturnValue(false);

      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Seed a snapshot older than AUTO_REFRESH_INTERVAL_HOURS (4h) so it's
      // NOT reused by getSnapshotForSession, but still available as a fallback
      // inside fetchSnapshotWithFallback (which looks back 24*30 hours).
      const fiveHoursAgo = new Date(
        Date.now() - 5 * 60 * 60 * 1000,
      ).toISOString();

      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: fiveHoursAgo,
        exchangeChaosToDivine: 180,
        stashChaosToDivine: 175,
        cardPrices: [],
      });

      const result = await service.getSnapshotForSession("poe1", "Settlers");

      // Should have used the local fallback (old snapshot)
      expect(result.data).toBeDefined();
      expect(result.data.exchange.chaosToDivineRatio).toBe(180);
      expect(mockGetLatestSnapshot).not.toHaveBeenCalled();
    });

    it("should create the league if it does not exist yet", async () => {
      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 3,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {},
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {},
        },
      };

      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "BrandNewLeague");

      // Verify league was created
      const league = await testDb.kysely
        .selectFrom("leagues")
        .selectAll()
        .where("game", "=", "poe1")
        .where("name", "=", "BrandNewLeague")
        .executeTakeFirst();

      expect(league).toBeDefined();
    });
  });

  // ─── Auto-refresh management ───────────────────────────────────────────

  describe("startAutoRefresh / stopAutoRefresh", () => {
    it("should not throw when starting auto-refresh", () => {
      expect(() => service.startAutoRefresh("poe1", "Settlers")).not.toThrow();
    });

    it("should not start duplicate intervals for the same league", () => {
      service.startAutoRefresh("poe1", "Settlers");
      service.startAutoRefresh("poe1", "Settlers");

      // Access the private map to check
      // @ts-expect-error accessing private for testing
      const intervals = service.refreshIntervals;
      expect(intervals.size).toBe(1);
    });

    it("should track separate intervals for different leagues", () => {
      service.startAutoRefresh("poe1", "Settlers");
      service.startAutoRefresh("poe1", "Standard");

      // @ts-expect-error accessing private for testing
      const intervals = service.refreshIntervals;
      expect(intervals.size).toBe(2);
    });

    it("should track separate intervals for different games", () => {
      service.startAutoRefresh("poe1", "Standard");
      service.startAutoRefresh("poe2", "Standard");

      // @ts-expect-error accessing private for testing
      const intervals = service.refreshIntervals;
      expect(intervals.size).toBe(2);
    });

    it("should stop a specific auto-refresh", () => {
      service.startAutoRefresh("poe1", "Settlers");
      service.startAutoRefresh("poe1", "Standard");

      service.stopAutoRefresh("poe1", "Settlers");

      // @ts-expect-error accessing private for testing
      const intervals = service.refreshIntervals;
      expect(intervals.size).toBe(1);
      expect(intervals.has("poe1:Standard")).toBe(true);
      expect(intervals.has("poe1:Settlers")).toBe(false);
    });

    it("should handle stopping a non-existent auto-refresh gracefully", () => {
      expect(() =>
        service.stopAutoRefresh("poe1", "NonExistent"),
      ).not.toThrow();
    });
  });

  describe("stopAllAutoRefresh", () => {
    it("should stop all auto-refresh intervals", () => {
      service.startAutoRefresh("poe1", "Settlers");
      service.startAutoRefresh("poe1", "Standard");
      service.startAutoRefresh("poe2", "Standard");

      service.stopAllAutoRefresh();

      // @ts-expect-error accessing private for testing
      const intervals = service.refreshIntervals;
      expect(intervals.size).toBe(0);
    });

    it("should handle no active intervals gracefully", () => {
      expect(() => service.stopAllAutoRefresh()).not.toThrow();
    });
  });

  // ─── emitSnapshotEvent window emission ──────────────────────────────────

  describe("emitSnapshotEvent (via getSnapshotForSession)", () => {
    function createMockWindow(
      overrides: {
        isDestroyed?: boolean;
        webContentsIsDestroyed?: boolean;
        webContents?: null;
        sendThrows?: boolean;
      } = {},
    ) {
      const send = overrides.sendThrows
        ? vi.fn(() => {
            throw new Error("send failed");
          })
        : vi.fn();
      return {
        isDestroyed: vi.fn(() => overrides.isDestroyed ?? false),
        webContents:
          overrides.webContents === null
            ? null
            : {
                isDestroyed: vi.fn(
                  () => overrides.webContentsIsDestroyed ?? false,
                ),
                send,
              },
      };
    }

    it("should send snapshot events to all valid windows", async () => {
      const win1 = createMockWindow();
      const win2 = createMockWindow();
      mockGetAllWindows.mockReturnValue([win1, win2]);

      const _leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 5,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {},
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {},
        },
      };
      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "Settlers");

      // OnSnapshotCreated should be sent to both windows
      expect(win1.webContents!.send).toHaveBeenCalledWith(
        SnapshotChannel.OnSnapshotCreated,
        expect.objectContaining({
          league: "Settlers",
          game: "poe1",
        }),
      );
      expect(win2.webContents!.send).toHaveBeenCalledWith(
        SnapshotChannel.OnSnapshotCreated,
        expect.objectContaining({
          league: "Settlers",
          game: "poe1",
        }),
      );
    });

    it("should skip destroyed windows", async () => {
      const goodWin = createMockWindow();
      const destroyedWin = createMockWindow({ isDestroyed: true });
      mockGetAllWindows.mockReturnValue([destroyedWin, goodWin]);

      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 5,
        exchange: { chaosToDivineRatio: 200, cardPrices: {} },
        stash: { chaosToDivineRatio: 195, cardPrices: {} },
      };
      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "Settlers");

      expect(goodWin.webContents!.send).toHaveBeenCalled();
      expect(destroyedWin.webContents).toBeDefined();
      // The destroyed window's send should not have been called because isDestroyed() is true
      if (destroyedWin.webContents) {
        expect(destroyedWin.webContents.send).not.toHaveBeenCalled();
      }
    });

    it("should skip windows with destroyed webContents", async () => {
      const goodWin = createMockWindow();
      const badWin = createMockWindow({ webContentsIsDestroyed: true });
      mockGetAllWindows.mockReturnValue([badWin, goodWin]);

      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 5,
        exchange: { chaosToDivineRatio: 200, cardPrices: {} },
        stash: { chaosToDivineRatio: 195, cardPrices: {} },
      };
      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "Settlers");

      expect(goodWin.webContents!.send).toHaveBeenCalled();
      expect(badWin.webContents!.send).not.toHaveBeenCalled();
    });

    it("should skip windows with null webContents", async () => {
      const goodWin = createMockWindow();
      const nullWin = createMockWindow({ webContents: null });
      mockGetAllWindows.mockReturnValue([nullWin, goodWin]);

      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 5,
        exchange: { chaosToDivineRatio: 200, cardPrices: {} },
        stash: { chaosToDivineRatio: 195, cardPrices: {} },
      };
      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "Settlers");

      expect(goodWin.webContents!.send).toHaveBeenCalled();
    });

    it("should catch and warn when send throws on a window", async () => {
      const goodWin = createMockWindow();
      const throwingWin = createMockWindow({ sendThrows: true });
      mockGetAllWindows.mockReturnValue([throwingWin, goodWin]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockSnapshotData = {
        timestamp: new Date().toISOString(),
        stackedDeckChaosCost: 5,
        exchange: { chaosToDivineRatio: 200, cardPrices: {} },
        stash: { chaosToDivineRatio: 195, cardPrices: {} },
      };
      mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

      await service.getSnapshotForSession("poe1", "Settlers");

      // The throwing window should have triggered a warning
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SnapshotService] Failed to emit event"),
        expect.any(String),
      );
      // The good window should still have received the event
      expect(goodWin.webContents!.send).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should emit OnSnapshotReused when reusing a recent snapshot", async () => {
      const win = createMockWindow();
      mockGetAllWindows.mockReturnValue([win]);

      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const recentTime = new Date(
        Date.now() - 1 * 60 * 60 * 1000,
      ).toISOString();

      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: recentTime,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        cardPrices: [
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      await service.getSnapshotForSession("poe1", "Settlers");

      expect(win.webContents!.send).toHaveBeenCalledWith(
        SnapshotChannel.OnSnapshotReused,
        expect.objectContaining({
          league: "Settlers",
          game: "poe1",
        }),
      );
    });
  });

  // ─── Auto-refresh interval body execution ───────────────────────────────

  describe("startAutoRefresh interval callback", () => {
    it("should fetch and store a new snapshot when the interval fires", async () => {
      vi.useFakeTimers();

      try {
        const leagueId = await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });

        const mockSnapshotData = {
          timestamp: new Date().toISOString(),
          stackedDeckChaosCost: 5,
          exchange: {
            chaosToDivineRatio: 210,
            cardPrices: {
              "The Doctor": { chaosValue: 5000, divineValue: 23.8 },
            },
          },
          stash: {
            chaosToDivineRatio: 205,
            cardPrices: {
              "The Doctor": { chaosValue: 4800, divineValue: 23.4 },
            },
          },
        };
        mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

        service.startAutoRefresh("poe1", "Settlers");

        // Advance past the 4-hour interval
        await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);

        // fetchSnapshotWithFallback should have called Supabase
        expect(mockGetLatestSnapshot).toHaveBeenCalledWith("poe1", "Settlers");

        // updateRaritiesFromPrices should have been called
        expect(mockUpdateRaritiesFromPrices).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
          210,
          { "The Doctor": { chaosValue: 5000, divineValue: 23.8 } },
        );

        // A new snapshot should have been stored in the database
        const rows = await testDb.kysely
          .selectFrom("snapshots")
          .selectAll()
          .where("league_id", "=", leagueId)
          .execute();
        expect(rows.length).toBeGreaterThanOrEqual(1);
      } finally {
        service.stopAllAutoRefresh();
        vi.useRealTimers();
      }
    });

    it("should emit OnSnapshotCreated to windows when interval fires", async () => {
      vi.useFakeTimers();

      try {
        const win = {
          isDestroyed: vi.fn(() => false),
          webContents: {
            isDestroyed: vi.fn(() => false),
            send: vi.fn(),
          },
        };
        mockGetAllWindows.mockReturnValue([win]);

        await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });

        const mockSnapshotData = {
          timestamp: new Date().toISOString(),
          stackedDeckChaosCost: 5,
          exchange: { chaosToDivineRatio: 200, cardPrices: {} },
          stash: { chaosToDivineRatio: 195, cardPrices: {} },
        };
        mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

        service.startAutoRefresh("poe1", "Settlers");

        // The OnAutoRefreshStarted event should have been emitted immediately
        expect(win.webContents.send).toHaveBeenCalledWith(
          SnapshotChannel.OnAutoRefreshStarted,
          expect.objectContaining({
            game: "poe1",
            league: "Settlers",
            intervalHours: 4,
          }),
        );

        // Clear the mock to isolate interval-fired events
        win.webContents.send.mockClear();

        // Advance past the 4-hour interval
        await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);

        // OnSnapshotCreated should have been emitted
        expect(win.webContents.send).toHaveBeenCalledWith(
          SnapshotChannel.OnSnapshotCreated,
          expect.objectContaining({
            league: "Settlers",
            game: "poe1",
          }),
        );
      } finally {
        service.stopAllAutoRefresh();
        vi.useRealTimers();
      }
    });

    it("should catch errors in the interval callback and not crash", async () => {
      vi.useFakeTimers();

      try {
        const errorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        // Make Supabase fail and ensure no local snapshot is available
        // so fetchSnapshotWithFallback throws
        mockGetLatestSnapshot.mockRejectedValue(new Error("Network timeout"));

        service.startAutoRefresh("poe1", "NonExistentLeague");

        // Advance past the 4-hour interval
        await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);

        // The error should be caught and logged
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[SnapshotService] Failed to auto-refresh snapshot",
          ),
          expect.any(Error),
        );

        errorSpy.mockRestore();
      } finally {
        service.stopAllAutoRefresh();
        vi.useRealTimers();
      }
    });

    it("should use poe2 game type for non-poe1 games in the interval", async () => {
      vi.useFakeTimers();

      try {
        await seedLeague(testDb.kysely, {
          game: "poe2",
          name: "Standard",
        });

        const mockSnapshotData = {
          timestamp: new Date().toISOString(),
          stackedDeckChaosCost: 3,
          exchange: { chaosToDivineRatio: 150, cardPrices: {} },
          stash: { chaosToDivineRatio: 145, cardPrices: {} },
        };
        mockGetLatestSnapshot.mockResolvedValue(mockSnapshotData);

        service.startAutoRefresh("poe2", "Standard");

        await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);

        expect(mockGetLatestSnapshot).toHaveBeenCalledWith("poe2", "Standard");
        expect(mockUpdateRaritiesFromPrices).toHaveBeenCalledWith(
          "poe2",
          "Standard",
          150,
          {},
        );
      } finally {
        service.stopAllAutoRefresh();
        vi.useRealTimers();
      }
    });

    it("should emit OnAutoRefreshStopped when stopping an active auto-refresh", () => {
      const win = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          isDestroyed: vi.fn(() => false),
          send: vi.fn(),
        },
      };
      mockGetAllWindows.mockReturnValue([win]);

      service.startAutoRefresh("poe1", "Settlers");

      // Clear start event
      win.webContents.send.mockClear();

      service.stopAutoRefresh("poe1", "Settlers");

      expect(win.webContents.send).toHaveBeenCalledWith(
        SnapshotChannel.OnAutoRefreshStopped,
        expect.objectContaining({
          game: "poe1",
          league: "Settlers",
        }),
      );
    });
  });
});
