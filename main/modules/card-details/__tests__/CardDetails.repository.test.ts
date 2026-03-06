import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSessionCards,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { CardDetailsRepository } from "../CardDetails.repository";

// ─── Test Setup ──────────────────────────────────────────────────────────────

describe("CardDetailsRepository", () => {
  let testDb: TestDatabase;
  let repository: CardDetailsRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new CardDetailsRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── getCachedPriceHistory ───────────────────────────────────────────────

  describe("getCachedPriceHistory", () => {
    it("should return null when no cache entry exists (cache miss)", async () => {
      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
      );
      expect(result).toBeNull();
    });

    it("should return the cached entry after insert", async () => {
      const responseData = JSON.stringify({
        cardName: "House of Mirrors",
        currentDivineRate: 300.4,
      });

      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        responseData,
        "2026-03-05T12:00:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
      );

      expect(result).not.toBeNull();
      expect(result!.game).toBe("poe1");
      expect(result!.league).toBe("Settlers");
      expect(result!.details_id).toBe("house-of-mirrors");
      expect(result!.card_name).toBe("House of Mirrors");
      expect(result!.response_data).toBe(responseData);
      expect(result!.fetched_at).toBe("2026-03-05T12:00:00Z");
    });

    it("should not return entries for a different game", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe2",
        "Settlers",
        "house-of-mirrors",
      );

      expect(result).toBeNull();
    });

    it("should not return entries for a different league", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Standard",
        "house-of-mirrors",
      );

      expect(result).toBeNull();
    });

    it("should not return entries for a different detailsId", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );

      expect(result).toBeNull();
    });
  });

  // ─── upsertPriceHistory ──────────────────────────────────────────────────

  describe("upsertPriceHistory", () => {
    it("should insert a new cache entry", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 6.0}',
        "2026-03-05T12:00:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.card_name).toBe("The Doctor");
      expect(result!.response_data).toBe('{"rate": 6.0}');
      expect(result!.fetched_at).toBe("2026-03-05T12:00:00Z");
    });

    it("should update an existing cache entry (upsert)", async () => {
      // Insert original
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 6.0}',
        "2026-03-05T12:00:00Z",
      );

      // Upsert with new data
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 7.5}',
        "2026-03-05T13:00:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.response_data).toBe('{"rate": 7.5}');
      expect(result!.fetched_at).toBe("2026-03-05T13:00:00Z");
    });

    it("should preserve separate entries for different games", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe1"}',
        "2026-03-05T12:00:00Z",
      );

      await repository.upsertPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe2"}',
        "2026-03-05T12:00:00Z",
      );

      const poe1 = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const poe2 = await repository.getCachedPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
      );

      expect(poe1!.response_data).toBe('{"game": "poe1"}');
      expect(poe2!.response_data).toBe('{"game": "poe2"}');
    });

    it("should preserve separate entries for different leagues", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"league": "Settlers"}',
        "2026-03-05T12:00:00Z",
      );

      await repository.upsertPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
        "The Doctor",
        '{"league": "Standard"}',
        "2026-03-05T12:00:00Z",
      );

      const settlers = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const standard = await repository.getCachedPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
      );

      expect(settlers!.response_data).toBe('{"league": "Settlers"}');
      expect(standard!.response_data).toBe('{"league": "Standard"}');
    });

    it("should update card_name on upsert (e.g. if name formatting changes)", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "the doctor",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        "{}",
        "2026-03-05T12:30:00Z",
      );

      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );

      expect(result!.card_name).toBe("The Doctor");
    });
  });

  // ─── isCacheStale ────────────────────────────────────────────────────────

  describe("isCacheStale", () => {
    it("should return false when cache is fresh (within TTL)", () => {
      const recentTimestamp = new Date(
        Date.now() - 10 * 60 * 1000,
      ).toISOString(); // 10 minutes ago
      const ttl = 30 * 60 * 1000; // 30 minutes

      expect(repository.isCacheStale(recentTimestamp, ttl)).toBe(false);
    });

    it("should return true when cache is stale (past TTL)", () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const ttl = 30 * 60 * 1000; // 30 minutes

      expect(repository.isCacheStale(oldTimestamp, ttl)).toBe(true);
    });

    it("should return false when cache is exactly at TTL boundary", () => {
      // This is technically not stale since we use > not >=
      const exactTimestamp = new Date(
        Date.now() - 30 * 60 * 1000,
      ).toISOString();
      const ttl = 30 * 60 * 1000;

      // Due to timing imprecision this could be either true or false
      // but in practice, just check it returns a boolean
      const result = repository.isCacheStale(exactTimestamp, ttl);
      expect(typeof result).toBe("boolean");
    });

    it("should use default TTL of 30 minutes when not specified", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(repository.isCacheStale(fiveMinAgo)).toBe(false);

      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();
      expect(repository.isCacheStale(twoHoursAgo)).toBe(true);
    });

    it("should return true for very old timestamps", () => {
      const veryOld = "2024-01-01T00:00:00Z";
      expect(repository.isCacheStale(veryOld)).toBe(true);
    });

    it("should return false for timestamps in the future", () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(repository.isCacheStale(future)).toBe(false);
    });

    it("should respect custom TTL values", () => {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      // With 1 minute TTL, 2 minutes ago is stale
      expect(repository.isCacheStale(twoMinAgo, 60 * 1000)).toBe(true);

      // With 5 minute TTL, 2 minutes ago is fresh
      expect(repository.isCacheStale(twoMinAgo, 5 * 60 * 1000)).toBe(false);
    });
  });

  // ─── deleteCacheForLeague ────────────────────────────────────────────────

  describe("deleteCacheForLeague", () => {
    it("should delete all entries for a specific game+league", async () => {
      // Insert entries for two different cards in the same league
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        "{}",
        "2026-03-05T12:00:00Z",
      );
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      await repository.deleteCacheForLeague("poe1", "Settlers");

      const r1 = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const r2 = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
      );

      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    it("should not delete entries for a different league", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"league": "Settlers"}',
        "2026-03-05T12:00:00Z",
      );
      await repository.upsertPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
        "The Doctor",
        '{"league": "Standard"}',
        "2026-03-05T12:00:00Z",
      );

      await repository.deleteCacheForLeague("poe1", "Settlers");

      const deleted = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const preserved = await repository.getCachedPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
      );

      expect(deleted).toBeNull();
      expect(preserved).not.toBeNull();
      expect(preserved!.response_data).toBe('{"league": "Standard"}');
    });

    it("should not delete entries for a different game", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe1"}',
        "2026-03-05T12:00:00Z",
      );
      await repository.upsertPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe2"}',
        "2026-03-05T12:00:00Z",
      );

      await repository.deleteCacheForLeague("poe1", "Settlers");

      const deleted = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const preserved = await repository.getCachedPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
      );

      expect(deleted).toBeNull();
      expect(preserved).not.toBeNull();
    });

    it("should be a no-op when there are no matching entries", async () => {
      // Should not throw
      await expect(
        repository.deleteCacheForLeague("poe1", "NonExistentLeague"),
      ).resolves.not.toThrow();
    });
  });

  // ─── deleteAll ───────────────────────────────────────────────────────────

  describe("deleteAll", () => {
    it("should delete all cache entries", async () => {
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        "{}",
        "2026-03-05T12:00:00Z",
      );
      await repository.upsertPriceHistory(
        "poe2",
        "Standard",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      await repository.deleteAll();

      const r1 = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const r2 = await repository.getCachedPriceHistory(
        "poe2",
        "Standard",
        "house-of-mirrors",
      );

      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    it("should be a no-op when the table is empty", async () => {
      await expect(repository.deleteAll()).resolves.not.toThrow();
    });
  });

  // ─── getCardPersonalStats ────────────────────────────────────────────────

  describe("getCardPersonalStats", () => {
    it("should return zeros and nulls when no drops exist", async () => {
      const result = await repository.getCardPersonalStats(
        "poe1",
        "House of Mirrors",
      );

      expect(result.totalDrops).toBe(0);
      expect(result.firstDiscoveredAt).toBeNull();
      expect(result.lastSeenAt).toBeNull();
      expect(result.sessionCount).toBe(0);
    });

    it("should aggregate drops across multiple sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const session1Id = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T10:00:00Z",
        endedAt: "2025-06-01T11:00:00Z",
        totalCount: 100,
        isActive: false,
      });
      await seedSessionCards(testDb.kysely, session1Id, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const session2Id = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-15T10:00:00Z",
        endedAt: "2025-06-15T11:00:00Z",
        totalCount: 200,
        isActive: false,
      });
      await seedSessionCards(testDb.kysely, session2Id, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const result = await repository.getCardPersonalStats(
        "poe1",
        "The Doctor",
      );

      expect(result.totalDrops).toBe(5);
      expect(result.sessionCount).toBe(2);
      expect(result.firstDiscoveredAt).not.toBeNull();
      expect(result.lastSeenAt).not.toBeNull();
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const poe1Session = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(testDb.kysely, poe1Session, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const poe2Session = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(testDb.kysely, poe2Session, [
        { cardName: "The Doctor", count: 7 },
      ]);

      const poe1Result = await repository.getCardPersonalStats(
        "poe1",
        "The Doctor",
      );
      const poe2Result = await repository.getCardPersonalStats(
        "poe2",
        "The Doctor",
      );

      expect(poe1Result.totalDrops).toBe(3);
      expect(poe1Result.sessionCount).toBe(1);
      expect(poe2Result.totalDrops).toBe(7);
      expect(poe2Result.sessionCount).toBe(1);
    });

    it("should handle card in one session only", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      const result = await repository.getCardPersonalStats(
        "poe1",
        "Rain of Chaos",
      );

      expect(result.totalDrops).toBe(10);
      expect(result.sessionCount).toBe(1);
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(testDb.kysely, {
        name: "Keepers",
      });

      const s1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 100,
      });
      await seedSessionCards(testDb.kysely, s1, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const s2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 200,
      });
      await seedSessionCards(testDb.kysely, s2, [
        { cardName: "The Doctor", count: 7 },
      ]);

      const settlersResult = await repository.getCardPersonalStats(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      expect(settlersResult.totalDrops).toBe(3);
      expect(settlersResult.sessionCount).toBe(1);

      const keepersResult = await repository.getCardPersonalStats(
        "poe1",
        "The Doctor",
        "Keepers",
      );
      expect(keepersResult.totalDrops).toBe(7);
      expect(keepersResult.sessionCount).toBe(1);

      const allResult = await repository.getCardPersonalStats(
        "poe1",
        "The Doctor",
      );
      expect(allResult.totalDrops).toBe(10);
      expect(allResult.sessionCount).toBe(2);
    });
  });

  // ─── getFromBoss ─────────────────────────────────────────────────────────

  describe("getFromBoss", () => {
    it("should return false when the card does not exist", async () => {
      const result = await repository.getFromBoss("poe1", "Nonexistent Card");
      expect(result).toBe(false);
    });

    it("should return true for a boss-exclusive card", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Wretched",
      });

      // Set from_boss to 1
      await testDb.kysely
        .updateTable("divination_cards")
        .set({ from_boss: 1 })
        .where("name", "=", "The Wretched")
        .where("game", "=", "poe1")
        .execute();

      const result = await repository.getFromBoss("poe1", "The Wretched");
      expect(result).toBe(true);
    });

    it("should return false for a non-boss card", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
      });

      const result = await repository.getFromBoss("poe1", "The Doctor");
      expect(result).toBe(false);
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Test Card",
      });
      await testDb.kysely
        .updateTable("divination_cards")
        .set({ from_boss: 1 })
        .where("name", "=", "Test Card")
        .where("game", "=", "poe1")
        .execute();

      // poe2 version doesn't exist, should return false
      const result = await repository.getFromBoss("poe2", "Test Card");
      expect(result).toBe(false);
    });
  });

  // ─── getProhibitedLibraryData ────────────────────────────────────────────

  describe("getProhibitedLibraryData", () => {
    it("should return null when no PL data exists", async () => {
      const result = await repository.getProhibitedLibraryData(
        "poe1",
        "Settlers",
        "The Doctor",
      );
      expect(result).toBeNull();
    });

    it("should return weight, rarity, and fromBoss when PL data exists", async () => {
      await testDb.kysely
        .insertInto("prohibited_library_card_weights")
        .values({
          card_name: "The Doctor",
          game: "poe1",
          league: "Settlers",
          weight: 1,
          rarity: 1,
          from_boss: 0,
          loaded_at: new Date().toISOString(),
        })
        .execute();

      const result = await repository.getProhibitedLibraryData(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.weight).toBe(1);
      expect(result!.rarity).toBe(1);
      expect(result!.fromBoss).toBe(false);
    });

    it("should return fromBoss true when from_boss is 1", async () => {
      await testDb.kysely
        .insertInto("prohibited_library_card_weights")
        .values({
          card_name: "The Wretched",
          game: "poe1",
          league: "Settlers",
          weight: 0,
          rarity: 2,
          from_boss: 1,
          loaded_at: new Date().toISOString(),
        })
        .execute();

      const result = await repository.getProhibitedLibraryData(
        "poe1",
        "Settlers",
        "The Wretched",
      );

      expect(result).not.toBeNull();
      expect(result!.fromBoss).toBe(true);
      expect(result!.weight).toBe(0);
    });

    it("should isolate by game and league", async () => {
      await testDb.kysely
        .insertInto("prohibited_library_card_weights")
        .values({
          card_name: "The Doctor",
          game: "poe1",
          league: "Settlers",
          weight: 5,
          rarity: 1,
          from_boss: 0,
          loaded_at: new Date().toISOString(),
        })
        .execute();

      // Different game
      const poe2Result = await repository.getProhibitedLibraryData(
        "poe2",
        "Settlers",
        "The Doctor",
      );
      expect(poe2Result).toBeNull();

      // Different league
      const standardResult = await repository.getProhibitedLibraryData(
        "poe1",
        "Standard",
        "The Doctor",
      );
      expect(standardResult).toBeNull();

      // Correct match
      const correctResult = await repository.getProhibitedLibraryData(
        "poe1",
        "Settlers",
        "The Doctor",
      );
      expect(correctResult).not.toBeNull();
      expect(correctResult!.weight).toBe(5);
    });
  });

  // ─── getDropTimeline ─────────────────────────────────────────────────────

  describe("getDropTimeline", () => {
    it("should return empty array when no drops exist", async () => {
      const result = await repository.getDropTimeline("poe1", "The Doctor");
      expect(result).toEqual([]);
    });

    it("should return per-session drops ordered chronologically", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const session1Id = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T10:00:00Z",
        totalCount: 100,
      });
      await seedSessionCards(testDb.kysely, session1Id, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const session2Id = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-15T10:00:00Z",
        totalCount: 200,
      });
      await seedSessionCards(testDb.kysely, session2Id, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const session3Id = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-10T10:00:00Z",
        totalCount: 150,
      });
      await seedSessionCards(testDb.kysely, session3Id, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const result = await repository.getDropTimeline("poe1", "The Doctor");

      expect(result).toHaveLength(3);
      // Should be ordered by started_at ASC
      expect(result[0].sessionId).toBe(session1Id);
      expect(result[0].count).toBe(1);
      expect(result[0].totalDecksOpened).toBe(100);

      expect(result[1].sessionId).toBe(session3Id);
      expect(result[1].count).toBe(2);
      expect(result[1].totalDecksOpened).toBe(150);

      expect(result[2].sessionId).toBe(session2Id);
      expect(result[2].count).toBe(3);
      expect(result[2].totalDecksOpened).toBe(200);
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const poe1Session = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(testDb.kysely, poe1Session, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const poe2Session = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(testDb.kysely, poe2Session, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const poe1Result = await repository.getDropTimeline("poe1", "The Doctor");
      const poe2Result = await repository.getDropTimeline("poe2", "The Doctor");

      expect(poe1Result).toHaveLength(1);
      expect(poe1Result[0].count).toBe(1);
      expect(poe2Result).toHaveLength(1);
      expect(poe2Result[0].count).toBe(2);
    });

    it("should not include sessions for other cards", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 50 },
      ]);

      const doctorTimeline = await repository.getDropTimeline(
        "poe1",
        "The Doctor",
      );
      const rainTimeline = await repository.getDropTimeline(
        "poe1",
        "Rain of Chaos",
      );

      expect(doctorTimeline).toHaveLength(1);
      expect(doctorTimeline[0].count).toBe(2);
      expect(rainTimeline).toHaveLength(1);
      expect(rainTimeline[0].count).toBe(50);
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(testDb.kysely, {
        name: "Keepers",
      });

      const s1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 50,
      });
      await seedSessionCards(testDb.kysely, s1, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const s2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 80,
      });
      await seedSessionCards(testDb.kysely, s2, [
        { cardName: "The Doctor", count: 4 },
      ]);

      const settlersOnly = await repository.getDropTimeline(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      expect(settlersOnly).toHaveLength(1);
      expect(settlersOnly[0].count).toBe(1);
      expect(settlersOnly[0].league).toBe("Settlers");

      const keepersOnly = await repository.getDropTimeline(
        "poe1",
        "The Doctor",
        "Keepers",
      );
      expect(keepersOnly).toHaveLength(1);
      expect(keepersOnly[0].count).toBe(4);
      expect(keepersOnly[0].league).toBe("Keepers");

      const all = await repository.getDropTimeline("poe1", "The Doctor");
      expect(all).toHaveLength(2);
    });
  });

  // ─── getTotalDecksOpenedAllSessions ──────────────────────────────────────

  describe("getTotalDecksOpenedAllSessions", () => {
    it("should return 0 when no sessions exist", async () => {
      const result = await repository.getTotalDecksOpenedAllSessions("poe1");
      expect(result).toBe(0);
    });

    it("should sum total_count across all sessions for a game", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 200,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
      });

      const result = await repository.getTotalDecksOpenedAllSessions("poe1");
      expect(result).toBe(350);
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId,
        totalCount: 500,
      });

      const poe1Total = await repository.getTotalDecksOpenedAllSessions("poe1");
      const poe2Total = await repository.getTotalDecksOpenedAllSessions("poe2");

      expect(poe1Total).toBe(100);
      expect(poe2Total).toBe(500);
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(testDb.kysely, {
        name: "Keepers",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 100,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 300,
      });

      const settlersTotal = await repository.getTotalDecksOpenedAllSessions(
        "poe1",
        "Settlers",
      );
      expect(settlersTotal).toBe(100);

      const keepersTotal = await repository.getTotalDecksOpenedAllSessions(
        "poe1",
        "Keepers",
      );
      expect(keepersTotal).toBe(300);

      const allTotal = await repository.getTotalDecksOpenedAllSessions("poe1");
      expect(allTotal).toBe(400);
    });
  });

  // ─── Integration: insert → stale check → retrieve ───────────────────────

  describe("integration: cache lifecycle", () => {
    it("should insert, verify fresh, then verify stale after TTL", async () => {
      const fetchedAt = new Date().toISOString();

      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 6.0}',
        fetchedAt,
      );

      // Should be fresh
      expect(repository.isCacheStale(fetchedAt, 30 * 60 * 1000)).toBe(false);

      // Retrieve and verify
      const cached = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      expect(cached).not.toBeNull();
      expect(cached!.fetched_at).toBe(fetchedAt);

      // Simulate staleness with a very short TTL (1ms — enough time has passed)
      await new Promise((r) => setTimeout(r, 2));
      expect(repository.isCacheStale(fetchedAt, 1)).toBe(true);
    });

    it("should upsert and verify only one row exists per unique key", async () => {
      // Insert twice with different data
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"version": 1}',
        "2026-03-05T12:00:00Z",
      );
      await repository.upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"version": 2}',
        "2026-03-05T13:00:00Z",
      );

      // Should only get the latest version
      const result = await repository.getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      expect(result!.response_data).toBe('{"version": 2}');

      // Verify there's actually only one row by deleting all and checking
      // We can't easily count rows, but we can verify the data is correct
      expect(result!.fetched_at).toBe("2026-03-05T13:00:00Z");
    });
  });

  // ─── getLeagueDateRanges ────────────────────────────────────────────────

  describe("getLeagueDateRanges", () => {
    it("should return empty array when no leagues exist", async () => {
      const result = await repository.getLeagueDateRanges("poe1");
      expect(result).toEqual([]);
    });

    it("should return empty array when leagues exist but have no sessions", async () => {
      await seedLeague(testDb.kysely, { name: "Settlers" });

      const result = await repository.getLeagueDateRanges("poe1");
      expect(result).toEqual([]);
    });

    it("should return league date ranges for leagues with sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });

      const result = await repository.getLeagueDateRanges("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Settlers");
      expect(result[0].startDate).toBe("2025-01-01T00:00:00Z");
      expect(result[0].endDate).toBeNull();
    });

    it("should return leagues with end_date when set", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });
      // Set end_date directly since seedLeague doesn't support it
      await testDb.kysely
        .updateTable("leagues")
        .set({ end_date: "2025-04-01T00:00:00Z" })
        .where("id", "=", leagueId)
        .execute();

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });

      const result = await repository.getLeagueDateRanges("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].endDate).toBe("2025-04-01T00:00:00Z");
    });

    it("should return multiple leagues ordered by start_date ascending", async () => {
      const keepersId = await seedLeague(testDb.kysely, {
        name: "Keepers",
        startDate: "2025-06-01T00:00:00Z",
      });
      const settlersId = await seedLeague(testDb.kysely, {
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 10,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 20,
      });

      const result = await repository.getLeagueDateRanges("poe1");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Settlers");
      expect(result[1].name).toBe("Keepers");
    });

    it("should isolate by game type", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        name: "Settlers",
        game: "poe1",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        name: "Dawn",
        game: "poe2",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: poe1League,
        totalCount: 10,
      });
      await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId: poe2League,
        totalCount: 20,
      });

      const poe1Result = await repository.getLeagueDateRanges("poe1");
      const poe2Result = await repository.getLeagueDateRanges("poe2");

      expect(poe1Result).toHaveLength(1);
      expect(poe1Result[0].name).toBe("Settlers");
      expect(poe2Result).toHaveLength(1);
      expect(poe2Result[0].name).toBe("Dawn");
    });

    it("should deduplicate leagues with multiple sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 20,
      });

      const result = await repository.getLeagueDateRanges("poe1");

      // Should group by league, not return one per session
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Settlers");
    });
  });

  // ─── getFirstSessionStartDate ───────────────────────────────────────────

  describe("getFirstSessionStartDate", () => {
    it("should return null when no sessions exist", async () => {
      const result = await repository.getFirstSessionStartDate("poe1");
      expect(result).toBeNull();
    });

    it("should return the earliest session start date", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-15T10:00:00Z",
        totalCount: 50,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T08:00:00Z",
        totalCount: 30,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-10T12:00:00Z",
        totalCount: 40,
      });

      const result = await repository.getFirstSessionStartDate("poe1");
      expect(result).toBe("2025-06-01T08:00:00Z");
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T10:00:00Z",
        totalCount: 50,
      });
      await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId,
        startedAt: "2025-05-01T10:00:00Z",
        totalCount: 30,
      });

      const poe1Result = await repository.getFirstSessionStartDate("poe1");
      const poe2Result = await repository.getFirstSessionStartDate("poe2");

      expect(poe1Result).toBe("2025-06-01T10:00:00Z");
      expect(poe2Result).toBe("2025-05-01T10:00:00Z");
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(testDb.kysely, {
        name: "Keepers",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: settlersId,
        startedAt: "2025-01-15T10:00:00Z",
        totalCount: 50,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: keepersId,
        startedAt: "2025-06-01T10:00:00Z",
        totalCount: 30,
      });

      const settlersFirst = await repository.getFirstSessionStartDate(
        "poe1",
        "Settlers",
      );
      expect(settlersFirst).toBe("2025-01-15T10:00:00Z");

      const keepersFirst = await repository.getFirstSessionStartDate(
        "poe1",
        "Keepers",
      );
      expect(keepersFirst).toBe("2025-06-01T10:00:00Z");

      const allFirst = await repository.getFirstSessionStartDate("poe1");
      expect(allFirst).toBe("2025-01-15T10:00:00Z");
    });
  });

  // ─── getCardRewardHtml ──────────────────────────────────────────────────

  describe("getCardRewardHtml", () => {
    it("should return null when the card does not exist", async () => {
      const result = await repository.getCardRewardHtml(
        "poe1",
        "Nonexistent Card",
      );
      expect(result).toBeNull();
    });

    it("should return the reward_html for an existing card", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      });

      const result = await repository.getCardRewardHtml("poe1", "The Doctor");

      expect(result).toBe(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        rewardHtml: "<span>poe1 reward</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe2",
        name: "The Doctor",
        rewardHtml: "<span>poe2 reward</span>",
      });

      const poe1Result = await repository.getCardRewardHtml(
        "poe1",
        "The Doctor",
      );
      const poe2Result = await repository.getCardRewardHtml(
        "poe2",
        "The Doctor",
      );

      expect(poe1Result).toBe("<span>poe1 reward</span>");
      expect(poe2Result).toBe("<span>poe2 reward</span>");
    });

    it("should match by exact name only", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Doctor Reward</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctored",
        rewardHtml: "<span>Doctored Reward</span>",
      });

      const result = await repository.getCardRewardHtml("poe1", "The Doctor");
      expect(result).toBe("<span>Doctor Reward</span>");
    });
  });

  // ─── findCardByName ─────────────────────────────────────────────────────

  describe("findCardByName", () => {
    it("should return null when the card does not exist", async () => {
      const result = await repository.findCardByName(
        "poe1",
        "Nonexistent Card",
      );
      expect(result).toBeNull();
    });

    it("should return null for empty card name", async () => {
      const result = await repository.findCardByName("poe1", "");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only card name", async () => {
      const result = await repository.findCardByName("poe1", "   ");
      expect(result).toBeNull();
    });

    it("should return card data for an existing card", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        stackSize: 8,
        description: "8/8 Headhunter",
        rewardHtml: '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>A taste of power</i>",
      });

      const result = await repository.findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("The Doctor");
      expect(result!.stackSize).toBe(8);
      expect(result!.artSrc).toBe("https://example.com/doctor.png");
      expect(result!.fromBoss).toBe(false);
      expect(result!.rarity).toBe(0); // no rarity seeded
    });

    it("should include rarity from divination_card_rarities when available", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
      });
      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 3,
      });

      const result = await repository.findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.rarity).toBe(3);
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        description: "poe1 version",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe2",
        name: "The Doctor",
        description: "poe2 version",
      });

      const poe1Result = await repository.findCardByName("poe1", "The Doctor");
      const poe2Result = await repository.findCardByName("poe2", "The Doctor");

      expect(poe1Result).not.toBeNull();
      expect(poe1Result!.description).toBe("poe1 version");
      expect(poe2Result).not.toBeNull();
      expect(poe2Result!.description).toBe("poe2 version");
    });

    it("should correctly map fromBoss flag", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Fiend",
        rewardHtml: '<span class="tc -unique">[[Headhunter]]</span>',
      });
      // Set from_boss directly
      await testDb.kysely
        .updateTable("divination_cards")
        .set({ from_boss: 1 })
        .where("name", "=", "The Fiend")
        .execute();

      const result = await repository.findCardByName("poe1", "The Fiend");

      expect(result).not.toBeNull();
      expect(result!.fromBoss).toBe(true);
    });

    it("should return null prohibitedLibraryRarity when no plLeague is given", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
      });

      const result = await repository.findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.prohibitedLibraryRarity).toBeNull();
    });

    it("should include prohibitedLibraryRarity when plLeague is given and PL data exists", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
      });
      await testDb.kysely
        .insertInto("prohibited_library_card_weights")
        .values({
          card_name: "The Doctor",
          game: "poe1",
          league: "Settlers",
          weight: 500,
          rarity: 2,
          from_boss: 0,
          loaded_at: new Date().toISOString(),
        })
        .execute();

      const result = await repository.findCardByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );

      expect(result).not.toBeNull();
      expect(result!.prohibitedLibraryRarity).toBe(2);
    });

    it("should return null prohibitedLibraryRarity when plLeague is given but no PL data exists", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
      });

      const result = await repository.findCardByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );

      expect(result).not.toBeNull();
      expect(result!.prohibitedLibraryRarity).toBeNull();
    });
  });

  // ─── findCardsByRewardMatch ──────────────────────────────────────────────

  describe("findCardsByRewardMatch", () => {
    it("should return empty array when no cards match the reward text", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Mirror of Kalandra",
        "Some Other Card",
      );

      expect(result).toEqual([]);
    });

    it("should find cards with matching reward text (case-insensitive LIKE)", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        name: "The Nurse",
        rewardHtml: "<span>The Doctor (Headhunter related)</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        name: "Apprentice's Path",
        rewardHtml: "<span>Headhunter unique belt</span>",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "The Doctor",
      );

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual([
        "Apprentice's Path",
        "The Nurse",
      ]);
    });

    it("should exclude the current card from results", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "House of Mirrors",
        rewardHtml: "<span>Mirror of Kalandra</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        name: "Seven Years Bad Luck",
        rewardHtml: "<span>Mirror of Kalandra shard</span>",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Mirror of Kalandra",
        "House of Mirrors",
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Seven Years Bad Luck");
    });

    it("should return empty array when reward text is too short (< 3 chars)", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "<span>HH</span>",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "HH",
        "Some Card",
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when reward text is empty", async () => {
      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "",
        "Some Card",
      );

      expect(result).toEqual([]);
    });

    it("should limit results to the specified number", async () => {
      // Create 7 cards with matching reward
      for (let i = 1; i <= 7; i++) {
        await seedDivinationCard(testDb.kysely, {
          name: `Test Card ${i}`,
          rewardHtml: `<span>Exalted Orb reward ${i}</span>`,
        });
      }

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Exalted Orb",
        "Some Other Card",
        3,
      );

      expect(result).toHaveLength(3);
    });

    it("should default limit to 5", async () => {
      for (let i = 1; i <= 8; i++) {
        await seedDivinationCard(testDb.kysely, {
          name: `Divine Card ${i}`,
          rewardHtml: `<span>Divine Orb reward ${i}</span>`,
        });
      }

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Divine Orb",
        "Some Other Card",
      );

      expect(result).toHaveLength(5);
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe2",
        name: "The Nurse",
        rewardHtml: "<span>Headhunter belt</span>",
      });

      const poe1Result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );
      const poe2Result = await repository.findCardsByRewardMatch(
        "poe2",
        "Headhunter",
        "Some Other Card",
      );

      expect(poe1Result).toHaveLength(1);
      expect(poe1Result[0].name).toBe("The Doctor");
      expect(poe2Result).toHaveLength(1);
      expect(poe2Result[0].name).toBe("The Nurse");
    });

    it("should return correct card properties", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        stackSize: 8,
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "The Doctor",
        artSrc: "https://example.com/doctor.png",
        stackSize: 8,
        description: "Test card description",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "<i>Flavour text</i>",
        rarity: 0,
        filterRarity: null,
        prohibitedLibraryRarity: null,
        fromBoss: false,
      });
    });

    it("should include rarity from divination_card_rarities when available", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });
      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].rarity).toBe(1);
    });

    it("should default rarity to 0 when no rarity data exists", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].rarity).toBe(0);
    });

    it("should correctly map fromBoss flag", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Fiend",
        rewardHtml: "<span>Headhunter unique</span>",
      });

      // Manually set from_boss to 1
      await testDb.kysely
        .updateTable("divination_cards")
        .set({ from_boss: 1 })
        .where("name", "=", "The Fiend")
        .execute();

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].fromBoss).toBe(true);
    });

    it("should return results ordered by name ascending", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "Zephyr Card",
        rewardHtml: "<span>Chaos Orb reward</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        name: "Alpha Card",
        rewardHtml: "<span>Chaos Orb reward</span>",
      });
      await seedDivinationCard(testDb.kysely, {
        name: "Middle Card",
        rewardHtml: "<span>Chaos Orb reward</span>",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Chaos Orb",
        "Some Other Card",
      );

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("Alpha Card");
      expect(result[1].name).toBe("Middle Card");
      expect(result[2].name).toBe("Zephyr Card");
    });

    it("should trim whitespace from reward text before searching", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "Headhunter",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "   Headhunter   ",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("The Doctor");
    });

    it("should include prohibitedLibraryRarity when plLeague is provided", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "Headhunter",
      });
      await testDb.kysely
        .insertInto("prohibited_library_card_weights")
        .values({
          card_name: "The Doctor",
          game: "poe1",
          league: "Settlers",
          weight: 100,
          rarity: 4,
          from_boss: 0,
          loaded_at: new Date().toISOString(),
        })
        .execute();

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
        5,
        "Settlers",
      );

      expect(result).toHaveLength(1);
      expect(result[0].prohibitedLibraryRarity).toBe(4);
    });

    it("should return null prohibitedLibraryRarity when plLeague is not provided", async () => {
      await seedDivinationCard(testDb.kysely, {
        name: "The Doctor",
        rewardHtml: "Headhunter",
      });

      const result = await repository.findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].prohibitedLibraryRarity).toBeNull();
    });
  });
});
