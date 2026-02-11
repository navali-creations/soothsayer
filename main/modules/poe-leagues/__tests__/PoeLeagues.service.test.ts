import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
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

// ─── Mock SupabaseClientService ──────────────────────────────────────────────
const mockIsConfigured = vi.fn().mockReturnValue(true);
const mockCallEdgeFunction = vi.fn();
vi.mock("~/main/modules/supabase", () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      isConfigured: mockIsConfigured,
      callEdgeFunction: mockCallEdgeFunction,
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
const mockSettingsGet = vi.fn();
const mockSettingsSet = vi.fn();
vi.mock("~/main/modules", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
  },
}));

// Also mock the direct import path used by PoeLeagues.service.ts
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
  },
}));

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { PoeLeaguesService } from "../PoeLeagues.service";

describe("PoeLeaguesService", () => {
  let testDb: TestDatabase;
  let service: PoeLeaguesService;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Reset mock return values to defaults (clearAllMocks doesn't reset these)
    mockIsConfigured.mockReturnValue(true);
    mockCallEdgeFunction.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();

    // Reset the singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static for testing
    PoeLeaguesService._instance = undefined;

    service = PoeLeaguesService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    PoeLeaguesService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = PoeLeaguesService.getInstance();
      const instance2 = PoeLeaguesService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── isCacheStale ──────────────────────────────────────────────────────

  describe("isCacheStale", () => {
    it("should return true when no cache metadata exists", async () => {
      const isStale = await service.isCacheStale("poe1");
      expect(isStale).toBe(true);
    });

    it("should return false when cache is fresh", async () => {
      // Insert fresh cache metadata
      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game: "poe1",
          last_fetched_at: new Date().toISOString(),
        })
        .execute();

      const isStale = await service.isCacheStale("poe1");
      expect(isStale).toBe(false);
    });

    it("should return true when cache is older than threshold", async () => {
      // Insert stale cache metadata (25 hours ago, threshold is 23)
      const staleDate = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();

      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game: "poe1",
          last_fetched_at: staleDate,
        })
        .execute();

      const isStale = await service.isCacheStale("poe1");
      expect(isStale).toBe(true);
    });

    it("should track cache staleness independently per game", async () => {
      // poe1 has fresh cache
      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game: "poe1",
          last_fetched_at: new Date().toISOString(),
        })
        .execute();

      // poe2 has no cache
      const poe1Stale = await service.isCacheStale("poe1");
      const poe2Stale = await service.isCacheStale("poe2");

      expect(poe1Stale).toBe(false);
      expect(poe2Stale).toBe(true);
    });
  });

  // ─── getCachedLeaguesOnly ─────────────────────────────────────────────

  describe("getCachedLeaguesOnly", () => {
    it("should return empty array when no leagues are cached", async () => {
      const leagues = await service.getCachedLeaguesOnly("poe1");
      expect(leagues).toEqual([]);
    });

    it("should return only active cached leagues", async () => {
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values([
          {
            id: "poe1_settlers",
            game: "poe1",
            league_id: "settlers",
            name: "Settlers",
            start_at: "2025-01-01",
            end_at: null,
            is_active: 1,
            updated_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
          },
          {
            id: "poe1_standard",
            game: "poe1",
            league_id: "standard",
            name: "Standard",
            start_at: null,
            end_at: null,
            is_active: 1,
            updated_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
          },
          {
            id: "poe1_old",
            game: "poe1",
            league_id: "old-league",
            name: "Old League",
            start_at: "2024-01-01",
            end_at: "2024-06-01",
            is_active: 0,
            updated_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
          },
        ])
        .execute();

      const leagues = await service.getCachedLeaguesOnly("poe1");

      expect(leagues).toHaveLength(2);
      const names = leagues.map((l) => l.name);
      expect(names).toContain("Settlers");
      expect(names).toContain("Standard");
      expect(names).not.toContain("Old League");
    });

    it("should return only leagues for the requested game", async () => {
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values([
          {
            id: "poe1_settlers",
            game: "poe1",
            league_id: "settlers",
            name: "Settlers",
            start_at: null,
            end_at: null,
            is_active: 1,
            updated_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
          },
          {
            id: "poe2_standard",
            game: "poe2",
            league_id: "standard",
            name: "Standard",
            start_at: null,
            end_at: null,
            is_active: 1,
            updated_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
          },
        ])
        .execute();

      const poe1Leagues = await service.getCachedLeaguesOnly("poe1");
      const poe2Leagues = await service.getCachedLeaguesOnly("poe2");

      expect(poe1Leagues).toHaveLength(1);
      expect(poe1Leagues[0].name).toBe("Settlers");

      expect(poe2Leagues).toHaveLength(1);
      expect(poe2Leagues[0].name).toBe("Standard");
    });

    it("should return leagues with correct DTO shape", async () => {
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: "poe1_settlers",
          game: "poe1",
          league_id: "settlers-id",
          name: "Settlers",
          start_at: "2025-01-15T00:00:00Z",
          end_at: "2025-04-15T00:00:00Z",
          is_active: 1,
          updated_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        })
        .execute();

      const leagues = await service.getCachedLeaguesOnly("poe1");

      expect(leagues).toHaveLength(1);
      expect(leagues[0]).toEqual({
        id: "settlers-id",
        name: "Settlers",
        startAt: "2025-01-15T00:00:00Z",
        endAt: "2025-04-15T00:00:00Z",
      });
    });
  });

  // ─── fetchLeagues ──────────────────────────────────────────────────────

  describe("fetchLeagues", () => {
    it("should return cached leagues when cache is fresh", async () => {
      // Insert fresh cache metadata
      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game: "poe1",
          last_fetched_at: new Date().toISOString(),
        })
        .execute();

      // Insert cached league
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: "poe1_settlers",
          game: "poe1",
          league_id: "settlers",
          name: "Settlers",
          start_at: "2025-01-01",
          end_at: null,
          is_active: 1,
          updated_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        })
        .execute();

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toHaveLength(1);
      expect(leagues[0].name).toBe("Settlers");
      // Supabase should NOT have been called
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should fetch from Supabase when cache is stale", async () => {
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers",
            startAt: "2025-01-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
          {
            id: "2",
            leagueId: "standard",
            name: "Standard",
            startAt: null,
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toHaveLength(2);
      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "get-leagues-legacy",
        expect.objectContaining({ game: "poe1" }),
      );

      const names = leagues.map((l) => l.name);
      expect(names).toContain("Settlers");
      expect(names).toContain("Standard");
    });

    it("should store fetched leagues in the local cache", async () => {
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers",
            startAt: "2025-01-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      await service.fetchLeagues("poe1");

      // Verify it was stored
      const cached = await testDb.kysely
        .selectFrom("poe_leagues_cache")
        .selectAll()
        .where("game", "=", "poe1")
        .execute();

      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe("Settlers");
      expect(cached[0].is_active).toBe(1);
    });

    it("should update cache metadata after successful fetch", async () => {
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers",
            startAt: "2025-01-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      await service.fetchLeagues("poe1");

      const metadata = await testDb.kysely
        .selectFrom("poe_leagues_cache_metadata")
        .selectAll()
        .where("game", "=", "poe1")
        .executeTakeFirst();

      expect(metadata).toBeDefined();
      expect(metadata!.last_fetched_at).toBeDefined();
    });

    it("should deactivate leagues no longer in Supabase response", async () => {
      // Pre-populate cache with old league
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: "poe1_old",
          game: "poe1",
          league_id: "old-league",
          name: "Old League",
          start_at: "2024-01-01",
          end_at: "2024-06-01",
          is_active: 1,
          updated_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        })
        .execute();

      // Supabase returns only new leagues (old league is gone)
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers",
            startAt: "2025-01-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      await service.fetchLeagues("poe1");

      // Old league should be deactivated, not deleted
      const oldLeague = await testDb.kysely
        .selectFrom("poe_leagues_cache")
        .selectAll()
        .where("league_id", "=", "old-league")
        .executeTakeFirst();

      expect(oldLeague).toBeDefined();
      expect(oldLeague!.is_active).toBe(0);

      // New league should be active
      const newLeague = await testDb.kysely
        .selectFrom("poe_leagues_cache")
        .selectAll()
        .where("league_id", "=", "settlers")
        .executeTakeFirst();

      expect(newLeague).toBeDefined();
      expect(newLeague!.is_active).toBe(1);
    });

    it.each([
      "poe1",
      "poe2",
    ] as const)("should fall back to stale cache when Supabase fails (%s)", async (game) => {
      // Insert stale cache metadata
      const staleDate = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();

      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game,
          last_fetched_at: staleDate,
        })
        .execute();

      // Insert cached league (stale but available)
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: `${game}_settlers`,
          game,
          league_id: "settlers",
          name: "Settlers",
          start_at: "2025-01-01",
          end_at: null,
          is_active: 1,
          updated_at: staleDate,
          fetched_at: staleDate,
        })
        .execute();

      // Supabase fails
      mockCallEdgeFunction.mockRejectedValue(new Error("Network error"));

      const leagues = await service.fetchLeagues(game);

      // Should fall back to stale cache
      expect(leagues).toHaveLength(1);
      expect(leagues[0].name).toBe("Settlers");
    });

    it.each([
      "poe1",
      "poe2",
    ] as const)("should return Standard fallback when Supabase fails and no cache exists (%s)", async (game) => {
      mockCallEdgeFunction.mockRejectedValue(new Error("Network error"));

      const leagues = await service.fetchLeagues(game);

      expect(leagues).toEqual([
        { id: "Standard", name: "Standard", startAt: null, endAt: null },
      ]);
    });

    it("should not fetch from Supabase when cache is within threshold", async () => {
      // Insert cache metadata from 10 hours ago (threshold is 23)
      const tenHoursAgo = new Date(
        Date.now() - 10 * 60 * 60 * 1000,
      ).toISOString();

      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game: "poe1",
          last_fetched_at: tenHoursAgo,
        })
        .execute();

      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: "poe1_standard",
          game: "poe1",
          league_id: "standard",
          name: "Standard",
          start_at: null,
          end_at: null,
          is_active: 1,
          updated_at: tenHoursAgo,
          fetched_at: tenHoursAgo,
        })
        .execute();

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toHaveLength(1);
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });
  });

  // ─── refreshCache ──────────────────────────────────────────────────────

  describe("refreshCache", () => {
    it("should force-fetch from Supabase regardless of cache freshness", async () => {
      // Insert fresh cache metadata
      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game: "poe1",
          last_fetched_at: new Date().toISOString(),
        })
        .execute();

      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "new-league",
            name: "New League",
            startAt: "2025-06-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      const leagues = await service.refreshCache("poe1");

      expect(leagues).toHaveLength(1);
      expect(leagues[0].name).toBe("New League");
      expect(mockCallEdgeFunction).toHaveBeenCalled();
    });

    it("should throw when Supabase fails during refresh", async () => {
      mockCallEdgeFunction.mockRejectedValue(new Error("API error"));

      await expect(service.refreshCache("poe1")).rejects.toThrow("API error");
    });

    it("should update the cache after a successful refresh", async () => {
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers",
            startAt: "2025-01-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      await service.refreshCache("poe1");

      // Cache should now be fresh
      const isStale = await service.isCacheStale("poe1");
      expect(isStale).toBe(false);

      // And cache should contain the leagues
      const cached = await service.getCachedLeaguesOnly("poe1");
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe("Settlers");
    });
  });

  // ─── fetchLeagues — Supabase not configured ───────────────────────────

  describe("fetchLeagues — Supabase not configured", () => {
    it.each([
      "poe1",
      "poe2",
    ] as const)("should return Standard fallback when Supabase is not configured and no cache exists (%s)", async (game) => {
      mockIsConfigured.mockReturnValue(false);
      mockCallEdgeFunction.mockRejectedValue(
        new Error("Supabase client not configured"),
      );

      const leagues = await service.fetchLeagues(game);

      expect(leagues).toEqual([
        { id: "Standard", name: "Standard", startAt: null, endAt: null },
      ]);
    });

    it.each([
      "poe1",
      "poe2",
    ] as const)("should fall back to stale cache when Supabase is not configured (%s)", async (game) => {
      mockIsConfigured.mockReturnValue(false);
      mockCallEdgeFunction.mockRejectedValue(
        new Error("Supabase client not configured"),
      );

      // Insert stale cache
      const staleDate = new Date(
        Date.now() - 48 * 60 * 60 * 1000,
      ).toISOString();

      await testDb.kysely
        .insertInto("poe_leagues_cache_metadata")
        .values({
          game,
          last_fetched_at: staleDate,
        })
        .execute();

      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: `${game}_standard`,
          game,
          league_id: "standard",
          name: "Standard",
          start_at: null,
          end_at: null,
          is_active: 1,
          updated_at: staleDate,
          fetched_at: staleDate,
        })
        .execute();

      const leagues = await service.fetchLeagues(game);

      expect(leagues).toHaveLength(1);
      expect(leagues[0].name).toBe("Standard");
    });
  });

  // ─── Cache upsert behavior ─────────────────────────────────────────────

  describe("cache upsert behavior", () => {
    it("should update existing cached leagues when fetching new data", async () => {
      // Pre-populate cache
      await testDb.kysely
        .insertInto("poe_leagues_cache")
        .values({
          id: "poe1_settlers",
          game: "poe1",
          league_id: "settlers",
          name: "Settlers (Old Name)",
          start_at: "2025-01-01",
          end_at: null,
          is_active: 1,
          updated_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        })
        .execute();

      // Supabase returns updated name for the same league
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers of Kalguur",
            startAt: "2025-01-01",
            endAt: "2025-04-01",
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toHaveLength(1);
      expect(leagues[0].name).toBe("Settlers of Kalguur");

      // Verify the DB was updated, not duplicated
      const cachedRows = await testDb.kysely
        .selectFrom("poe_leagues_cache")
        .selectAll()
        .where("game", "=", "poe1")
        .where("league_id", "=", "settlers")
        .execute();

      expect(cachedRows).toHaveLength(1);
      expect(cachedRows[0].name).toBe("Settlers of Kalguur");
      expect(cachedRows[0].end_at).toBe("2025-04-01");
    });
  });

  // ─── Multiple games independence ──────────────────────────────────────

  describe("multiple games independence", () => {
    it("should maintain separate caches for poe1 and poe2", async () => {
      // Fetch for poe1
      mockCallEdgeFunction.mockResolvedValueOnce({
        leagues: [
          {
            id: "1",
            leagueId: "settlers",
            name: "Settlers",
            startAt: "2025-01-01",
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      await service.fetchLeagues("poe1");

      // Fetch for poe2
      mockCallEdgeFunction.mockResolvedValueOnce({
        leagues: [
          {
            id: "2",
            leagueId: "poe2-standard",
            name: "PoE2 Standard",
            startAt: null,
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      await service.fetchLeagues("poe2");

      // Verify separate caches
      const poe1Leagues = await service.getCachedLeaguesOnly("poe1");
      const poe2Leagues = await service.getCachedLeaguesOnly("poe2");

      expect(poe1Leagues).toHaveLength(1);
      expect(poe1Leagues[0].name).toBe("Settlers");

      expect(poe2Leagues).toHaveLength(1);
      expect(poe2Leagues[0].name).toBe("PoE2 Standard");
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle Supabase returning empty leagues array", async () => {
      mockCallEdgeFunction.mockResolvedValue({ leagues: [] });

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toEqual([]);
    });

    it("should handle Supabase returning many leagues", async () => {
      const manyLeagues = Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        leagueId: `league-${i}`,
        name: `League ${i}`,
        startAt: `2025-01-0${(i % 9) + 1}`,
        endAt: null,
        isActive: true,
        updatedAt: null,
      }));

      mockCallEdgeFunction.mockResolvedValue({ leagues: manyLeagues });

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toHaveLength(20);
    });

    it("should handle leagues with null start and end dates", async () => {
      mockCallEdgeFunction.mockResolvedValue({
        leagues: [
          {
            id: "1",
            leagueId: "standard",
            name: "Standard",
            startAt: null,
            endAt: null,
            isActive: true,
            updatedAt: null,
          },
        ],
      });

      const leagues = await service.fetchLeagues("poe1");

      expect(leagues).toHaveLength(1);
      expect(leagues[0].startAt).toBeNull();
      expect(leagues[0].endAt).toBeNull();
    });
  });
});
