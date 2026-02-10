import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedCards,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { DataStoreRepository } from "../DataStore.repository";

describe("DataStoreRepository", () => {
  let testDb: TestDatabase;
  let repository: DataStoreRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new DataStoreRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── Global Stats Operations ─────────────────────────────────────────────

  describe("getGlobalStat", () => {
    it("should return the initialized totalStackedDecksOpened stat", async () => {
      const result = await repository.getGlobalStat("totalStackedDecksOpened");

      expect(result).not.toBeNull();
      expect(result!.key).toBe("totalStackedDecksOpened");
      expect(result!.value).toBe(0);
    });

    it("should return null for a non-existent stat key", async () => {
      const result = await repository.getGlobalStat("nonExistentKey");

      expect(result).toBeNull();
    });
  });

  describe("incrementGlobalStat", () => {
    it("should increment the stat by the given amount", async () => {
      await repository.incrementGlobalStat("totalStackedDecksOpened", 5);

      const result = await repository.getGlobalStat("totalStackedDecksOpened");
      expect(result!.value).toBe(5);
    });

    it("should increment cumulatively across multiple calls", async () => {
      await repository.incrementGlobalStat("totalStackedDecksOpened", 3);
      await repository.incrementGlobalStat("totalStackedDecksOpened", 7);
      await repository.incrementGlobalStat("totalStackedDecksOpened", 1);

      const result = await repository.getGlobalStat("totalStackedDecksOpened");
      expect(result!.value).toBe(11);
    });

    it("should handle incrementing by 1", async () => {
      await repository.incrementGlobalStat("totalStackedDecksOpened", 1);

      const result = await repository.getGlobalStat("totalStackedDecksOpened");
      expect(result!.value).toBe(1);
    });

    it("should handle incrementing by large numbers", async () => {
      await repository.incrementGlobalStat("totalStackedDecksOpened", 100_000);

      const result = await repository.getGlobalStat("totalStackedDecksOpened");
      expect(result!.value).toBe(100_000);
    });
  });

  describe("resetGlobalStat", () => {
    it("should reset the stat value to 0", async () => {
      await repository.incrementGlobalStat("totalStackedDecksOpened", 42);
      await repository.resetGlobalStat("totalStackedDecksOpened");

      const result = await repository.getGlobalStat("totalStackedDecksOpened");
      expect(result!.value).toBe(0);
    });

    it("should not throw when resetting an already-zero stat", async () => {
      await expect(
        repository.resetGlobalStat("totalStackedDecksOpened"),
      ).resolves.not.toThrow();

      const result = await repository.getGlobalStat("totalStackedDecksOpened");
      expect(result!.value).toBe(0);
    });

    it("should only reset the specified key", async () => {
      // Manually insert another stat key for isolation testing
      await testDb.kysely
        .insertInto("global_stats")
        .values({ key: "otherStat", value: 99 })
        .execute();

      await repository.incrementGlobalStat("totalStackedDecksOpened", 50);
      await repository.resetGlobalStat("totalStackedDecksOpened");

      const resetStat = await repository.getGlobalStat(
        "totalStackedDecksOpened",
      );
      expect(resetStat!.value).toBe(0);

      const otherStat = await repository.getGlobalStat("otherStat");
      expect(otherStat!.value).toBe(99);
    });
  });

  // ─── Card Operations ─────────────────────────────────────────────────────

  describe("upsertCard", () => {
    it("should insert a new card with count 1", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("The Doctor");
      expect(cards[0].count).toBe(1);
      expect(cards[0].lastUpdated).toBe("2025-01-15T10:00:00Z");
    });

    it("should increment count on duplicate (game, scope, cardName)", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T11:00:00Z",
      });

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(1);
      expect(cards[0].count).toBe(2);
      expect(cards[0].lastUpdated).toBe("2025-01-15T11:00:00Z");
    });

    it("should increment count correctly across many upserts", async () => {
      const times = 10;
      for (let i = 0; i < times; i++) {
        await repository.upsertCard({
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          timestamp: `2025-01-15T${String(i).padStart(2, "0")}:00:00Z`,
        });
      }

      const cards = await repository.getCardsByScope("poe1", "Settlers");
      expect(cards).toHaveLength(1);
      expect(cards[0].count).toBe(10);
    });

    it("should keep different cards separate within the same scope", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Fiend",
        timestamp: "2025-01-15T10:00:00Z",
      });

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(2);

      const cardNames = cards.map((c) => c.cardName).sort();
      expect(cardNames).toEqual(["The Doctor", "The Fiend"]);
    });

    it("should keep same card separate across different scopes", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      await repository.upsertCard({
        game: "poe1",
        scope: "Settlers",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      const allTime = await repository.getCardsByScope("poe1", "all-time");
      const league = await repository.getCardsByScope("poe1", "Settlers");

      expect(allTime).toHaveLength(1);
      expect(allTime[0].count).toBe(1);
      expect(league).toHaveLength(1);
      expect(league[0].count).toBe(1);
    });

    it("should keep same card separate across different games", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      await repository.upsertCard({
        game: "poe2",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-15T10:00:00Z",
      });

      const poe1Cards = await repository.getCardsByScope("poe1", "all-time");
      const poe2Cards = await repository.getCardsByScope("poe2", "all-time");

      expect(poe1Cards).toHaveLength(1);
      expect(poe2Cards).toHaveLength(1);
    });

    it("should update last_updated timestamp on upsert", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-01-01T00:00:00Z",
      });

      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        timestamp: "2025-06-15T12:00:00Z",
      });

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards[0].lastUpdated).toBe("2025-06-15T12:00:00Z");
    });
  });

  describe("getCardsByScope", () => {
    it("should return empty array when no cards exist for scope", async () => {
      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toEqual([]);
    });

    it("should return only cards matching the game and scope", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 3,
        },
        { game: "poe2", scope: "all-time", cardName: "The Fiend", count: 1 },
      ]);

      const result = await repository.getCardsByScope("poe1", "all-time");

      expect(result).toHaveLength(1);
      expect(result[0].cardName).toBe("The Doctor");
      expect(result[0].count).toBe(5);
    });

    it("should return all cards for a given scope", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 2 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 8,
        },
        { game: "poe1", scope: "Settlers", cardName: "The Fiend", count: 1 },
      ]);

      const result = await repository.getCardsByScope("poe1", "Settlers");

      expect(result).toHaveLength(3);
    });

    it("should return correctly mapped DTOs with camelCase fields", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Emperor's Luck",
          count: 42,
          lastUpdated: "2025-03-20T15:30:00Z",
        },
      ]);

      const result = await repository.getCardsByScope("poe1", "all-time");

      expect(result[0]).toEqual({
        cardName: "Emperor's Luck",
        count: 42,
        lastUpdated: "2025-03-20T15:30:00Z",
      });
    });
  });

  describe("getTotalCountByScope", () => {
    it("should return 0 when no cards exist", async () => {
      const total = await repository.getTotalCountByScope("poe1", "all-time");
      expect(total).toBe(0);
    });

    it("should return sum of all card counts for the scope", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 20,
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Fiend",
          count: 3,
        },
      ]);

      const total = await repository.getTotalCountByScope("poe1", "all-time");
      expect(total).toBe(28);
    });

    it("should not include cards from other scopes", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 100,
        },
      ]);

      const total = await repository.getTotalCountByScope("poe1", "all-time");
      expect(total).toBe(5);
    });

    it("should not include cards from other games", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        { game: "poe2", scope: "all-time", cardName: "The Doctor", count: 99 },
      ]);

      const total = await repository.getTotalCountByScope("poe1", "all-time");
      expect(total).toBe(5);
    });

    it("should handle a single card", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 1 },
      ]);

      const total = await repository.getTotalCountByScope("poe1", "all-time");
      expect(total).toBe(1);
    });
  });

  describe("getLastUpdatedByScope", () => {
    it("should return null when no cards exist", async () => {
      const result = await repository.getLastUpdatedByScope("poe1", "all-time");
      expect(result).toBeNull();
    });

    it("should return the most recent last_updated timestamp", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 1,
          lastUpdated: "2025-01-01T00:00:00Z",
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 1,
          lastUpdated: "2025-06-15T12:00:00Z",
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Fiend",
          count: 1,
          lastUpdated: "2025-03-10T08:00:00Z",
        },
      ]);

      const result = await repository.getLastUpdatedByScope("poe1", "all-time");
      expect(result).toBe("2025-06-15T12:00:00Z");
    });

    it("should not return timestamps from other scopes", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 1,
          lastUpdated: "2025-01-01T00:00:00Z",
        },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 1,
          lastUpdated: "2025-12-31T23:59:59Z",
        },
      ]);

      const result = await repository.getLastUpdatedByScope("poe1", "all-time");
      expect(result).toBe("2025-01-01T00:00:00Z");
    });
  });

  describe("deleteCardsByScope", () => {
    it("should delete all cards for the specified game and scope", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 3,
        },
      ]);

      await repository.deleteCardsByScope("poe1", "all-time");

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(0);
    });

    it("should not delete cards from other scopes", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 3,
        },
      ]);

      await repository.deleteCardsByScope("poe1", "all-time");

      const remainingCards = await repository.getCardsByScope(
        "poe1",
        "Settlers",
      );
      expect(remainingCards).toHaveLength(1);
      expect(remainingCards[0].cardName).toBe("Rain of Chaos");
    });

    it("should not delete cards from other games", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        { game: "poe2", scope: "all-time", cardName: "The Doctor", count: 3 },
      ]);

      await repository.deleteCardsByScope("poe1", "all-time");

      const poe2Cards = await repository.getCardsByScope("poe2", "all-time");
      expect(poe2Cards).toHaveLength(1);
      expect(poe2Cards[0].count).toBe(3);
    });

    it("should not throw when deleting from an empty scope", async () => {
      await expect(
        repository.deleteCardsByScope("poe1", "nonexistent"),
      ).resolves.not.toThrow();
    });
  });

  describe("getAvailableLeagues", () => {
    it("should return empty array when no cards exist", async () => {
      const leagues = await repository.getAvailableLeagues("poe1");
      expect(leagues).toEqual([]);
    });

    it("should return distinct scope values excluding 'all-time'", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 3,
        },
        {
          game: "poe1",
          scope: "Necropolis",
          cardName: "The Fiend",
          count: 1,
        },
      ]);

      const leagues = await repository.getAvailableLeagues("poe1");

      expect(leagues).toHaveLength(2);
      expect(leagues).toContain("Settlers");
      expect(leagues).toContain("Necropolis");
      expect(leagues).not.toContain("all-time");
    });

    it("should return leagues sorted alphabetically", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "Card A", count: 1 },
        { game: "poe1", scope: "Affliction", cardName: "Card B", count: 1 },
        { game: "poe1", scope: "Necropolis", cardName: "Card C", count: 1 },
      ]);

      const leagues = await repository.getAvailableLeagues("poe1");

      expect(leagues).toEqual(["Affliction", "Necropolis", "Settlers"]);
    });

    it("should return unique scopes even when multiple cards share the same scope", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "Card A", count: 1 },
        { game: "poe1", scope: "Settlers", cardName: "Card B", count: 5 },
        { game: "poe1", scope: "Settlers", cardName: "Card C", count: 10 },
      ]);

      const leagues = await repository.getAvailableLeagues("poe1");

      expect(leagues).toHaveLength(1);
      expect(leagues[0]).toBe("Settlers");
    });

    it("should not return leagues from other games", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "Settlers", cardName: "Card A", count: 1 },
        { game: "poe2", scope: "Dawn", cardName: "Card B", count: 1 },
      ]);

      const poe1Leagues = await repository.getAvailableLeagues("poe1");
      const poe2Leagues = await repository.getAvailableLeagues("poe2");

      expect(poe1Leagues).toEqual(["Settlers"]);
      expect(poe2Leagues).toEqual(["Dawn"]);
    });

    it("should return empty array when only all-time scope exists", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
      ]);

      const leagues = await repository.getAvailableLeagues("poe1");
      expect(leagues).toEqual([]);
    });
  });

  // ─── Cascading / Integration Behavior ────────────────────────────────────

  describe("cascading upserts (simulating DataStoreService.addCard flow)", () => {
    it("should support the full cascade: global → all-time → league", async () => {
      const game = "poe1" as const;
      const league = "Settlers";
      const cardName = "The Doctor";
      const timestamp = "2025-06-15T12:00:00Z";

      // 1. Increment global stats
      await repository.incrementGlobalStat("totalStackedDecksOpened", 1);

      // 2. Upsert all-time card
      await repository.upsertCard({
        game,
        scope: "all-time",
        cardName,
        timestamp,
      });

      // 3. Upsert league card
      await repository.upsertCard({
        game,
        scope: league,
        cardName,
        timestamp,
      });

      // Verify global stats
      const globalStat = await repository.getGlobalStat(
        "totalStackedDecksOpened",
      );
      expect(globalStat!.value).toBe(1);

      // Verify all-time
      const allTimeCards = await repository.getCardsByScope(game, "all-time");
      expect(allTimeCards).toHaveLength(1);
      expect(allTimeCards[0].cardName).toBe(cardName);
      expect(allTimeCards[0].count).toBe(1);

      // Verify league
      const leagueCards = await repository.getCardsByScope(game, league);
      expect(leagueCards).toHaveLength(1);
      expect(leagueCards[0].cardName).toBe(cardName);
      expect(leagueCards[0].count).toBe(1);
    });

    it("should maintain correct counts after multiple card additions", async () => {
      const game = "poe1" as const;
      const league = "Settlers";

      // Add 3 "Rain of Chaos" and 2 "The Doctor"
      for (let i = 0; i < 3; i++) {
        await repository.incrementGlobalStat("totalStackedDecksOpened", 1);
        await repository.upsertCard({
          game,
          scope: "all-time",
          cardName: "Rain of Chaos",
          timestamp: `2025-01-01T0${i}:00:00Z`,
        });
        await repository.upsertCard({
          game,
          scope: league,
          cardName: "Rain of Chaos",
          timestamp: `2025-01-01T0${i}:00:00Z`,
        });
      }

      for (let i = 0; i < 2; i++) {
        await repository.incrementGlobalStat("totalStackedDecksOpened", 1);
        await repository.upsertCard({
          game,
          scope: "all-time",
          cardName: "The Doctor",
          timestamp: `2025-01-01T1${i}:00:00Z`,
        });
        await repository.upsertCard({
          game,
          scope: league,
          cardName: "The Doctor",
          timestamp: `2025-01-01T1${i}:00:00Z`,
        });
      }

      // Verify global
      const globalStat = await repository.getGlobalStat(
        "totalStackedDecksOpened",
      );
      expect(globalStat!.value).toBe(5);

      // Verify all-time totals
      const allTimeTotal = await repository.getTotalCountByScope(
        game,
        "all-time",
      );
      expect(allTimeTotal).toBe(5);

      // Verify league totals
      const leagueTotal = await repository.getTotalCountByScope(game, league);
      expect(leagueTotal).toBe(5);

      // Verify individual card counts
      const allTimeCards = await repository.getCardsByScope(game, "all-time");
      const rainOfChaos = allTimeCards.find(
        (c) => c.cardName === "Rain of Chaos",
      );
      const theDoctor = allTimeCards.find((c) => c.cardName === "The Doctor");

      expect(rainOfChaos!.count).toBe(3);
      expect(theDoctor!.count).toBe(2);
    });

    it("should isolate card counts across multiple leagues", async () => {
      const game = "poe1" as const;

      // Add cards to league A
      await repository.upsertCard({
        game,
        scope: "Settlers",
        cardName: "The Doctor",
        timestamp: "2025-01-01T00:00:00Z",
      });
      await repository.upsertCard({
        game,
        scope: "Settlers",
        cardName: "The Doctor",
        timestamp: "2025-01-01T01:00:00Z",
      });

      // Add cards to league B
      await repository.upsertCard({
        game,
        scope: "Necropolis",
        cardName: "The Doctor",
        timestamp: "2025-01-01T00:00:00Z",
      });

      // Add all to all-time
      for (let i = 0; i < 3; i++) {
        await repository.upsertCard({
          game,
          scope: "all-time",
          cardName: "The Doctor",
          timestamp: `2025-01-01T0${i}:00:00Z`,
        });
      }

      expect(await repository.getTotalCountByScope(game, "Settlers")).toBe(2);
      expect(await repository.getTotalCountByScope(game, "Necropolis")).toBe(1);
      expect(await repository.getTotalCountByScope(game, "all-time")).toBe(3);
    });
  });

  // ─── Transaction Behavior ────────────────────────────────────────────────

  describe("transactional operations", () => {
    it("should support using repository within a Kysely transaction", async () => {
      await testDb.kysely.transaction().execute(async (trx) => {
        const txRepo = new DataStoreRepository(trx);

        await txRepo.incrementGlobalStat("totalStackedDecksOpened", 1);
        await txRepo.upsertCard({
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          timestamp: "2025-01-01T00:00:00Z",
        });
        await txRepo.upsertCard({
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          timestamp: "2025-01-01T00:00:00Z",
        });
      });

      const globalStat = await repository.getGlobalStat(
        "totalStackedDecksOpened",
      );
      expect(globalStat!.value).toBe(1);

      const allTimeCards = await repository.getCardsByScope("poe1", "all-time");
      expect(allTimeCards).toHaveLength(1);

      const leagueCards = await repository.getCardsByScope("poe1", "Settlers");
      expect(leagueCards).toHaveLength(1);
    });

    it("should roll back all changes if transaction fails", async () => {
      // Pre-populate some data
      await repository.upsertCard({
        game: "poe1",
        scope: "all-time",
        cardName: "Existing Card",
        timestamp: "2025-01-01T00:00:00Z",
      });

      try {
        await testDb.kysely.transaction().execute(async (trx) => {
          const txRepo = new DataStoreRepository(trx);

          await txRepo.incrementGlobalStat("totalStackedDecksOpened", 100);
          await txRepo.upsertCard({
            game: "poe1",
            scope: "all-time",
            cardName: "Should Not Persist",
            timestamp: "2025-01-01T00:00:00Z",
          });

          throw new Error("Simulated failure");
        });
      } catch {
        // Expected
      }

      // Global stat should still be 0
      const globalStat = await repository.getGlobalStat(
        "totalStackedDecksOpened",
      );
      expect(globalStat!.value).toBe(0);

      // Only the existing card should be present
      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("Existing Card");
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle card names with special characters", async () => {
      const specialNames = [
        "The King's Blade",
        "Emperor's Luck",
        "A Mother's Parting Gift",
        "Luck of the Vaal",
      ];

      for (const name of specialNames) {
        await repository.upsertCard({
          game: "poe1",
          scope: "all-time",
          cardName: name,
          timestamp: "2025-01-01T00:00:00Z",
        });
      }

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(specialNames.length);

      const resultNames = cards.map((c) => c.cardName).sort();
      expect(resultNames).toEqual([...specialNames].sort());
    });

    it("should handle Standard league as a scope", async () => {
      await repository.upsertCard({
        game: "poe1",
        scope: "Standard",
        cardName: "The Doctor",
        timestamp: "2025-01-01T00:00:00Z",
      });

      const leagues = await repository.getAvailableLeagues("poe1");
      expect(leagues).toContain("Standard");
    });

    it("should handle rapid successive upserts to the same card", async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          repository.upsertCard({
            game: "poe1",
            scope: "all-time",
            cardName: "Rain of Chaos",
            timestamp: `2025-01-01T00:00:${String(i).padStart(2, "0")}Z`,
          }),
        );
      }

      // Note: These run sequentially because SQLite is single-writer,
      // but the promises are created concurrently
      await Promise.all(promises);

      const cards = await repository.getCardsByScope("poe1", "all-time");
      expect(cards).toHaveLength(1);
      expect(cards[0].count).toBe(20);
    });

    it("should correctly return total count of 0 for non-existent game", async () => {
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
      ]);

      const total = await repository.getTotalCountByScope("poe2", "all-time");
      expect(total).toBe(0);
    });

    it("should correctly return null for last_updated of non-existent scope", async () => {
      const result = await repository.getLastUpdatedByScope(
        "poe1",
        "nonexistent-league",
      );
      expect(result).toBeNull();
    });
  });
});
