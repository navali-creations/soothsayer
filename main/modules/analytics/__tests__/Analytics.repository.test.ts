import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedCards,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { AnalyticsRepository } from "../Analytics.repository";

describe("AnalyticsRepository", () => {
  let testDb: TestDatabase;
  let repository: AnalyticsRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new AnalyticsRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getMostCommonCards
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getMostCommonCards", () => {
    it("should return empty array when no cards exist", async () => {
      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );
      expect(results).toEqual([]);
    });

    it("should return cards ordered by count descending", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      expect(results).toHaveLength(3);
      expect(results[0].cardName).toBe("Rain of Chaos");
      expect(results[0].count).toBe(500);
      expect(results[1].cardName).toBe("Her Mask");
      expect(results[1].count).toBe(300);
      expect(results[2].cardName).toBe("The Doctor");
      expect(results[2].count).toBe(2);
    });

    it("should respect the limit parameter", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        2,
      );

      expect(results).toHaveLength(2);
      expect(results[0].cardName).toBe("Rain of Chaos");
      expect(results[1].cardName).toBe("Her Mask");
    });

    it("should calculate correct percentages", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 50,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 30 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 20 },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      // Total = 100, so percentages should be 50%, 30%, 20%
      expect(results[0].percentage).toBeCloseTo(50, 1);
      expect(results[1].percentage).toBeCloseTo(30, 1);
      expect(results[2].percentage).toBeCloseTo(20, 1);
    });

    it("should filter by game", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe2", scope: "Settlers", cardName: "Her Mask", count: 300 },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("Rain of Chaos");
    });

    it("should filter by league name (scope)", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Standard", cardName: "Her Mask", count: 300 },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("Rain of Chaos");
    });

    it("should return correct DTO shape with cardName, count, and percentage", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 100,
        },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("cardName");
      expect(results[0]).toHaveProperty("count");
      expect(results[0]).toHaveProperty("percentage");
      expect(results[0].percentage).toBeCloseTo(100, 1);
    });

    it("should handle a single card returning 100% percentage", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 42,
        },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].percentage).toBeCloseTo(100, 1);
    });

    it("should handle card names with special characters", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The King's Heart",
          count: 10,
        },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Brother's Stash",
          count: 5,
        },
      ]);

      const results = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );

      expect(results).toHaveLength(2);
      expect(results[0].cardName).toBe("The King's Heart");
      expect(results[1].cardName).toBe("Brother's Stash");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getHighestValueCards
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getHighestValueCards", () => {
    it("should return empty array when no snapshots exist", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(results).toEqual([]);
    });

    it("should return cards ordered by max chaos value descending", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
          {
            cardName: "The Fiend",
            priceSource: "exchange",
            chaosValue: 120000,
            divineValue: 600,
          },
        ],
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(results).toHaveLength(3);
      expect(results[0].cardName).toBe("The Fiend");
      expect(results[0].maxChaosValue).toBe(120000);
      expect(results[1].cardName).toBe("The Doctor");
      expect(results[1].maxChaosValue).toBe(90000);
      expect(results[2].cardName).toBe("Rain of Chaos");
      expect(results[2].maxChaosValue).toBe(1);
    });

    it("should respect the limit parameter", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
          {
            cardName: "The Fiend",
            priceSource: "exchange",
            chaosValue: 120000,
            divineValue: 600,
          },
        ],
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        1,
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("The Fiend");
    });

    it("should filter by price source", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 88000,
            divineValue: 440,
          },
        ],
      });

      const exchangeResults = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      const stashResults = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "stash",
        10,
      );

      expect(exchangeResults).toHaveLength(1);
      expect(exchangeResults[0].maxChaosValue).toBe(90000);

      expect(stashResults).toHaveLength(1);
      expect(stashResults[0].maxChaosValue).toBe(88000);
    });

    it("should filter by game", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      const poe2League = await seedLeague(testDb.kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-poe1",
        leagueId: poe1League,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-poe2",
        leagueId: poe2League,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "Some Card",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 25,
          },
        ],
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("The Doctor");
    });

    it("should filter by league name", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        id: "league-settlers",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      const standardId = await seedLeague(testDb.kysely, {
        id: "league-standard",
        game: "poe1",
        name: "Standard",
        startDate: "2020-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-settlers",
        leagueId: settlersId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-standard",
        leagueId: standardId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "Her Mask",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("The Doctor");
    });

    it("should calculate daysIntoLeague correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-31T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(results).toHaveLength(1);
      // 30 days from Jan 1 to Jan 31
      expect(results[0].daysIntoLeague).toBe(30);
    });

    it("should return the peak chaos value across multiple snapshots", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-10T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 80000,
            divineValue: 400,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-002",
        leagueId,
        fetchedAt: "2025-01-20T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 95000,
            divineValue: 475,
          },
        ],
      });

      const results = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].maxChaosValue).toBe(95000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getCardPriceHistory
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getCardPriceHistory", () => {
    it("should return empty array when no price history exists", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const results = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(results).toEqual([]);
    });

    it("should return price history ordered by timestamp ascending", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-10T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 80000,
            divineValue: 400,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-002",
        leagueId,
        fetchedAt: "2025-01-05T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 75000,
            divineValue: 375,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-003",
        leagueId,
        fetchedAt: "2025-01-20T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      const results = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(results).toHaveLength(3);
      // Ordered by timestamp asc
      expect(results[0].timestamp).toBe("2025-01-05T12:00:00Z");
      expect(results[0].chaosValue).toBe(75000);
      expect(results[1].timestamp).toBe("2025-01-10T12:00:00Z");
      expect(results[1].chaosValue).toBe(80000);
      expect(results[2].timestamp).toBe("2025-01-20T12:00:00Z");
      expect(results[2].chaosValue).toBe(90000);
    });

    it("should filter by card name", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-10T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      const results = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("The Doctor");
    });

    it("should filter by price source", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-10T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 88000,
            divineValue: 440,
          },
        ],
      });

      const exchangeResults = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      const stashResults = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "stash",
      );

      expect(exchangeResults).toHaveLength(1);
      expect(exchangeResults[0].chaosValue).toBe(90000);

      expect(stashResults).toHaveLength(1);
      expect(stashResults[0].chaosValue).toBe(88000);
    });

    it("should calculate daysIntoLeague correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-02-01T00:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      const results = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(results).toHaveLength(1);
      // 31 days from Jan 1 to Feb 1
      expect(results[0].daysIntoLeague).toBe(31);
    });

    it("should return the correct DTO shape", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      const results = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("cardName");
      expect(results[0]).toHaveProperty("timestamp");
      expect(results[0]).toHaveProperty("chaosValue");
      expect(results[0]).toHaveProperty("divineValue");
      expect(results[0]).toHaveProperty("daysIntoLeague");
    });

    it("should not return prices from a different league", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        id: "league-settlers",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      const standardId = await seedLeague(testDb.kysely, {
        id: "league-standard",
        game: "poe1",
        name: "Standard",
        startDate: "2020-01-01T00:00:00Z",
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-settlers",
        leagueId: settlersId,
        fetchedAt: "2025-01-10T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 90000,
            divineValue: 450,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-standard",
        leagueId: standardId,
        fetchedAt: "2025-01-10T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 50000,
            divineValue: 250,
          },
        ],
      });

      const results = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(results).toHaveLength(1);
      expect(results[0].chaosValue).toBe(90000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getLeagueStats
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getLeagueStats", () => {
    it("should return null-valued stats when no cards exist for the league", async () => {
      const result = await repository.getLeagueStats("poe1", "Settlers");

      // With no matching rows, SUM returns null and COUNT returns 0
      expect(result).not.toBeNull();
      expect(result!.uniqueCards).toBe(0);
    });

    it("should return correct total and unique card counts", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
      ]);

      const result = await repository.getLeagueStats("poe1", "Settlers");

      expect(result).not.toBeNull();
      expect(result!.totalCards).toBe(802); // 500 + 300 + 2
      expect(result!.uniqueCards).toBe(3);
    });

    it("should filter by game", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe2", scope: "Settlers", cardName: "Her Mask", count: 300 },
      ]);

      const result = await repository.getLeagueStats("poe1", "Settlers");

      expect(result).not.toBeNull();
      expect(result!.totalCards).toBe(500);
      expect(result!.uniqueCards).toBe(1);
    });

    it("should filter by league name (scope)", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Standard", cardName: "Her Mask", count: 300 },
      ]);

      const result = await repository.getLeagueStats("poe1", "Settlers");

      expect(result).not.toBeNull();
      expect(result!.totalCards).toBe(500);
      expect(result!.uniqueCards).toBe(1);
    });

    it("should handle a single card entry", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 42,
        },
      ]);

      const result = await repository.getLeagueStats("poe1", "Settlers");

      expect(result).not.toBeNull();
      expect(result!.totalCards).toBe(42);
      expect(result!.uniqueCards).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getLeagueSessionCount
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getLeagueSessionCount", () => {
    it("should return 0 when no sessions exist", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const count = await repository.getLeagueSessionCount("poe1", "Settlers");

      expect(count).toBe(0);
    });

    it("should count sessions for a specific game and league", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-15T10:00:00Z",
        isActive: false,
      });

      await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-16T10:00:00Z",
        isActive: false,
      });

      const count = await repository.getLeagueSessionCount("poe1", "Settlers");

      expect(count).toBe(2);
    });

    it("should not count sessions from different leagues", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        id: "league-settlers",
        game: "poe1",
        name: "Settlers",
      });

      const standardId = await seedLeague(testDb.kysely, {
        id: "league-standard",
        game: "poe1",
        name: "Standard",
      });

      await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId: settlersId,
        isActive: false,
      });

      await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId: standardId,
        isActive: false,
      });

      const count = await repository.getLeagueSessionCount("poe1", "Settlers");

      expect(count).toBe(1);
    });

    it("should not count sessions from different games", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
      });

      const poe2League = await seedLeague(testDb.kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
      });

      await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId: poe1League,
        isActive: false,
      });

      await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe2",
        leagueId: poe2League,
        isActive: false,
      });

      const count = await repository.getLeagueSessionCount("poe1", "Settlers");

      expect(count).toBe(1);
    });

    it("should include both active and inactive sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: true,
      });

      const count = await repository.getLeagueSessionCount("poe1", "Settlers");

      expect(count).toBe(2);
    });

    it("should return 0 when league does not exist", async () => {
      const count = await repository.getLeagueSessionCount(
        "poe1",
        "NonExistentLeague",
      );

      expect(count).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // compareSessions
  // ═══════════════════════════════════════════════════════════════════════════

  describe("compareSessions", () => {
    it("should return empty array when both sessions have no cards", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toEqual([]);
    });

    it("should compare cards between two sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "Rain of Chaos", count: 50 },
        { cardName: "The Doctor", count: 2 },
      ]);

      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "Rain of Chaos", count: 80 },
        { cardName: "The Doctor", count: 1 },
      ]);

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toHaveLength(2);

      // Results should be sorted by absolute difference descending
      const rainOfChaos = results.find((r) => r.cardName === "Rain of Chaos");
      const theDoctor = results.find((r) => r.cardName === "The Doctor");

      expect(rainOfChaos).toBeDefined();
      expect(rainOfChaos!.session1Count).toBe(50);
      expect(rainOfChaos!.session2Count).toBe(80);
      expect(rainOfChaos!.difference).toBe(30);

      expect(theDoctor).toBeDefined();
      expect(theDoctor!.session1Count).toBe(2);
      expect(theDoctor!.session2Count).toBe(1);
      expect(theDoctor!.difference).toBe(-1);
    });

    it("should handle card present only in session 1", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const _session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "The Doctor", count: 3 },
      ]);

      // session2 has no cards

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("The Doctor");
      expect(results[0].session1Count).toBe(3);
      expect(results[0].session2Count).toBe(0);
      expect(results[0].difference).toBe(-3);
    });

    it("should handle card present only in session 2", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const _session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      // session1 has no cards

      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "House of Mirrors", count: 1 },
      ]);

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("House of Mirrors");
      expect(results[0].session1Count).toBe(0);
      expect(results[0].session2Count).toBe(1);
      expect(results[0].difference).toBe(1);
    });

    it("should sort results by absolute difference descending", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "Rain of Chaos", count: 50 },
        { cardName: "The Doctor", count: 10 },
        { cardName: "Her Mask", count: 30 },
      ]);

      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "Rain of Chaos", count: 52 }, // diff = 2
        { cardName: "The Doctor", count: 0 }, // diff = -10
        { cardName: "Her Mask", count: 35 }, // diff = 5
      ]);

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toHaveLength(3);
      // Sorted by |difference| descending: 10, 5, 2
      expect(Math.abs(results[0].difference)).toBeGreaterThanOrEqual(
        Math.abs(results[1].difference),
      );
      expect(Math.abs(results[1].difference)).toBeGreaterThanOrEqual(
        Math.abs(results[2].difference),
      );
    });

    it("should handle sessions with identical cards", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "Rain of Chaos", count: 50 },
      ]);

      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "Rain of Chaos", count: 50 },
      ]);

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toHaveLength(1);
      expect(results[0].difference).toBe(0);
    });

    it("should handle card names with special characters", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "The King's Heart", count: 5 },
        { cardName: "Brother's Stash", count: 3 },
      ]);

      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "The King's Heart", count: 7 },
        { cardName: "Brother's Stash", count: 1 },
      ]);

      const results = await repository.compareSessions(
        "session-001",
        "session-002",
      );

      expect(results).toHaveLength(2);
      const kingsHeart = results.find((r) => r.cardName === "The King's Heart");
      const brothersStash = results.find(
        (r) => r.cardName === "Brother's Stash",
      );

      expect(kingsHeart).toBeDefined();
      expect(kingsHeart!.difference).toBe(2);

      expect(brothersStash).toBeDefined();
      expect(brothersStash!.difference).toBe(-2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getOccurrenceRatios
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getOccurrenceRatios", () => {
    it("should return empty array when no cards exist", async () => {
      const results = await repository.getOccurrenceRatios("poe1", "Settlers");
      expect(results).toEqual([]);
    });

    it("should return ratios ordered by count descending", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      expect(results).toHaveLength(3);
      expect(results[0].cardName).toBe("Rain of Chaos");
      expect(results[1].cardName).toBe("Her Mask");
      expect(results[2].cardName).toBe("The Doctor");
    });

    it("should calculate correct ratios and percentages", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 50,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 30 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 20 },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      // Total = 100
      expect(results[0].ratio).toBeCloseTo(0.5, 2);
      expect(results[0].percentage).toBeCloseTo(50, 1);
      expect(results[1].ratio).toBeCloseTo(0.3, 2);
      expect(results[1].percentage).toBeCloseTo(30, 1);
      expect(results[2].ratio).toBeCloseTo(0.2, 2);
      expect(results[2].percentage).toBeCloseTo(20, 1);
    });

    it("should have ratios that sum to approximately 1.0", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 400,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 200 },
        { game: "poe1", scope: "Settlers", cardName: "The Fiend", count: 100 },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      const totalRatio = results.reduce((sum, r) => sum + r.ratio, 0);
      expect(totalRatio).toBeCloseTo(1.0, 5);
    });

    it("should have percentages that sum to approximately 100", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 400,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 200 },
        { game: "poe1", scope: "Settlers", cardName: "The Fiend", count: 100 },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      const totalPercentage = results.reduce((sum, r) => sum + r.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it("should filter by game", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe2", scope: "Settlers", cardName: "Her Mask", count: 300 },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("Rain of Chaos");
    });

    it("should filter by league name (scope)", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
        { game: "poe1", scope: "Standard", cardName: "Her Mask", count: 300 },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      expect(results).toHaveLength(1);
      expect(results[0].cardName).toBe("Rain of Chaos");
      expect(results[0].ratio).toBeCloseTo(1.0, 5);
      expect(results[0].percentage).toBeCloseTo(100, 1);
    });

    it("should return the correct DTO shape", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 100,
        },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("cardName");
      expect(results[0]).toHaveProperty("count");
      expect(results[0]).toHaveProperty("ratio");
      expect(results[0]).toHaveProperty("percentage");
    });

    it("should handle very small ratios for rare cards", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 99998,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 1 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "House of Mirrors",
          count: 1,
        },
      ]);

      const results = await repository.getOccurrenceRatios("poe1", "Settlers");

      // The Doctor and House of Mirrors should have very small ratios
      const doctor = results.find((r) => r.cardName === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.ratio).toBeLessThan(0.001);
      expect(doctor!.percentage).toBeLessThan(0.1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-feature integration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("cross-feature integration", () => {
    it("should support a full analytics workflow: seed data → query stats → query ratios", async () => {
      // Seed card data
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 400,
        },
        { game: "poe1", scope: "Settlers", cardName: "Her Mask", count: 300 },
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 5 },
      ]);

      // Query league stats
      const stats = await repository.getLeagueStats("poe1", "Settlers");
      expect(stats).not.toBeNull();
      expect(stats!.totalCards).toBe(705);
      expect(stats!.uniqueCards).toBe(3);

      // Query most common cards
      const mostCommon = await repository.getMostCommonCards(
        "poe1",
        "Settlers",
        10,
      );
      expect(mostCommon).toHaveLength(3);
      expect(mostCommon[0].cardName).toBe("Rain of Chaos");

      // Query occurrence ratios
      const ratios = await repository.getOccurrenceRatios("poe1", "Settlers");
      expect(ratios).toHaveLength(3);
      const totalRatio = ratios.reduce((sum, r) => sum + r.ratio, 0);
      expect(totalRatio).toBeCloseTo(1.0, 5);
    });

    it("should support a complete price analysis workflow", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      // Seed snapshots for price history
      await seedSnapshot(testDb.kysely, {
        id: "snap-001",
        leagueId,
        fetchedAt: "2025-01-05T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 80000,
            divineValue: 400,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-002",
        leagueId,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 95000,
            divineValue: 475,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1.5,
            divineValue: 0.0075,
          },
        ],
      });

      // Query highest value cards
      const highestValue = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );
      expect(highestValue).toHaveLength(2);
      expect(highestValue[0].cardName).toBe("The Doctor");
      expect(highestValue[0].maxChaosValue).toBe(95000);

      // Query price history for The Doctor
      const priceHistory = await repository.getCardPriceHistory(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );
      expect(priceHistory).toHaveLength(2);
      expect(priceHistory[0].chaosValue).toBe(80000);
      expect(priceHistory[1].chaosValue).toBe(95000);
    });

    it("should support a session comparison workflow", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      // Create two sessions with cards
      const session1 = await seedSession(testDb.kysely, {
        id: "session-001",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        totalCount: 100,
        isActive: false,
      });

      const session2 = await seedSession(testDb.kysely, {
        id: "session-002",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-16T10:00:00Z",
        endedAt: "2025-01-16T12:00:00Z",
        totalCount: 150,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "Rain of Chaos", count: 60 },
        { cardName: "Her Mask", count: 30 },
        { cardName: "The Doctor", count: 1 },
      ]);

      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "Rain of Chaos", count: 90 },
        { cardName: "Her Mask", count: 40 },
        { cardName: "House of Mirrors", count: 1 },
      ]);

      // Compare sessions
      const comparison = await repository.compareSessions(
        "session-001",
        "session-002",
      );
      expect(comparison.length).toBeGreaterThan(0);

      // Rain of Chaos should show an increase
      const rain = comparison.find((c) => c.cardName === "Rain of Chaos");
      expect(rain).toBeDefined();
      expect(rain!.difference).toBe(30);

      // The Doctor should show a decrease (only in session 1)
      const doctor = comparison.find((c) => c.cardName === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.session2Count).toBe(0);

      // House of Mirrors should be new in session 2
      const mirrors = comparison.find((c) => c.cardName === "House of Mirrors");
      expect(mirrors).toBeDefined();
      expect(mirrors!.session1Count).toBe(0);
      expect(mirrors!.session2Count).toBe(1);

      // Count sessions
      const sessionCount = await repository.getLeagueSessionCount(
        "poe1",
        "Settlers",
      );
      expect(sessionCount).toBe(2);
    });

    it("should correctly isolate data between poe1 and poe2", async () => {
      // Seed poe1 data
      const poe1League = await seedLeague(testDb.kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 500,
        },
      ]);

      await seedSession(testDb.kysely, {
        id: "session-poe1",
        game: "poe1",
        leagueId: poe1League,
        isActive: false,
      });

      await seedSnapshot(testDb.kysely, {
        id: "snap-poe1",
        leagueId: poe1League,
        fetchedAt: "2025-01-15T12:00:00Z",
        cardPrices: [
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 1,
            divineValue: 0.005,
          },
        ],
      });

      // Seed poe2 data
      const poe2League = await seedLeague(testDb.kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedCards(testDb.kysely, [
        { game: "poe2", scope: "Dawn", cardName: "Some PoE2 Card", count: 300 },
      ]);

      await seedSession(testDb.kysely, {
        id: "session-poe2",
        game: "poe2",
        leagueId: poe2League,
        isActive: false,
      });

      // Verify poe1 queries don't include poe2 data
      const poe1Stats = await repository.getLeagueStats("poe1", "Settlers");
      expect(poe1Stats!.totalCards).toBe(500);
      expect(poe1Stats!.uniqueCards).toBe(1);

      const poe1SessionCount = await repository.getLeagueSessionCount(
        "poe1",
        "Settlers",
      );
      expect(poe1SessionCount).toBe(1);

      const poe1HighestValue = await repository.getHighestValueCards(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );
      expect(poe1HighestValue).toHaveLength(1);
      expect(poe1HighestValue[0].cardName).toBe("Rain of Chaos");

      // Verify poe2 queries don't include poe1 data
      const poe2Stats = await repository.getLeagueStats("poe2", "Dawn");
      expect(poe2Stats!.totalCards).toBe(300);
      expect(poe2Stats!.uniqueCards).toBe(1);

      const poe2SessionCount = await repository.getLeagueSessionCount(
        "poe2",
        "Dawn",
      );
      expect(poe2SessionCount).toBe(1);
    });
  });
});
