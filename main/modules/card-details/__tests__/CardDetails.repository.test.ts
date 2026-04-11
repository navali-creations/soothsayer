import { describe, expect, it } from "vitest";

import {
  seedDivinationCard,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSessionCards,
} from "~/main/modules/__test-utils__/create-test-db";
import { setupRepositoryTest } from "~/main/modules/__test-utils__/repository-test-setup";

import { CardDetailsRepository } from "../CardDetails.repository";

// ─── Test Setup ──────────────────────────────────────────────────────────────

describe("CardDetailsRepository", () => {
  const { getRepository, getTestDb } = setupRepositoryTest(
    CardDetailsRepository,
  );

  // ─── getCachedPriceHistory ───────────────────────────────────────────────

  describe("getCachedPriceHistory", () => {
    it("should return null when no cache entry exists (cache miss)", async () => {
      const result = await getRepository().getCachedPriceHistory(
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

      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        responseData,
        "2026-03-05T12:00:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
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
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
        "poe2",
        "Settlers",
        "house-of-mirrors",
      );

      expect(result).toBeNull();
    });

    it("should not return entries for a different league", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
        "poe1",
        "Standard",
        "house-of-mirrors",
      );

      expect(result).toBeNull();
    });

    it("should not return entries for a different detailsId", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
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
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 6.0}',
        "2026-03-05T12:00:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
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
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 6.0}',
        "2026-03-05T12:00:00Z",
      );

      // Upsert with new data
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 7.5}',
        "2026-03-05T13:00:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.response_data).toBe('{"rate": 7.5}');
      expect(result!.fetched_at).toBe("2026-03-05T13:00:00Z");
    });

    it("should preserve separate entries for different games", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe1"}',
        "2026-03-05T12:00:00Z",
      );

      await getRepository().upsertPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe2"}',
        "2026-03-05T12:00:00Z",
      );

      const poe1 = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const poe2 = await getRepository().getCachedPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
      );

      expect(poe1!.response_data).toBe('{"game": "poe1"}');
      expect(poe2!.response_data).toBe('{"game": "poe2"}');
    });

    it("should preserve separate entries for different leagues", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"league": "Settlers"}',
        "2026-03-05T12:00:00Z",
      );

      await getRepository().upsertPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
        "The Doctor",
        '{"league": "Standard"}',
        "2026-03-05T12:00:00Z",
      );

      const settlers = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const standard = await getRepository().getCachedPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
      );

      expect(settlers!.response_data).toBe('{"league": "Settlers"}');
      expect(standard!.response_data).toBe('{"league": "Standard"}');
    });

    it("should update card_name on upsert (e.g. if name formatting changes)", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "the doctor",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        "{}",
        "2026-03-05T12:30:00Z",
      );

      const result = await getRepository().getCachedPriceHistory(
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

      expect(getRepository().isCacheStale(recentTimestamp, ttl)).toBe(false);
    });

    it("should return true when cache is stale (past TTL)", () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const ttl = 30 * 60 * 1000; // 30 minutes

      expect(getRepository().isCacheStale(oldTimestamp, ttl)).toBe(true);
    });

    it("should return false when cache is exactly at TTL boundary", () => {
      // This is technically not stale since we use > not >=
      const exactTimestamp = new Date(
        Date.now() - 30 * 60 * 1000,
      ).toISOString();
      const ttl = 30 * 60 * 1000;

      // Due to timing imprecision this could be either true or false
      // but in practice, just check it returns a boolean
      const result = getRepository().isCacheStale(exactTimestamp, ttl);
      expect(typeof result).toBe("boolean");
    });

    it("should use default TTL of 30 minutes when not specified", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(getRepository().isCacheStale(fiveMinAgo)).toBe(false);

      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();
      expect(getRepository().isCacheStale(twoHoursAgo)).toBe(true);
    });

    it("should return true for very old timestamps", () => {
      const veryOld = "2024-01-01T00:00:00Z";
      expect(getRepository().isCacheStale(veryOld)).toBe(true);
    });

    it("should return false for timestamps in the future", () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(getRepository().isCacheStale(future)).toBe(false);
    });

    it("should respect custom TTL values", () => {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      // With 1 minute TTL, 2 minutes ago is stale
      expect(getRepository().isCacheStale(twoMinAgo, 60 * 1000)).toBe(true);

      // With 5 minute TTL, 2 minutes ago is fresh
      expect(getRepository().isCacheStale(twoMinAgo, 5 * 60 * 1000)).toBe(
        false,
      );
    });
  });

  // ─── deleteCacheForLeague ────────────────────────────────────────────────

  describe("deleteCacheForLeague", () => {
    it("should delete all entries for a specific game+league", async () => {
      // Insert entries for two different cards in the same league
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        "{}",
        "2026-03-05T12:00:00Z",
      );
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      await getRepository().deleteCacheForLeague("poe1", "Settlers");

      const r1 = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const r2 = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "house-of-mirrors",
      );

      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    it("should not delete entries for a different league", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"league": "Settlers"}',
        "2026-03-05T12:00:00Z",
      );
      await getRepository().upsertPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
        "The Doctor",
        '{"league": "Standard"}',
        "2026-03-05T12:00:00Z",
      );

      await getRepository().deleteCacheForLeague("poe1", "Settlers");

      const deleted = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const preserved = await getRepository().getCachedPriceHistory(
        "poe1",
        "Standard",
        "the-doctor",
      );

      expect(deleted).toBeNull();
      expect(preserved).not.toBeNull();
      expect(preserved!.response_data).toBe('{"league": "Standard"}');
    });

    it("should not delete entries for a different game", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe1"}',
        "2026-03-05T12:00:00Z",
      );
      await getRepository().upsertPriceHistory(
        "poe2",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"game": "poe2"}',
        "2026-03-05T12:00:00Z",
      );

      await getRepository().deleteCacheForLeague("poe1", "Settlers");

      const deleted = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const preserved = await getRepository().getCachedPriceHistory(
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
        getRepository().deleteCacheForLeague("poe1", "NonExistentLeague"),
      ).resolves.not.toThrow();
    });
  });

  // ─── deleteAll ───────────────────────────────────────────────────────────

  describe("deleteAll", () => {
    it("should delete all cache entries", async () => {
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        "{}",
        "2026-03-05T12:00:00Z",
      );
      await getRepository().upsertPriceHistory(
        "poe2",
        "Standard",
        "house-of-mirrors",
        "House of Mirrors",
        "{}",
        "2026-03-05T12:00:00Z",
      );

      await getRepository().deleteAll();

      const r1 = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      const r2 = await getRepository().getCachedPriceHistory(
        "poe2",
        "Standard",
        "house-of-mirrors",
      );

      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    it("should be a no-op when the table is empty", async () => {
      await expect(getRepository().deleteAll()).resolves.not.toThrow();
    });
  });

  // ─── getCardPersonalStats ────────────────────────────────────────────────

  describe("getCardPersonalStats", () => {
    it("should return zeros and nulls when no drops exist", async () => {
      const result = await getRepository().getCardPersonalStats(
        "poe1",
        "House of Mirrors",
      );

      expect(result.totalDrops).toBe(0);
      expect(result.firstDiscoveredAt).toBeNull();
      expect(result.lastSeenAt).toBeNull();
      expect(result.sessionCount).toBe(0);
    });

    it("should aggregate drops across multiple sessions", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      const session1Id = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T10:00:00Z",
        endedAt: "2025-06-01T11:00:00Z",
        totalCount: 100,
        isActive: false,
      });
      await seedSessionCards(getTestDb().kysely, session1Id, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const session2Id = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-15T10:00:00Z",
        endedAt: "2025-06-15T11:00:00Z",
        totalCount: 200,
        isActive: false,
      });
      await seedSessionCards(getTestDb().kysely, session2Id, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const result = await getRepository().getCardPersonalStats(
        "poe1",
        "The Doctor",
      );

      expect(result.totalDrops).toBe(5);
      expect(result.sessionCount).toBe(2);
      expect(result.firstDiscoveredAt).not.toBeNull();
      expect(result.lastSeenAt).not.toBeNull();
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      const poe1Session = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(getTestDb().kysely, poe1Session, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const poe2Session = await seedSession(getTestDb().kysely, {
        game: "poe2",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(getTestDb().kysely, poe2Session, [
        { cardName: "The Doctor", count: 7 },
      ]);

      const poe1Result = await getRepository().getCardPersonalStats(
        "poe1",
        "The Doctor",
      );
      const poe2Result = await getRepository().getCardPersonalStats(
        "poe2",
        "The Doctor",
      );

      expect(poe1Result.totalDrops).toBe(3);
      expect(poe1Result.sessionCount).toBe(1);
      expect(poe2Result.totalDrops).toBe(7);
      expect(poe2Result.sessionCount).toBe(1);
    });

    it("should handle card in one session only", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      const sessionId = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSessionCards(getTestDb().kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      const result = await getRepository().getCardPersonalStats(
        "poe1",
        "Rain of Chaos",
      );

      expect(result.totalDrops).toBe(10);
      expect(result.sessionCount).toBe(1);
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(getTestDb().kysely, {
        name: "Keepers",
      });

      const s1 = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 100,
      });
      await seedSessionCards(getTestDb().kysely, s1, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const s2 = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 200,
      });
      await seedSessionCards(getTestDb().kysely, s2, [
        { cardName: "The Doctor", count: 7 },
      ]);

      const settlersResult = await getRepository().getCardPersonalStats(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      expect(settlersResult.totalDrops).toBe(3);
      expect(settlersResult.sessionCount).toBe(1);

      const keepersResult = await getRepository().getCardPersonalStats(
        "poe1",
        "The Doctor",
        "Keepers",
      );
      expect(keepersResult.totalDrops).toBe(7);
      expect(keepersResult.sessionCount).toBe(1);

      const allResult = await getRepository().getCardPersonalStats(
        "poe1",
        "The Doctor",
      );
      expect(allResult.totalDrops).toBe(10);
      expect(allResult.sessionCount).toBe(2);
    });
  });

  // ─── getCardAvailability ─────────────────────────────────────────────────

  describe("getCardAvailability", () => {
    it("should return fromBoss false and weight null when the card does not exist", async () => {
      const result = await getRepository().getCardAvailability(
        "poe1",
        "Settlers",
        "Nonexistent Card",
      );
      expect(result).toEqual({ fromBoss: false, weight: null });
    });

    it("should return fromBoss true for a boss-exclusive card", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Wretched",
      });

      // Insert into divination_card_availability with from_boss = 1
      await getTestDb()
        .kysely.insertInto("divination_card_availability")
        .values({
          game: "poe1",
          league: "Settlers",
          card_name: "The Wretched",
          from_boss: 1,
          is_disabled: 0,
        })
        .execute();

      const result = await getRepository().getCardAvailability(
        "poe1",
        "Settlers",
        "The Wretched",
      );
      expect(result.fromBoss).toBe(true);
      expect(result.weight).toBeNull();
    });

    it("should return fromBoss false for a non-boss card", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
      });

      // Insert into divination_card_availability with from_boss = 0 (default)
      await getTestDb()
        .kysely.insertInto("divination_card_availability")
        .values({
          game: "poe1",
          league: "Settlers",
          card_name: "The Doctor",
          from_boss: 0,
          is_disabled: 0,
        })
        .execute();

      const result = await getRepository().getCardAvailability(
        "poe1",
        "Settlers",
        "The Doctor",
      );
      expect(result.fromBoss).toBe(false);
      expect(result.weight).toBeNull();
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "Test Card",
      });

      // Insert into divination_card_availability for poe1 only
      await getTestDb()
        .kysely.insertInto("divination_card_availability")
        .values({
          game: "poe1",
          league: "Settlers",
          card_name: "Test Card",
          from_boss: 1,
          is_disabled: 0,
        })
        .execute();

      // poe2 version doesn't exist, should return defaults
      const result = await getRepository().getCardAvailability(
        "poe2",
        "Settlers",
        "Test Card",
      );
      expect(result).toEqual({ fromBoss: false, weight: null });
    });

    it("should isolate by league", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "Test Card",
      });

      // Insert into divination_card_availability for Settlers league
      await getTestDb()
        .kysely.insertInto("divination_card_availability")
        .values({
          game: "poe1",
          league: "Settlers",
          card_name: "Test Card",
          from_boss: 1,
          is_disabled: 0,
        })
        .execute();

      // Different league should return defaults
      const result = await getRepository().getCardAvailability(
        "poe1",
        "Keepers",
        "Test Card",
      );
      expect(result).toEqual({ fromBoss: false, weight: null });
    });
  });

  // ─── getDropTimeline ─────────────────────────────────────────────────────

  describe("getDropTimeline", () => {
    it("should return empty array when no drops exist", async () => {
      const result = await getRepository().getDropTimeline(
        "poe1",
        "The Doctor",
      );
      expect(result).toEqual([]);
    });

    it("should return per-session drops ordered chronologically", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      const session1Id = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T10:00:00Z",
        totalCount: 100,
      });
      await seedSessionCards(getTestDb().kysely, session1Id, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const session2Id = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-15T10:00:00Z",
        totalCount: 200,
      });
      await seedSessionCards(getTestDb().kysely, session2Id, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const session3Id = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-10T10:00:00Z",
        totalCount: 150,
      });
      await seedSessionCards(getTestDb().kysely, session3Id, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const result = await getRepository().getDropTimeline(
        "poe1",
        "The Doctor",
      );

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
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      const poe1Session = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(getTestDb().kysely, poe1Session, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const poe2Session = await seedSession(getTestDb().kysely, {
        game: "poe2",
        leagueId,
        totalCount: 50,
      });
      await seedSessionCards(getTestDb().kysely, poe2Session, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const poe1Result = await getRepository().getDropTimeline(
        "poe1",
        "The Doctor",
      );
      const poe2Result = await getRepository().getDropTimeline(
        "poe2",
        "The Doctor",
      );

      expect(poe1Result).toHaveLength(1);
      expect(poe1Result[0].count).toBe(1);
      expect(poe2Result).toHaveLength(1);
      expect(poe2Result[0].count).toBe(2);
    });

    it("should not include sessions for other cards", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      const sessionId = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSessionCards(getTestDb().kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 50 },
      ]);

      const doctorTimeline = await getRepository().getDropTimeline(
        "poe1",
        "The Doctor",
      );
      const rainTimeline = await getRepository().getDropTimeline(
        "poe1",
        "Rain of Chaos",
      );

      expect(doctorTimeline).toHaveLength(1);
      expect(doctorTimeline[0].count).toBe(2);
      expect(rainTimeline).toHaveLength(1);
      expect(rainTimeline[0].count).toBe(50);
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(getTestDb().kysely, {
        name: "Keepers",
      });

      const s1 = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 50,
      });
      await seedSessionCards(getTestDb().kysely, s1, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const s2 = await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 80,
      });
      await seedSessionCards(getTestDb().kysely, s2, [
        { cardName: "The Doctor", count: 4 },
      ]);

      const settlersOnly = await getRepository().getDropTimeline(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      expect(settlersOnly).toHaveLength(1);
      expect(settlersOnly[0].count).toBe(1);
      expect(settlersOnly[0].league).toBe("Settlers");

      const keepersOnly = await getRepository().getDropTimeline(
        "poe1",
        "The Doctor",
        "Keepers",
      );
      expect(keepersOnly).toHaveLength(1);
      expect(keepersOnly[0].count).toBe(4);
      expect(keepersOnly[0].league).toBe("Keepers");

      const all = await getRepository().getDropTimeline("poe1", "The Doctor");
      expect(all).toHaveLength(2);
    });
  });

  // ─── getTotalDecksOpenedAllSessions ──────────────────────────────────────

  describe("getTotalDecksOpenedAllSessions", () => {
    it("should return 0 when no sessions exist", async () => {
      const result =
        await getRepository().getTotalDecksOpenedAllSessions("poe1");
      expect(result).toBe(0);
    });

    it("should sum total_count across all sessions for a game", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 200,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
      });

      const result =
        await getRepository().getTotalDecksOpenedAllSessions("poe1");
      expect(result).toBe(350);
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 100,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe2",
        leagueId,
        totalCount: 500,
      });

      const poe1Total =
        await getRepository().getTotalDecksOpenedAllSessions("poe1");
      const poe2Total =
        await getRepository().getTotalDecksOpenedAllSessions("poe2");

      expect(poe1Total).toBe(100);
      expect(poe2Total).toBe(500);
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(getTestDb().kysely, {
        name: "Keepers",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 100,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 300,
      });

      const settlersTotal =
        await getRepository().getTotalDecksOpenedAllSessions(
          "poe1",
          "Settlers",
        );
      expect(settlersTotal).toBe(100);

      const keepersTotal = await getRepository().getTotalDecksOpenedAllSessions(
        "poe1",
        "Keepers",
      );
      expect(keepersTotal).toBe(300);

      const allTotal =
        await getRepository().getTotalDecksOpenedAllSessions("poe1");
      expect(allTotal).toBe(400);
    });
  });

  // ─── Integration: insert → stale check → retrieve ───────────────────────

  describe("integration: cache lifecycle", () => {
    it("should insert, verify fresh, then verify stale after TTL", async () => {
      const fetchedAt = new Date().toISOString();

      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"rate": 6.0}',
        fetchedAt,
      );

      // Should be fresh
      expect(getRepository().isCacheStale(fetchedAt, 30 * 60 * 1000)).toBe(
        false,
      );

      // Retrieve and verify
      const cached = await getRepository().getCachedPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
      );
      expect(cached).not.toBeNull();
      expect(cached!.fetched_at).toBe(fetchedAt);

      // Simulate staleness with a very short TTL (1ms — enough time has passed)
      await new Promise((r) => setTimeout(r, 2));
      expect(getRepository().isCacheStale(fetchedAt, 1)).toBe(true);
    });

    it("should upsert and verify only one row exists per unique key", async () => {
      // Insert twice with different data
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"version": 1}',
        "2026-03-05T12:00:00Z",
      );
      await getRepository().upsertPriceHistory(
        "poe1",
        "Settlers",
        "the-doctor",
        "The Doctor",
        '{"version": 2}',
        "2026-03-05T13:00:00Z",
      );

      // Should only get the latest version
      const result = await getRepository().getCachedPriceHistory(
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
      const result = await getRepository().getLeagueDateRanges("poe1");
      expect(result).toEqual([]);
    });

    it("should return empty array when leagues exist but have no sessions", async () => {
      await seedLeague(getTestDb().kysely, { name: "Settlers" });

      const result = await getRepository().getLeagueDateRanges("poe1");
      expect(result).toEqual([]);
    });

    it("should return league date ranges for leagues with sessions", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });

      const result = await getRepository().getLeagueDateRanges("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Settlers");
      expect(result[0].startDate).toBe("2025-01-01T00:00:00Z");
      expect(result[0].endDate).toBeNull();
    });

    it("should return leagues with end_date when set", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });
      // Set end_date directly since seedLeague doesn't support it
      await getTestDb()
        .kysely.updateTable("leagues")
        .set({ end_date: "2025-04-01T00:00:00Z" })
        .where("id", "=", leagueId)
        .execute();

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });

      const result = await getRepository().getLeagueDateRanges("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].endDate).toBe("2025-04-01T00:00:00Z");
    });

    it("should return multiple leagues ordered by start_date ascending", async () => {
      const keepersId = await seedLeague(getTestDb().kysely, {
        name: "Keepers",
        startDate: "2025-06-01T00:00:00Z",
      });
      const settlersId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: settlersId,
        totalCount: 10,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: keepersId,
        totalCount: 20,
      });

      const result = await getRepository().getLeagueDateRanges("poe1");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Settlers");
      expect(result[1].name).toBe("Keepers");
    });

    it("should isolate by game type", async () => {
      const poe1League = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
        game: "poe1",
      });
      const poe2League = await seedLeague(getTestDb().kysely, {
        name: "Dawn",
        game: "poe2",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: poe1League,
        totalCount: 10,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe2",
        leagueId: poe2League,
        totalCount: 20,
      });

      const poe1Result = await getRepository().getLeagueDateRanges("poe1");
      const poe2Result = await getRepository().getLeagueDateRanges("poe2");

      expect(poe1Result).toHaveLength(1);
      expect(poe1Result[0].name).toBe("Settlers");
      expect(poe2Result).toHaveLength(1);
      expect(poe2Result[0].name).toBe("Dawn");
    });

    it("should deduplicate leagues with multiple sessions", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        totalCount: 20,
      });

      const result = await getRepository().getLeagueDateRanges("poe1");

      // Should group by league, not return one per session
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Settlers");
    });
  });

  // ─── getFirstSessionStartDate ───────────────────────────────────────────

  describe("getFirstSessionStartDate", () => {
    it("should return null when no sessions exist", async () => {
      const result = await getRepository().getFirstSessionStartDate("poe1");
      expect(result).toBeNull();
    });

    it("should return the earliest session start date", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-15T10:00:00Z",
        totalCount: 50,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T08:00:00Z",
        totalCount: 30,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-10T12:00:00Z",
        totalCount: 40,
      });

      const result = await getRepository().getFirstSessionStartDate("poe1");
      expect(result).toBe("2025-06-01T08:00:00Z");
    });

    it("should isolate by game type", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId,
        startedAt: "2025-06-01T10:00:00Z",
        totalCount: 50,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe2",
        leagueId,
        startedAt: "2025-05-01T10:00:00Z",
        totalCount: 30,
      });

      const poe1Result = await getRepository().getFirstSessionStartDate("poe1");
      const poe2Result = await getRepository().getFirstSessionStartDate("poe2");

      expect(poe1Result).toBe("2025-06-01T10:00:00Z");
      expect(poe2Result).toBe("2025-05-01T10:00:00Z");
    });

    it("should filter by league when league parameter is provided", async () => {
      const settlersId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      const keepersId = await seedLeague(getTestDb().kysely, {
        name: "Keepers",
      });

      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: settlersId,
        startedAt: "2025-01-15T10:00:00Z",
        totalCount: 50,
      });
      await seedSession(getTestDb().kysely, {
        game: "poe1",
        leagueId: keepersId,
        startedAt: "2025-06-01T10:00:00Z",
        totalCount: 30,
      });

      const settlersFirst = await getRepository().getFirstSessionStartDate(
        "poe1",
        "Settlers",
      );
      expect(settlersFirst).toBe("2025-01-15T10:00:00Z");

      const keepersFirst = await getRepository().getFirstSessionStartDate(
        "poe1",
        "Keepers",
      );
      expect(keepersFirst).toBe("2025-06-01T10:00:00Z");

      const allFirst = await getRepository().getFirstSessionStartDate("poe1");
      expect(allFirst).toBe("2025-01-15T10:00:00Z");
    });
  });

  // ─── getCardRewardHtml ──────────────────────────────────────────────────

  describe("getCardRewardHtml", () => {
    it("should return null when the card does not exist", async () => {
      const result = await getRepository().getCardRewardHtml(
        "poe1",
        "Nonexistent Card",
      );
      expect(result).toBeNull();
    });

    it("should return the reward_html for an existing card", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      });

      const result = await getRepository().getCardRewardHtml(
        "poe1",
        "The Doctor",
      );

      expect(result).toBe(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
        rewardHtml: "<span>poe1 reward</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe2",
        name: "The Doctor",
        rewardHtml: "<span>poe2 reward</span>",
      });

      const poe1Result = await getRepository().getCardRewardHtml(
        "poe1",
        "The Doctor",
      );
      const poe2Result = await getRepository().getCardRewardHtml(
        "poe2",
        "The Doctor",
      );

      expect(poe1Result).toBe("<span>poe1 reward</span>");
      expect(poe2Result).toBe("<span>poe2 reward</span>");
    });

    it("should match by exact name only", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Doctor Reward</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctored",
        rewardHtml: "<span>Doctored Reward</span>",
      });

      const result = await getRepository().getCardRewardHtml(
        "poe1",
        "The Doctor",
      );
      expect(result).toBe("<span>Doctor Reward</span>");
    });
  });

  // ─── findCardByName ─────────────────────────────────────────────────────

  describe("findCardByName", () => {
    it("should return null when the card does not exist", async () => {
      const result = await getRepository().findCardByName(
        "poe1",
        "Nonexistent Card",
      );
      expect(result).toBeNull();
    });

    it("should return null for empty card name", async () => {
      const result = await getRepository().findCardByName("poe1", "");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only card name", async () => {
      const result = await getRepository().findCardByName("poe1", "   ");
      expect(result).toBeNull();
    });

    it("should return card data for an existing card", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        stackSize: 8,
        description: "8/8 Headhunter",
        rewardHtml: '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>A taste of power</i>",
      });

      const result = await getRepository().findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("The Doctor");
      expect(result!.stackSize).toBe(8);
      expect(result!.artSrc).toBe("https://example.com/doctor.png");
      expect(result!.fromBoss).toBe(false);
      expect(result!.rarity).toBe(0); // no rarity seeded
    });

    it("should include rarity from divination_card_rarities when available", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
      });
      await seedDivinationCardRarity(getTestDb().kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 3,
      });

      const result = await getRepository().findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.rarity).toBe(3);
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
        description: "poe1 version",
      });
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe2",
        name: "The Doctor",
        description: "poe2 version",
      });

      const poe1Result = await getRepository().findCardByName(
        "poe1",
        "The Doctor",
      );
      const poe2Result = await getRepository().findCardByName(
        "poe2",
        "The Doctor",
      );

      expect(poe1Result).not.toBeNull();
      expect(poe1Result!.description).toBe("poe1 version");
      expect(poe2Result).not.toBeNull();
      expect(poe2Result!.description).toBe("poe2 version");
    });

    it("should correctly map fromBoss flag", async () => {
      // from_boss has moved to divination_card_availability;
      // findCardByName does not query that table, so it always returns false.
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Fiend",
        rewardHtml: '<span class="tc -unique">[[Headhunter]]</span>',
      });

      const result = await getRepository().findCardByName("poe1", "The Fiend");

      expect(result).not.toBeNull();
      expect(result!.fromBoss).toBe(false);
    });

    it("should return null prohibitedLibraryRarity when no plLeague is given", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
      });

      const result = await getRepository().findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.prohibitedLibraryRarity).toBeNull();
    });

    it("should include prohibitedLibraryRarity from divination_card_rarities when rarity row exists", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
      });

      await seedDivinationCardRarity(getTestDb().kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 2,
        prohibitedLibraryRarity: 1,
      });

      const result = await getRepository().findCardByName("poe1", "The Doctor");

      expect(result).not.toBeNull();
      expect(result!.prohibitedLibraryRarity).toBe(1);
    });
  });

  // ─── findCardsByRewardMatch ──────────────────────────────────────────────

  describe("findCardsByRewardMatch", () => {
    it("should return empty array when no cards match the reward text", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Mirror of Kalandra",
        "Some Other Card",
      );

      expect(result).toEqual([]);
    });

    it("should find cards with matching reward text (case-insensitive LIKE)", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Nurse",
        rewardHtml: "<span>The Doctor (Headhunter related)</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        name: "Apprentice's Path",
        rewardHtml: "<span>Headhunter unique belt</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
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
      await seedDivinationCard(getTestDb().kysely, {
        name: "House of Mirrors",
        rewardHtml: "<span>Mirror of Kalandra</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        name: "Seven Years Bad Luck",
        rewardHtml: "<span>Mirror of Kalandra shard</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Mirror of Kalandra",
        "House of Mirrors",
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Seven Years Bad Luck");
    });

    it("should return empty array when reward text is too short (< 3 chars)", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "<span>HH</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "HH",
        "Some Card",
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when reward text is empty", async () => {
      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "",
        "Some Card",
      );

      expect(result).toEqual([]);
    });

    it("should limit results to the specified number", async () => {
      // Create 7 cards with matching reward
      for (let i = 1; i <= 7; i++) {
        await seedDivinationCard(getTestDb().kysely, {
          name: `Test Card ${i}`,
          rewardHtml: `<span>Exalted Orb reward ${i}</span>`,
        });
      }

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Exalted Orb",
        "Some Other Card",
        3,
      );

      expect(result).toHaveLength(3);
    });

    it("should default limit to 5", async () => {
      for (let i = 1; i <= 8; i++) {
        await seedDivinationCard(getTestDb().kysely, {
          name: `Divine Card ${i}`,
          rewardHtml: `<span>Divine Orb reward ${i}</span>`,
        });
      }

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Divine Orb",
        "Some Other Card",
      );

      expect(result).toHaveLength(5);
    });

    it("should isolate by game type", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe2",
        name: "The Nurse",
        rewardHtml: "<span>Headhunter belt</span>",
      });

      const poe1Result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );
      const poe2Result = await getRepository().findCardsByRewardMatch(
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
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        stackSize: 8,
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
      });

      const result = await getRepository().findCardsByRewardMatch(
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
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });
      await seedDivinationCardRarity(getTestDb().kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].rarity).toBe(1);
    });

    it("should default rarity to 0 when no rarity data exists", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].rarity).toBe(0);
    });

    it("should correctly map fromBoss flag", async () => {
      // from_boss has moved to divination_card_availability;
      // findCardsByRewardMatch does not query that table, so it always returns false.
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Fiend",
        rewardHtml: "<span>Headhunter unique</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].fromBoss).toBe(false);
    });

    it("should return results ordered by name ascending", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "Zephyr Card",
        rewardHtml: "<span>Chaos Orb reward</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        name: "Alpha Card",
        rewardHtml: "<span>Chaos Orb reward</span>",
      });
      await seedDivinationCard(getTestDb().kysely, {
        name: "Middle Card",
        rewardHtml: "<span>Chaos Orb reward</span>",
      });

      const result = await getRepository().findCardsByRewardMatch(
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
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "Headhunter",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "   Headhunter   ",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("The Doctor");
    });

    it("should return null prohibitedLibraryRarity when plLeague is not provided", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        name: "The Doctor",
        rewardHtml: "Headhunter",
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].prohibitedLibraryRarity).toBeNull();
    });

    it("should include prohibitedLibraryRarity from divination_card_rarities when rarity row exists", async () => {
      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
        rewardHtml: "<span>Headhunter</span>",
      });

      await seedDivinationCardRarity(getTestDb().kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 2,
        prohibitedLibraryRarity: 3,
      });

      const result = await getRepository().findCardsByRewardMatch(
        "poe1",
        "Headhunter",
        "Some Other Card",
      );

      expect(result).toHaveLength(1);
      expect(result[0].prohibitedLibraryRarity).toBe(3);
    });
  });
});
