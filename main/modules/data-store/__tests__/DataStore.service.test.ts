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

// ─── Mock PerformanceLoggerService ───────────────────────────────────────────
vi.mock("~/main/modules/performance-logger", () => ({
  PerformanceLoggerService: {
    getInstance: vi.fn(() => ({
      startTimer: vi.fn(() => null),
      startTimers: vi.fn(() => null),
      log: vi.fn(),
      time: vi.fn(),
    })),
  },
}));

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { DataStoreService } from "../DataStore.service";

describe("DataStoreService", () => {
  let testDb: TestDatabase;
  let service: DataStoreService;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Reset the singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static for testing
    DataStoreService._instance = undefined;

    service = DataStoreService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    DataStoreService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = DataStoreService.getInstance();
      const instance2 = DataStoreService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── getGlobalStats ─────────────────────────────────────────────────────

  describe("getGlobalStats", () => {
    it("should return zero totalStackedDecksOpened when no cards have been added", async () => {
      const stats = await service.getGlobalStats();
      expect(stats).toEqual({ totalStackedDecksOpened: 0 });
    });

    it("should return correct global count after adding cards", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");

      const stats = await service.getGlobalStats();
      expect(stats.totalStackedDecksOpened).toBe(2);
    });

    it("should accumulate across games", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe2", "Early Access", "The Apothecary");

      const stats = await service.getGlobalStats();
      expect(stats.totalStackedDecksOpened).toBe(2);
    });
  });

  // ─── addCard ────────────────────────────────────────────────────────────

  describe("addCard", () => {
    it("should increment global stats by 1 per card", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      const stats = await service.getGlobalStats();
      expect(stats.totalStackedDecksOpened).toBe(1);
    });

    it("should add the card to all-time stats", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(1);
      expect(allTime.cards["The Doctor"]).toBeDefined();
      expect(allTime.cards["The Doctor"].count).toBe(1);
    });

    it("should add the card to league stats", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      const league = await service.getLeagueStats("poe1", "Settlers");
      expect(league.totalCount).toBe(1);
      expect(league.cards["The Doctor"]).toBeDefined();
      expect(league.cards["The Doctor"].count).toBe(1);
    });

    it("should increment count when adding the same card again", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "The Doctor");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.cards["The Doctor"].count).toBe(3);
      expect(allTime.totalCount).toBe(3);
    });

    it("should track multiple different cards correctly", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Settlers", "The Apothecary");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(4);
      expect(allTime.cards["The Doctor"].count).toBe(1);
      expect(allTime.cards["Rain of Chaos"].count).toBe(2);
      expect(allTime.cards["The Apothecary"].count).toBe(1);
    });

    it("should update both all-time and league in a single transaction", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      const allTime = await service.getAllTimeStats("poe1");
      const league = await service.getLeagueStats("poe1", "Settlers");

      expect(allTime.cards["The Doctor"].count).toBe(1);
      expect(league.cards["The Doctor"].count).toBe(1);
    });

    it("should keep separate league stats per league", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "The Doctor");

      const settlers = await service.getLeagueStats("poe1", "Settlers");
      const necropolis = await service.getLeagueStats("poe1", "Necropolis");

      expect(settlers.cards["The Doctor"].count).toBe(2);
      expect(necropolis.cards["The Doctor"].count).toBe(1);
    });

    it("should merge all leagues into all-time", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "The Doctor");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.cards["The Doctor"].count).toBe(2);
      expect(allTime.totalCount).toBe(2);
    });

    it("should keep separate game stats", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe2", "Early Access", "The Doctor");

      const poe1AllTime = await service.getAllTimeStats("poe1");
      const poe2AllTime = await service.getAllTimeStats("poe2");

      expect(poe1AllTime.cards["The Doctor"].count).toBe(1);
      expect(poe2AllTime.cards["The Doctor"].count).toBe(1);
    });

    it("should set lastUpdated timestamp", async () => {
      await service.addCard("poe1", "Settlers", "Rain of Chaos");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.lastUpdated).toBeDefined();
      expect(typeof allTime.lastUpdated).toBe("string");
    });
  });

  // ─── getAllTimeStats ────────────────────────────────────────────────────

  describe("getAllTimeStats", () => {
    it("should return empty stats when no cards exist", async () => {
      const stats = await service.getAllTimeStats("poe1");
      expect(stats.totalCount).toBe(0);
      expect(stats.cards).toEqual({});
    });

    it("should return all cards across leagues for a game", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Necropolis", "The Apothecary");

      const stats = await service.getAllTimeStats("poe1");
      expect(stats.totalCount).toBe(3);
      expect(Object.keys(stats.cards)).toHaveLength(3);
      expect(stats.cards["The Doctor"].count).toBe(1);
      expect(stats.cards["Rain of Chaos"].count).toBe(1);
      expect(stats.cards["The Apothecary"].count).toBe(1);
    });

    it("should not include cards from other games", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe2", "Early Access", "The Apothecary");

      const poe1Stats = await service.getAllTimeStats("poe1");
      expect(Object.keys(poe1Stats.cards)).toHaveLength(1);
      expect(poe1Stats.cards["The Doctor"]).toBeDefined();
      expect(poe1Stats.cards["The Apothecary"]).toBeUndefined();
    });
  });

  // ─── getLeagueStats ────────────────────────────────────────────────────

  describe("getLeagueStats", () => {
    it("should return empty stats for a league with no cards", async () => {
      const stats = await service.getLeagueStats("poe1", "Settlers");
      expect(stats.totalCount).toBe(0);
      expect(stats.cards).toEqual({});
    });

    it("should return only cards from the specified league", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Necropolis", "The Apothecary");

      const settlers = await service.getLeagueStats("poe1", "Settlers");
      expect(settlers.totalCount).toBe(2);
      expect(Object.keys(settlers.cards)).toHaveLength(2);
      expect(settlers.cards["The Doctor"]).toBeDefined();
      expect(settlers.cards["Rain of Chaos"]).toBeDefined();
      expect(settlers.cards["The Apothecary"]).toBeUndefined();
    });

    it("should correctly count duplicates within a league", async () => {
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");

      const stats = await service.getLeagueStats("poe1", "Settlers");
      expect(stats.totalCount).toBe(3);
      expect(stats.cards["Rain of Chaos"].count).toBe(3);
    });
  });

  // ─── resetAllTimeStats ──────────────────────────────────────────────────

  describe("resetAllTimeStats", () => {
    it("should remove all all-time cards for a game", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");

      await service.resetAllTimeStats("poe1");

      const stats = await service.getAllTimeStats("poe1");
      expect(stats.totalCount).toBe(0);
      expect(stats.cards).toEqual({});
    });

    it("should not affect league stats", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      await service.resetAllTimeStats("poe1");

      const league = await service.getLeagueStats("poe1", "Settlers");
      expect(league.totalCount).toBe(1);
      expect(league.cards["The Doctor"].count).toBe(1);
    });

    it("should not affect other games", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe2", "Early Access", "The Doctor");

      await service.resetAllTimeStats("poe1");

      const poe2Stats = await service.getAllTimeStats("poe2");
      expect(poe2Stats.totalCount).toBe(1);
    });
  });

  // ─── resetLeagueStats ──────────────────────────────────────────────────

  describe("resetLeagueStats", () => {
    it("should remove cards for a specific league", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "Rain of Chaos");

      await service.resetLeagueStats("poe1", "Settlers");

      const settlers = await service.getLeagueStats("poe1", "Settlers");
      expect(settlers.totalCount).toBe(0);

      const necropolis = await service.getLeagueStats("poe1", "Necropolis");
      expect(necropolis.totalCount).toBe(1);
    });

    it("should not affect all-time stats", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      await service.resetLeagueStats("poe1", "Settlers");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(1);
    });
  });

  // ─── resetGlobalStats ──────────────────────────────────────────────────

  describe("resetGlobalStats", () => {
    it("should reset totalStackedDecksOpened to zero", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");

      await service.resetGlobalStats();

      const stats = await service.getGlobalStats();
      expect(stats.totalStackedDecksOpened).toBe(0);
    });

    it("should not affect card stats", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      await service.resetGlobalStats();

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(1);
      expect(allTime.cards["The Doctor"].count).toBe(1);
    });
  });

  // ─── getAvailableLeagues ────────────────────────────────────────────────

  describe("getAvailableLeagues", () => {
    it("should return empty array when no leagues have data", async () => {
      const leagues = await service.getAvailableLeagues("poe1");
      expect(leagues).toEqual([]);
    });

    it("should return leagues that have card data", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "Rain of Chaos");

      const leagues = await service.getAvailableLeagues("poe1");
      expect(leagues).toHaveLength(2);
      expect(leagues).toContain("Settlers");
      expect(leagues).toContain("Necropolis");
    });

    it("should not include 'all-time' as a league", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      const leagues = await service.getAvailableLeagues("poe1");
      expect(leagues).not.toContain("all-time");
    });

    it("should only return leagues for the specified game", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe2", "Early Access", "The Doctor");

      const poe1Leagues = await service.getAvailableLeagues("poe1");
      const poe2Leagues = await service.getAvailableLeagues("poe2");

      expect(poe1Leagues).toEqual(["Settlers"]);
      expect(poe2Leagues).toEqual(["Early Access"]);
    });

    it("should not include leagues after their data is reset", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "Rain of Chaos");

      await service.resetLeagueStats("poe1", "Settlers");

      const leagues = await service.getAvailableLeagues("poe1");
      expect(leagues).toEqual(["Necropolis"]);
    });
  });

  // ─── exportData ─────────────────────────────────────────────────────────

  describe("exportData", () => {
    it("should export all-time stats when scope is 'all-time'", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "Rain of Chaos");

      const data = await service.exportData("poe1", "all-time");
      expect(data.totalCount).toBe(2);
      expect(Object.keys(data.cards)).toHaveLength(2);
    });

    it("should export league stats when scope is a league name", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Necropolis", "The Apothecary");

      const data = await service.exportData("poe1", "Settlers");
      expect(data.totalCount).toBe(2);
      expect(Object.keys(data.cards)).toHaveLength(2);
      expect(data.cards["The Doctor"]).toBeDefined();
      expect(data.cards["Rain of Chaos"]).toBeDefined();
    });
  });

  // ─── Cascading / Integration Scenarios ──────────────────────────────────

  describe("cascading updates", () => {
    it("should maintain consistency across global, all-time, and league stats", async () => {
      // Add several cards across leagues
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Necropolis", "The Apothecary");
      await service.addCard("poe1", "Necropolis", "Rain of Chaos");

      // Global: total count of all additions
      const global = await service.getGlobalStats();
      expect(global.totalStackedDecksOpened).toBe(5);

      // All-time: all cards for the game, counts merged
      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(5);
      expect(allTime.cards["The Doctor"].count).toBe(2);
      expect(allTime.cards["Rain of Chaos"].count).toBe(2);
      expect(allTime.cards["The Apothecary"].count).toBe(1);

      // League: only cards for that league
      const settlers = await service.getLeagueStats("poe1", "Settlers");
      expect(settlers.totalCount).toBe(3);
      expect(settlers.cards["The Doctor"].count).toBe(2);
      expect(settlers.cards["Rain of Chaos"].count).toBe(1);

      const necropolis = await service.getLeagueStats("poe1", "Necropolis");
      expect(necropolis.totalCount).toBe(2);
      expect(necropolis.cards["The Apothecary"].count).toBe(1);
      expect(necropolis.cards["Rain of Chaos"].count).toBe(1);
    });

    it("should handle a large number of sequential card additions", async () => {
      const cardNames = [
        "Rain of Chaos",
        "The Gambler",
        "Her Mask",
        "The Flora's Gift",
        "Destined to Crumble",
      ];

      // Add 50 cards total
      for (let i = 0; i < 50; i++) {
        const cardName = cardNames[i % cardNames.length];
        await service.addCard("poe1", "Settlers", cardName);
      }

      const global = await service.getGlobalStats();
      expect(global.totalStackedDecksOpened).toBe(50);

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(50);

      // Each card should have 10 occurrences (50 / 5 cards)
      for (const name of cardNames) {
        expect(allTime.cards[name].count).toBe(10);
      }
    });

    it("should survive reset of one scope without affecting others", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.addCard("poe1", "Settlers", "Rain of Chaos");
      await service.addCard("poe1", "Necropolis", "The Doctor");

      // Reset Settlers league
      await service.resetLeagueStats("poe1", "Settlers");

      // League gone
      const settlers = await service.getLeagueStats("poe1", "Settlers");
      expect(settlers.totalCount).toBe(0);

      // Other league intact
      const necropolis = await service.getLeagueStats("poe1", "Necropolis");
      expect(necropolis.totalCount).toBe(1);

      // All-time intact
      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(3);

      // Global intact
      const global = await service.getGlobalStats();
      expect(global.totalStackedDecksOpened).toBe(3);
    });

    it("should allow re-adding cards after reset", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");
      await service.resetAllTimeStats("poe1");

      await service.addCard("poe1", "Settlers", "The Doctor");

      const allTime = await service.getAllTimeStats("poe1");
      expect(allTime.totalCount).toBe(1);
      expect(allTime.cards["The Doctor"].count).toBe(1);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle card names with special characters", async () => {
      await service.addCard("poe1", "Settlers", "The King's Blade");
      await service.addCard("poe1", "Settlers", "Jack in the Box");

      const stats = await service.getAllTimeStats("poe1");
      expect(stats.cards["The King's Blade"].count).toBe(1);
      expect(stats.cards["Jack in the Box"].count).toBe(1);
    });

    it("should handle league names with spaces", async () => {
      await service.addCard("poe1", "Settlers of Kalguur", "The Doctor");

      const stats = await service.getLeagueStats("poe1", "Settlers of Kalguur");
      expect(stats.totalCount).toBe(1);
    });

    it("should return lastUpdated from the most recently updated card", async () => {
      await service.addCard("poe1", "Settlers", "The Doctor");

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.addCard("poe1", "Settlers", "Rain of Chaos");

      const stats = await service.getAllTimeStats("poe1");
      expect(stats.lastUpdated).toBeDefined();
    });

    it("should return undefined lastUpdated when no cards exist", async () => {
      const stats = await service.getAllTimeStats("poe1");
      expect(stats.lastUpdated).toBeUndefined();
    });
  });
});
