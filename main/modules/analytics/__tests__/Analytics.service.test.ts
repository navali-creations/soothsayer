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

import {
  createTestDatabase,
  seedCards,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { AnalyticsService } from "../Analytics.service";

describe("AnalyticsService", () => {
  let testDb: TestDatabase;
  let service: AnalyticsService;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Reset the singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static for testing
    AnalyticsService._instance = undefined;

    service = AnalyticsService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    AnalyticsService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = AnalyticsService.getInstance();
      const instance2 = AnalyticsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── getMostCommonCards ─────────────────────────────────────────────────
  // NOTE: getMostCommonCards queries the `cards` table (DataStore aggregate),
  // not `session_cards`. We seed via seedCards() with scope = leagueName.

  describe("getMostCommonCards", () => {
    it("should return an empty array when no cards exist for the league", async () => {
      const result = await service.getMostCommonCards("poe1", "Settlers");
      expect(result).toEqual([]);
    });

    it("should return cards ordered by count descending", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 10,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
        { game: "poe1", scope: "Settlers", cardName: "The Gambler", count: 5 },
      ]);

      const result = await service.getMostCommonCards("poe1", "Settlers", 10);
      expect(result).toHaveLength(3);
      // Most common first
      expect(result[0].cardName).toBe("Rain of Chaos");
      expect(result[0].count).toBe(10);
      expect(result[1].cardName).toBe("The Gambler");
      expect(result[1].count).toBe(5);
      expect(result[2].cardName).toBe("The Doctor");
      expect(result[2].count).toBe(2);
    });

    it("should respect the limit parameter", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "Card A", count: 10 },
        { game: "poe1", scope: "Settlers", cardName: "Card B", count: 5 },
        { game: "poe1", scope: "Settlers", cardName: "Card C", count: 3 },
      ]);

      const result = await service.getMostCommonCards("poe1", "Settlers", 2);
      expect(result).toHaveLength(2);
      expect(result[0].cardName).toBe("Card A");
      expect(result[1].cardName).toBe("Card B");
    });

    it("should include percentage of total", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "Card A", count: 75 },
        { game: "poe1", scope: "Settlers", cardName: "Card B", count: 25 },
      ]);

      const result = await service.getMostCommonCards("poe1", "Settlers", 10);
      expect(result).toHaveLength(2);
      expect(result[0].percentage).toBeCloseTo(75, 0);
      expect(result[1].percentage).toBeCloseTo(25, 0);
    });

    it("should not mix cards from different leagues (scopes)", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "Necropolis",
          cardName: "The Doctor",
          count: 100,
        },
      ]);

      const result = await service.getMostCommonCards("poe1", "Settlers", 10);
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(5);
    });

    it("should not include cards from other games", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 5 },
        { game: "poe2", scope: "Settlers", cardName: "The Doctor", count: 50 },
      ]);

      const result = await service.getMostCommonCards("poe1", "Settlers", 10);
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(5);
    });
  });

  // ─── getHighestValueCards ───────────────────────────────────────────────
  // NOTE: getHighestValueCards queries snapshot_card_prices joined with
  // snapshots and leagues. We seed via seedLeague + seedSnapshot with cardPrices.

  describe("getHighestValueCards", () => {
    it("should return an empty array when no snapshots exist", async () => {
      await seedLeague(testDb.kysely, { game: "poe1", name: "Settlers" });
      const result = await service.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
      );
      expect(result).toEqual([]);
    });

    it("should return cards ordered by peak chaos value descending", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.006,
          },
          {
            cardName: "The Apothecary",
            priceSource: "exchange",
            chaosValue: 10000,
            divineValue: 60,
          },
        ],
      });

      const result = await service.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].cardName).toBe("The Apothecary");
      expect(result[0].maxChaosValue).toBe(10000);
      expect(result[1].cardName).toBe("The Doctor");
      expect(result[1].maxChaosValue).toBe(5000);
      expect(result[2].cardName).toBe("Rain of Chaos");
      expect(result[2].maxChaosValue).toBe(1);
    });

    it("should respect the limit parameter", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "Card A",
            priceSource: "exchange",
            chaosValue: 100,
            divineValue: 1,
          },
          {
            cardName: "Card B",
            priceSource: "exchange",
            chaosValue: 50,
            divineValue: 0.5,
          },
          {
            cardName: "Card C",
            priceSource: "exchange",
            chaosValue: 10,
            divineValue: 0.1,
          },
        ],
      });

      const result = await service.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        1,
      );
      expect(result).toHaveLength(1);
      expect(result[0].cardName).toBe("Card A");
    });

    it("should filter by price source", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 4500,
            divineValue: 27,
          },
        ],
      });

      const exchangeResult = await service.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );
      const stashResult = await service.getHighestValueCards(
        "poe1",
        "Settlers",
        "stash",
        10,
      );

      expect(exchangeResult[0].maxChaosValue).toBe(5000);
      expect(stashResult[0].maxChaosValue).toBe(4500);
    });

    it("should not mix cards from different leagues", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const necropolisId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Necropolis",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId: settlersId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
        ],
      });
      await seedSnapshot(testDb.kysely, {
        leagueId: necropolisId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 8000,
            divineValue: 50,
          },
        ],
      });

      const settlersResult = await service.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );
      expect(settlersResult).toHaveLength(1);
      expect(settlersResult[0].maxChaosValue).toBe(5000);
    });
  });

  // ─── getCardPriceHistory ────────────────────────────────────────────────

  describe("getCardPriceHistory", () => {
    it("should return an empty array when no price data exists", async () => {
      await seedLeague(testDb.kysely, { game: "poe1", name: "Settlers" });
      const result = await service.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );
      expect(result).toEqual([]);
    });

    it("should return price history for a specific card", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Create two snapshots at different times to simulate history
      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: "2025-01-01T00:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 4000,
            divineValue: 25,
          },
        ],
      });
      await seedSnapshot(testDb.kysely, {
        leagueId,
        fetchedAt: "2025-01-02T00:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
        ],
      });

      const result = await service.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(result).toHaveLength(2);
      // Should have timestamps and values
      for (const entry of result) {
        expect(entry.chaosValue).toBeDefined();
        expect(entry.divineValue).toBeDefined();
        expect(entry.timestamp).toBeDefined();
      }
      // Ordered by fetched_at ascending
      expect(result[0].chaosValue).toBe(4000);
      expect(result[1].chaosValue).toBe(5000);
    });

    it("should only return history for the requested price source", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 4500,
            divineValue: 27,
          },
        ],
      });

      const exchangeHistory = await service.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );
      const stashHistory = await service.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "stash",
      );

      expect(exchangeHistory).toHaveLength(1);
      expect(stashHistory).toHaveLength(1);
      expect(exchangeHistory[0].chaosValue).toBe(5000);
      expect(stashHistory[0].chaosValue).toBe(4500);
    });
  });

  // ─── getLeagueAnalytics ─────────────────────────────────────────────────
  // NOTE: getLeagueAnalytics composes multiple calls:
  //   - getLeagueStats → queries `cards` table (scope = leagueName)
  //   - getLeagueSessionCount → queries `sessions` joined with `leagues`
  //   - getMostCommonCards → queries `cards` table
  //   - getHighestValueCards → queries snapshot_card_prices

  describe("getLeagueAnalytics", () => {
    it("should return zeroed analytics when league has no data", async () => {
      await seedLeague(testDb.kysely, { game: "poe1", name: "EmptyLeague" });
      const analytics = await service.getLeagueAnalytics("poe1", "EmptyLeague");

      expect(analytics.leagueName).toBe("EmptyLeague");
      expect(analytics.totalCards).toBe(0);
      expect(analytics.uniqueCards).toBe(0);
      expect(analytics.sessionCount).toBe(0);
      expect(analytics.mostCommon).toEqual([]);
      expect(analytics.highestValue).toEqual([]);
    });

    it("should compute aggregate analytics correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Seed into `cards` table for mostCommon/totalCards/uniqueCards
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 13,
        },
      ]);

      // Seed snapshot card prices for highestValue
      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.006,
          },
        ],
      });

      // Seed sessions for sessionCount
      const snapshotId = (await testDb.kysely
        .selectFrom("snapshots")
        .select("id")
        .executeTakeFirst())!.id;

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });

      const analytics = await service.getLeagueAnalytics("poe1", "Settlers");

      expect(analytics.leagueName).toBe("Settlers");
      expect(analytics.totalCards).toBe(15); // 2 + 13
      expect(analytics.uniqueCards).toBe(2);
      expect(analytics.sessionCount).toBe(2);
      expect(analytics.mostCommon.length).toBeGreaterThan(0);
      expect(analytics.highestValue.length).toBeGreaterThan(0);
    });

    it("should return the correct session count", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });

      const analytics = await service.getLeagueAnalytics("poe1", "Settlers");
      expect(analytics.sessionCount).toBe(3);
    });

    it("should not count sessions from other leagues", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const necropolisId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Necropolis",
      });

      const snap1 = await seedSnapshot(testDb.kysely, {
        leagueId: settlersId,
      });
      const snap2 = await seedSnapshot(testDb.kysely, {
        leagueId: necropolisId,
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        snapshotId: snap1,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: necropolisId,
        snapshotId: snap2,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: necropolisId,
        snapshotId: snap2,
      });

      const settlersAnalytics = await service.getLeagueAnalytics(
        "poe1",
        "Settlers",
      );
      expect(settlersAnalytics.sessionCount).toBe(1);

      const necropolisAnalytics = await service.getLeagueAnalytics(
        "poe1",
        "Necropolis",
      );
      expect(necropolisAnalytics.sessionCount).toBe(2);
    });

    it("should populate both mostCommon and highestValue arrays", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Seed cards table for mostCommon
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 20,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 1 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Apothecary",
          count: 1,
        },
      ]);

      // Seed snapshot prices for highestValue
      await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.006,
          },
          {
            cardName: "The Apothecary",
            priceSource: "exchange",
            chaosValue: 10000,
            divineValue: 60,
          },
        ],
      });

      const analytics = await service.getLeagueAnalytics("poe1", "Settlers");

      // mostCommon should be ordered by count
      expect(analytics.mostCommon[0].cardName).toBe("Rain of Chaos");

      // highestValue should be ordered by peak chaos value
      expect(analytics.highestValue[0].cardName).toBe("The Apothecary");
    });
  });

  // ─── compareSessions ────────────────────────────────────────────────────
  // NOTE: compareSessions queries session_cards directly

  describe("compareSessions", () => {
    it("should return an empty array when comparing sessions with no cards", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      const s1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      const s2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });

      const result = await service.compareSessions(s1, s2);
      expect(result).toEqual([]);
    });

    it("should compare cards between two sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      const s1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      const s2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });

      await seedSessionCards(testDb.kysely, s1, [
        { cardName: "The Doctor", count: 3 },
        { cardName: "Rain of Chaos", count: 10 },
      ]);
      await seedSessionCards(testDb.kysely, s2, [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 15 },
      ]);

      const result = await service.compareSessions(s1, s2);

      expect(result.length).toBeGreaterThan(0);

      const doctorComparison = result.find((r) => r.cardName === "The Doctor");
      expect(doctorComparison).toBeDefined();
      expect(doctorComparison!.session1Count).toBe(3);
      expect(doctorComparison!.session2Count).toBe(1);

      const rainComparison = result.find((r) => r.cardName === "Rain of Chaos");
      expect(rainComparison).toBeDefined();
      expect(rainComparison!.session1Count).toBe(10);
      expect(rainComparison!.session2Count).toBe(15);
    });

    it("should handle cards unique to one session", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      const s1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      const s2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });

      await seedSessionCards(testDb.kysely, s1, [
        { cardName: "The Doctor", count: 3 },
      ]);
      await seedSessionCards(testDb.kysely, s2, [
        { cardName: "The Apothecary", count: 2 },
      ]);

      const result = await service.compareSessions(s1, s2);

      const doctorComparison = result.find((r) => r.cardName === "The Doctor");
      if (doctorComparison) {
        expect(doctorComparison.session1Count).toBe(3);
        expect(doctorComparison.session2Count).toBe(0);
      }

      const apoComparison = result.find((r) => r.cardName === "The Apothecary");
      if (apoComparison) {
        expect(apoComparison.session1Count).toBe(0);
        expect(apoComparison.session2Count).toBe(2);
      }
    });

    it("should include difference field", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      const s1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });
      const s2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
      });

      await seedSessionCards(testDb.kysely, s1, [
        { cardName: "The Doctor", count: 3 },
      ]);
      await seedSessionCards(testDb.kysely, s2, [
        { cardName: "The Doctor", count: 8 },
      ]);

      const result = await service.compareSessions(s1, s2);
      const comparison = result.find((r) => r.cardName === "The Doctor");
      expect(comparison).toBeDefined();
      // difference = session2Count - session1Count = 8 - 3 = 5
      expect(comparison!.difference).toBe(5);
    });
  });

  // ─── getOccurrenceRatios ────────────────────────────────────────────────
  // NOTE: getOccurrenceRatios queries the `cards` table (scope = leagueName)

  describe("getOccurrenceRatios", () => {
    it("should return an empty array when no cards exist", async () => {
      const result = await service.getOccurrenceRatios("poe1", "Settlers");
      expect(result).toEqual([]);
    });

    it("should return occurrence ratios for all cards", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 15,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 1 },
      ]);

      const result = await service.getOccurrenceRatios("poe1", "Settlers");
      expect(result.length).toBe(2);

      // Each entry should have cardName, count, ratio, percentage
      for (const entry of result) {
        expect(entry.cardName).toBeDefined();
        expect(typeof entry.count).toBe("number");
        expect(typeof entry.ratio).toBe("number");
        expect(typeof entry.percentage).toBe("number");
      }

      const rainRatio = result.find((r) => r.cardName === "Rain of Chaos");
      const doctorRatio = result.find((r) => r.cardName === "The Doctor");
      expect(rainRatio).toBeDefined();
      expect(doctorRatio).toBeDefined();
      expect(rainRatio!.count).toBe(15);
      expect(doctorRatio!.count).toBe(1);

      // Rain of Chaos = 15/16 ≈ 93.75%
      expect(rainRatio!.percentage).toBeCloseTo(93.75, 1);
      // The Doctor = 1/16 ≈ 6.25%
      expect(doctorRatio!.percentage).toBeCloseTo(6.25, 1);
    });

    it("should only include cards from the specified league scope", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "Card A", count: 10 },
        { game: "poe1", scope: "Necropolis", cardName: "Card B", count: 50 },
      ]);

      const result = await service.getOccurrenceRatios("poe1", "Settlers");
      expect(result).toHaveLength(1);
      expect(result[0].cardName).toBe("Card A");
    });
  });

  // ─── Cross-league isolation ─────────────────────────────────────────────

  describe("cross-league isolation", () => {
    it("should fully isolate analytics between leagues", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const necropolisId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Necropolis",
      });

      // Seed cards table per league scope
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "Necropolis",
          cardName: "The Apothecary",
          count: 3,
        },
      ]);

      // Seed snapshot prices per league
      const snap1 = await seedSnapshot(testDb.kysely, {
        leagueId: settlersId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
        ],
      });
      const snap2 = await seedSnapshot(testDb.kysely, {
        leagueId: necropolisId,
        cardPrices: [
          {
            cardName: "The Apothecary",
            priceSource: "exchange",
            chaosValue: 10000,
            divineValue: 60,
          },
        ],
      });

      // Seed sessions per league
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        snapshotId: snap1,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: necropolisId,
        snapshotId: snap2,
      });

      const settlersAnalytics = await service.getLeagueAnalytics(
        "poe1",
        "Settlers",
      );
      const necropolisAnalytics = await service.getLeagueAnalytics(
        "poe1",
        "Necropolis",
      );

      expect(settlersAnalytics.totalCards).toBe(5);
      expect(settlersAnalytics.uniqueCards).toBe(1);
      expect(settlersAnalytics.sessionCount).toBe(1);

      expect(necropolisAnalytics.totalCards).toBe(3);
      expect(necropolisAnalytics.uniqueCards).toBe(1);
      expect(necropolisAnalytics.sessionCount).toBe(1);
    });
  });

  // ─── Cross-game isolation ──────────────────────────────────────────────

  describe("cross-game isolation", () => {
    it("should isolate analytics between poe1 and poe2", async () => {
      const poe1LeagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const poe2LeagueId = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Settlers",
      });

      // Seed cards table per game
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 10 },
        { game: "poe2", scope: "Settlers", cardName: "The Doctor", count: 3 },
      ]);

      const snap1 = await seedSnapshot(testDb.kysely, {
        leagueId: poe1LeagueId,
      });
      const snap2 = await seedSnapshot(testDb.kysely, {
        leagueId: poe2LeagueId,
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: poe1LeagueId,
        snapshotId: snap1,
      });
      await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId: poe2LeagueId,
        snapshotId: snap2,
      });

      const poe1Analytics = await service.getLeagueAnalytics(
        "poe1",
        "Settlers",
      );
      const poe2Analytics = await service.getLeagueAnalytics(
        "poe2",
        "Settlers",
      );

      expect(poe1Analytics.totalCards).toBe(10);
      expect(poe2Analytics.totalCards).toBe(3);
    });

    it("should isolate getMostCommonCards between games", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 10 },
        { game: "poe2", scope: "Settlers", cardName: "The Doctor", count: 3 },
      ]);

      const poe1Result = await service.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );
      const poe2Result = await service.getMostCommonCards(
        "poe2",
        "Settlers",
        10,
      );

      expect(poe1Result).toHaveLength(1);
      expect(poe1Result[0].count).toBe(10);
      expect(poe2Result).toHaveLength(1);
      expect(poe2Result[0].count).toBe(3);
    });
  });
});
