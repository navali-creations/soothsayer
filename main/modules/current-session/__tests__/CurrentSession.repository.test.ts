import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { CurrentSessionRepository } from "../CurrentSession.repository";

describe("CurrentSessionRepository", () => {
  let testDb: TestDatabase;
  let repository: CurrentSessionRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new CurrentSessionRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── Session Operations ──────────────────────────────────────────────────

  describe("createSession", () => {
    it("should create a new session", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      await repository.createSession({
        id: "session-1",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
      });

      const session = await repository.getSessionById("session-1");
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-1");
      expect(session!.game).toBe("poe1");
      expect(session!.leagueId).toBe(leagueId);
      expect(session!.snapshotId).toBe(snapshotId);
      expect(session!.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(session!.totalCount).toBe(0);
      expect(session!.isActive).toBe(true);
      expect(session!.endedAt).toBeNull();
    });

    it("should create a session with is_active = 1 by default", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      await repository.createSession({
        id: "session-active",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
      });

      const session = await repository.getActiveSession("poe1");
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-active");
      expect(session!.isActive).toBe(true);
    });

    it("should create sessions for different games independently", async () => {
      const poe1LeagueId = await seedLeague(testDb.kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
      });
      const poe2LeagueId = await seedLeague(testDb.kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
      });
      const snap1Id = await seedSnapshot(testDb.kysely, {
        leagueId: poe1LeagueId,
      });
      const snap2Id = await seedSnapshot(testDb.kysely, {
        leagueId: poe2LeagueId,
      });

      await repository.createSession({
        id: "session-poe1",
        game: "poe1",
        leagueId: poe1LeagueId,
        snapshotId: snap1Id,
        startedAt: "2025-01-15T10:00:00Z",
      });

      await repository.createSession({
        id: "session-poe2",
        game: "poe2",
        leagueId: poe2LeagueId,
        snapshotId: snap2Id,
        startedAt: "2025-01-15T10:00:00Z",
      });

      const poe1Session = await repository.getActiveSession("poe1");
      const poe2Session = await repository.getActiveSession("poe2");

      expect(poe1Session).not.toBeNull();
      expect(poe1Session!.id).toBe("session-poe1");
      expect(poe2Session).not.toBeNull();
      expect(poe2Session!.id).toBe("session-poe2");
    });
  });

  describe("updateSession", () => {
    it("should update totalCount", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-update",
        leagueId,
      });

      await repository.updateSession("session-update", { totalCount: 42 });

      const session = await repository.getSessionById("session-update");
      expect(session!.totalCount).toBe(42);
    });

    it("should update endedAt", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-end",
        leagueId,
      });

      await repository.updateSession("session-end", {
        endedAt: "2025-01-15T12:00:00Z",
      });

      const session = await repository.getSessionById("session-end");
      expect(session!.endedAt).toBe("2025-01-15T12:00:00Z");
    });

    it("should update isActive", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-deactivate",
        leagueId,
        isActive: true,
      });

      await repository.updateSession("session-deactivate", {
        isActive: false,
      });

      const session = await repository.getSessionById("session-deactivate");
      expect(session!.isActive).toBe(false);
    });

    it("should update multiple fields at once", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-multi",
        leagueId,
        isActive: true,
      });

      await repository.updateSession("session-multi", {
        totalCount: 100,
        endedAt: "2025-01-15T13:00:00Z",
        isActive: false,
      });

      const session = await repository.getSessionById("session-multi");
      expect(session!.totalCount).toBe(100);
      expect(session!.endedAt).toBe("2025-01-15T13:00:00Z");
      expect(session!.isActive).toBe(false);
    });

    it("should not update anything when empty update object is passed", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-noop",
        leagueId,
        totalCount: 5,
        isActive: true,
      });

      await repository.updateSession("session-noop", {});

      const session = await repository.getSessionById("session-noop");
      expect(session!.totalCount).toBe(5);
      expect(session!.isActive).toBe(true);
    });
  });

  describe("getActiveSession", () => {
    it("should return null when no active session exists", async () => {
      const session = await repository.getActiveSession("poe1");
      expect(session).toBeNull();
    });

    it("should return the active session for a given game", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-active",
        game: "poe1",
        leagueId,
        isActive: true,
      });

      const session = await repository.getActiveSession("poe1");
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-active");
      expect(session!.isActive).toBe(true);
    });

    it("should not return inactive sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-inactive",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session = await repository.getActiveSession("poe1");
      expect(session).toBeNull();
    });

    it("should not return active sessions for a different game", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });
      await seedSession(testDb.kysely, {
        id: "session-poe2",
        game: "poe2",
        leagueId,
        isActive: true,
      });

      const session = await repository.getActiveSession("poe1");
      expect(session).toBeNull();
    });
  });

  describe("getSessionById", () => {
    it("should return null for non-existent session", async () => {
      const session = await repository.getSessionById("nonexistent");
      expect(session).toBeNull();
    });

    it("should return the session with correctly mapped fields", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      await seedSession(testDb.kysely, {
        id: "session-by-id",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-06-01T08:00:00Z",
        totalCount: 77,
        isActive: true,
      });

      const session = await repository.getSessionById("session-by-id");

      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-by-id");
      expect(session!.game).toBe("poe1");
      expect(session!.leagueId).toBe(leagueId);
      expect(session!.snapshotId).toBe(snapshotId);
      expect(session!.startedAt).toBe("2025-06-01T08:00:00Z");
      expect(session!.totalCount).toBe(77);
      expect(session!.isActive).toBe(true);
    });
  });

  describe("deactivateAllSessions", () => {
    it("should deactivate all active sessions for a game", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-1",
        game: "poe1",
        leagueId,
        isActive: true,
      });
      await seedSession(testDb.kysely, {
        id: "session-2",
        game: "poe1",
        leagueId,
        isActive: true,
      });

      await repository.deactivateAllSessions("poe1");

      const active = await repository.getActiveSession("poe1");
      expect(active).toBeNull();

      const s1 = await repository.getSessionById("session-1");
      const s2 = await repository.getSessionById("session-2");
      expect(s1!.isActive).toBe(false);
      expect(s2!.isActive).toBe(false);
    });

    it("should not affect sessions of other games", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        id: "league-p1",
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        id: "league-p2",
        game: "poe2",
        name: "Dawn",
      });

      await seedSession(testDb.kysely, {
        id: "session-poe1",
        game: "poe1",
        leagueId: poe1League,
        isActive: true,
      });
      await seedSession(testDb.kysely, {
        id: "session-poe2",
        game: "poe2",
        leagueId: poe2League,
        isActive: true,
      });

      await repository.deactivateAllSessions("poe1");

      const poe1Active = await repository.getActiveSession("poe1");
      const poe2Active = await repository.getActiveSession("poe2");

      expect(poe1Active).toBeNull();
      expect(poe2Active).not.toBeNull();
      expect(poe2Active!.id).toBe("session-poe2");
    });

    it("should not throw when no active sessions exist", async () => {
      await expect(
        repository.deactivateAllSessions("poe1"),
      ).resolves.not.toThrow();
    });

    it("should not affect already-inactive sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-already-inactive",
        game: "poe1",
        leagueId,
        isActive: false,
        endedAt: "2025-01-15T12:00:00Z",
        totalCount: 50,
      });

      await repository.deactivateAllSessions("poe1");

      const session = await repository.getSessionById(
        "session-already-inactive",
      );
      expect(session!.isActive).toBe(false);
      expect(session!.totalCount).toBe(50);
      expect(session!.endedAt).toBe("2025-01-15T12:00:00Z");
    });
  });

  describe("getSessionTotalCount", () => {
    it("should return 0 when session has no cards", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-empty",
        leagueId,
      });

      const total = await repository.getSessionTotalCount("session-empty");
      expect(total).toBe(0);
    });

    it("should return sum of all card counts for the session", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-with-cards",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-with-cards", [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 15 },
        { cardName: "The Fiend", count: 1 },
      ]);

      const total = await repository.getSessionTotalCount("session-with-cards");
      expect(total).toBe(18);
    });

    it("should not include cards from other sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-a",
        leagueId,
      });
      await seedSession(testDb.kysely, {
        id: "session-b",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-a", [
        { cardName: "The Doctor", count: 5 },
      ]);
      await seedSessionCards(testDb.kysely, "session-b", [
        { cardName: "Rain of Chaos", count: 99 },
      ]);

      const totalA = await repository.getSessionTotalCount("session-a");
      const totalB = await repository.getSessionTotalCount("session-b");

      expect(totalA).toBe(5);
      expect(totalB).toBe(99);
    });
  });

  // ─── Session Card Operations ─────────────────────────────────────────────

  describe("upsertSessionCard", () => {
    it("should insert a new session card", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-upsert",
        leagueId,
      });

      await repository.upsertSessionCard({
        sessionId: "session-upsert",
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:05:00Z",
        lastSeenAt: "2025-01-15T10:05:00Z",
      });

      const cards = await repository.getSessionCards("session-upsert");
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("The Doctor");
      expect(cards[0].count).toBe(1);
    });

    it("should update count and lastSeenAt on conflict", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-upsert-dup",
        leagueId,
      });

      await repository.upsertSessionCard({
        sessionId: "session-upsert-dup",
        cardName: "Rain of Chaos",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
      });

      await repository.upsertSessionCard({
        sessionId: "session-upsert-dup",
        cardName: "Rain of Chaos",
        count: 5,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:30:00Z",
      });

      const cards = await repository.getSessionCards("session-upsert-dup");
      expect(cards).toHaveLength(1);
      expect(cards[0].count).toBe(5);
      expect(cards[0].lastSeenAt).toBe("2025-01-15T10:30:00Z");
    });

    it("should set default hide price values to false", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-hide-default",
        leagueId,
      });

      await repository.upsertSessionCard({
        sessionId: "session-hide-default",
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
      });

      const cards = await repository.getSessionCards("session-hide-default");
      expect(cards[0].hidePriceExchange).toBe(false);
      expect(cards[0].hidePriceStash).toBe(false);
    });

    it("should respect hidePriceExchange and hidePriceStash when set", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-hide-set",
        leagueId,
      });

      await repository.upsertSessionCard({
        sessionId: "session-hide-set",
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
        hidePriceExchange: true,
        hidePriceStash: true,
      });

      const cards = await repository.getSessionCards("session-hide-set");
      expect(cards[0].hidePriceExchange).toBe(true);
      expect(cards[0].hidePriceStash).toBe(true);
    });
  });

  describe("incrementCardCount", () => {
    it("should insert a new card with count 1 if it does not exist", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-inc-new",
        leagueId,
      });

      await repository.incrementCardCount(
        "session-inc-new",
        "The Doctor",
        "2025-01-15T10:05:00Z",
      );

      const cards = await repository.getSessionCards("session-inc-new");
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("The Doctor");
      expect(cards[0].count).toBe(1);
    });

    it("should increment count for existing card", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-inc-exist",
        leagueId,
      });

      await repository.incrementCardCount(
        "session-inc-exist",
        "Rain of Chaos",
        "2025-01-15T10:00:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-exist",
        "Rain of Chaos",
        "2025-01-15T10:01:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-exist",
        "Rain of Chaos",
        "2025-01-15T10:02:00Z",
      );

      const cards = await repository.getSessionCards("session-inc-exist");
      expect(cards).toHaveLength(1);
      expect(cards[0].count).toBe(3);
    });

    it("should update last_seen_at on each increment", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-inc-time",
        leagueId,
      });

      await repository.incrementCardCount(
        "session-inc-time",
        "The Doctor",
        "2025-01-15T10:00:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-time",
        "The Doctor",
        "2025-01-15T10:30:00Z",
      );

      const cards = await repository.getSessionCards("session-inc-time");
      expect(cards[0].lastSeenAt).toBe("2025-01-15T10:30:00Z");
    });

    it("should update the session total_count correctly", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-inc-total",
        leagueId,
      });

      await repository.incrementCardCount(
        "session-inc-total",
        "The Doctor",
        "2025-01-15T10:00:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-total",
        "Rain of Chaos",
        "2025-01-15T10:01:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-total",
        "Rain of Chaos",
        "2025-01-15T10:02:00Z",
      );

      const session = await repository.getSessionById("session-inc-total");
      expect(session!.totalCount).toBe(3);
    });

    it("should handle multiple different cards within same session", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-inc-multi",
        leagueId,
      });

      await repository.incrementCardCount(
        "session-inc-multi",
        "The Doctor",
        "2025-01-15T10:00:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-multi",
        "Rain of Chaos",
        "2025-01-15T10:01:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-multi",
        "The Fiend",
        "2025-01-15T10:02:00Z",
      );
      await repository.incrementCardCount(
        "session-inc-multi",
        "The Doctor",
        "2025-01-15T10:03:00Z",
      );

      const cards = await repository.getSessionCards("session-inc-multi");
      expect(cards).toHaveLength(3);

      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");
      const fiend = cards.find((c) => c.cardName === "The Fiend");

      expect(doctor!.count).toBe(2);
      expect(rain!.count).toBe(1);
      expect(fiend!.count).toBe(1);

      const session = await repository.getSessionById("session-inc-multi");
      expect(session!.totalCount).toBe(4);
    });
  });

  describe("getSessionCards", () => {
    it("should return empty array when session has no cards", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-no-cards",
        leagueId,
      });

      const cards = await repository.getSessionCards("session-no-cards");
      expect(cards).toEqual([]);
    });

    it("should return cards with correctly mapped boolean fields", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-bool-cards",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-bool-cards", [
        {
          cardName: "The Doctor",
          count: 1,
          hidePriceExchange: true,
          hidePriceStash: false,
        },
        {
          cardName: "Rain of Chaos",
          count: 5,
          hidePriceExchange: false,
          hidePriceStash: true,
        },
      ]);

      const cards = await repository.getSessionCards("session-bool-cards");
      expect(cards).toHaveLength(2);

      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");

      expect(doctor!.hidePriceExchange).toBe(true);
      expect(doctor!.hidePriceStash).toBe(false);
      expect(rain!.hidePriceExchange).toBe(false);
      expect(rain!.hidePriceStash).toBe(true);
    });

    it("should join divination card metadata when available", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      await seedSession(testDb.kysely, {
        id: "session-join-cards",
        game: "poe1",
        leagueId,
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
        description: "A powerful card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>Flavour</i>",
      });

      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      await seedSessionCards(testDb.kysely, "session-join-cards", [
        { cardName: "The Doctor", count: 1 },
      ]);

      const cards = await repository.getSessionCards("session-join-cards");
      expect(cards).toHaveLength(1);
      expect(cards[0].divinationCard).toBeDefined();
      expect(cards[0].divinationCard!.id).toBe("poe1_the-doctor");
      expect(cards[0].divinationCard!.stackSize).toBe(8);
      expect(cards[0].divinationCard!.rarity).toBe(1);
    });

    it("should default rarity to 4 when no rarity data exists", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      await seedSession(testDb.kysely, {
        id: "session-default-rarity",
        game: "poe1",
        leagueId,
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Rain of Chaos",
        stackSize: 1,
      });

      // No rarity data seeded

      await seedSessionCards(testDb.kysely, "session-default-rarity", [
        { cardName: "Rain of Chaos", count: 3 },
      ]);

      const cards = await repository.getSessionCards("session-default-rarity");
      expect(cards).toHaveLength(1);
      expect(cards[0].divinationCard).toBeDefined();
      expect(cards[0].divinationCard!.rarity).toBe(0);
    });

    it("should handle cards without matching divination card data", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-no-div-data",
        leagueId,
      });

      // No divination card reference data seeded

      await seedSessionCards(testDb.kysely, "session-no-div-data", [
        { cardName: "Unknown Card", count: 2 },
      ]);

      const cards = await repository.getSessionCards("session-no-div-data");
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("Unknown Card");
      expect(cards[0].count).toBe(2);
      // divinationCard should be undefined since there's no matching row
      expect(cards[0].divinationCard).toBeUndefined();
    });
  });

  describe("updateCardPriceVisibility", () => {
    it("should update exchange price visibility", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-vis",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-vis", [
        { cardName: "The Doctor", count: 1 },
      ]);

      await repository.updateCardPriceVisibility(
        "session-vis",
        "The Doctor",
        "exchange",
        true,
      );

      const cards = await repository.getSessionCards("session-vis");
      expect(cards[0].hidePriceExchange).toBe(true);
      expect(cards[0].hidePriceStash).toBe(false);
    });

    it("should update stash price visibility", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-vis-stash",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-vis-stash", [
        { cardName: "The Doctor", count: 1 },
      ]);

      await repository.updateCardPriceVisibility(
        "session-vis-stash",
        "The Doctor",
        "stash",
        true,
      );

      const cards = await repository.getSessionCards("session-vis-stash");
      expect(cards[0].hidePriceExchange).toBe(false);
      expect(cards[0].hidePriceStash).toBe(true);
    });

    it("should toggle visibility back to false", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-vis-toggle",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-vis-toggle", [
        { cardName: "The Doctor", count: 1, hidePriceExchange: true },
      ]);

      await repository.updateCardPriceVisibility(
        "session-vis-toggle",
        "The Doctor",
        "exchange",
        false,
      );

      const cards = await repository.getSessionCards("session-vis-toggle");
      expect(cards[0].hidePriceExchange).toBe(false);
    });

    it("should only affect the specified card", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-vis-targeted",
        leagueId,
      });
      await seedSessionCards(testDb.kysely, "session-vis-targeted", [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      await repository.updateCardPriceVisibility(
        "session-vis-targeted",
        "The Doctor",
        "exchange",
        true,
      );

      const cards = await repository.getSessionCards("session-vis-targeted");
      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");

      expect(doctor!.hidePriceExchange).toBe(true);
      expect(rain!.hidePriceExchange).toBe(false);
    });
  });

  // ─── Processed IDs Operations ────────────────────────────────────────────

  describe("getProcessedIds", () => {
    it("should return empty array when no processed IDs exist", async () => {
      const result = await repository.getProcessedIds("poe1");
      expect(result).toEqual([]);
    });

    it("should return processed IDs for a specific game", async () => {
      await repository.saveProcessedId("poe1", "id-1", "The Doctor");
      await repository.saveProcessedId("poe1", "id-2", "Rain of Chaos");

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.processedId)).toContain("id-1");
      expect(result.map((r) => r.processedId)).toContain("id-2");
    });

    it("should not return processed IDs from other games", async () => {
      await repository.saveProcessedId("poe1", "id-poe1", "The Doctor");
      await repository.saveProcessedId("poe2", "id-poe2", "The Fiend");

      const poe1Ids = await repository.getProcessedIds("poe1");
      const poe2Ids = await repository.getProcessedIds("poe2");

      expect(poe1Ids).toHaveLength(1);
      expect(poe1Ids[0].processedId).toBe("id-poe1");
      expect(poe2Ids).toHaveLength(1);
      expect(poe2Ids[0].processedId).toBe("id-poe2");
    });
  });

  describe("saveProcessedId", () => {
    it("should save a processed ID with card name", async () => {
      await repository.saveProcessedId("poe1", "unique-id-1", "The Doctor");

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(1);
      expect(result[0].processedId).toBe("unique-id-1");
    });

    it("should not throw on duplicate processed ID (skip via ON CONFLICT)", async () => {
      await repository.saveProcessedId("poe1", "dup-id", "The Doctor");
      await expect(
        repository.saveProcessedId("poe1", "dup-id", "The Doctor"),
      ).resolves.not.toThrow();

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(1);
    });

    it("should save multiple processed IDs", async () => {
      await repository.saveProcessedId("poe1", "id-a", "Card A");
      await repository.saveProcessedId("poe1", "id-b", "Card B");
      await repository.saveProcessedId("poe1", "id-c", "Card C");

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(3);
    });
  });

  describe("replaceProcessedIds", () => {
    it("should replace all processed IDs for a game", async () => {
      await repository.saveProcessedId("poe1", "old-1", "Card A");
      await repository.saveProcessedId("poe1", "old-2", "Card B");

      await repository.replaceProcessedIds("poe1", ["new-1", "new-2", "new-3"]);

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(3);

      const ids = result.map((r) => r.processedId);
      expect(ids).toContain("new-1");
      expect(ids).toContain("new-2");
      expect(ids).toContain("new-3");
      expect(ids).not.toContain("old-1");
      expect(ids).not.toContain("old-2");
    });

    it("should handle empty array (clear all)", async () => {
      await repository.saveProcessedId("poe1", "id-1", "Card A");
      await repository.saveProcessedId("poe1", "id-2", "Card B");

      await repository.replaceProcessedIds("poe1", []);

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(0);
    });

    it("should not affect other games", async () => {
      await repository.saveProcessedId("poe1", "p1-id", "Card A");
      await repository.saveProcessedId("poe2", "p2-id", "Card B");

      await repository.replaceProcessedIds("poe1", ["new-id"]);

      const poe1Ids = await repository.getProcessedIds("poe1");
      const poe2Ids = await repository.getProcessedIds("poe2");

      expect(poe1Ids).toHaveLength(1);
      expect(poe1Ids[0].processedId).toBe("new-id");
      expect(poe2Ids).toHaveLength(1);
      expect(poe2Ids[0].processedId).toBe("p2-id");
    });
  });

  describe("clearProcessedIds", () => {
    it("should clear all processed IDs for a game", async () => {
      await repository.saveProcessedId("poe1", "id-1", "Card A");
      await repository.saveProcessedId("poe1", "id-2", "Card B");

      await repository.clearProcessedIds("poe1");

      const result = await repository.getProcessedIds("poe1");
      expect(result).toHaveLength(0);
    });

    it("should not affect other games", async () => {
      await repository.saveProcessedId("poe1", "p1-id", "Card A");
      await repository.saveProcessedId("poe2", "p2-id", "Card B");

      await repository.clearProcessedIds("poe1");

      const poe2Ids = await repository.getProcessedIds("poe2");
      expect(poe2Ids).toHaveLength(1);
    });

    it("should not throw when no processed IDs exist", async () => {
      await expect(repository.clearProcessedIds("poe1")).resolves.not.toThrow();
    });
  });

  describe("getRecentDrops", () => {
    it("should return empty array when no processed IDs with card names exist", async () => {
      const drops = await repository.getRecentDrops("poe1");
      expect(drops).toEqual([]);
    });

    it("should return recent card names ordered by processed_id descending", async () => {
      // Insert with increasing processed_ids to establish ordering
      await repository.saveProcessedId("poe1", "100", "Card A");
      await repository.saveProcessedId("poe1", "200", "Card B");
      await repository.saveProcessedId("poe1", "300", "Card C");

      const drops = await repository.getRecentDrops("poe1");

      expect(drops).toHaveLength(3);
      expect(drops[0]).toBe("Card C");
      expect(drops[1]).toBe("Card B");
      expect(drops[2]).toBe("Card A");
    });

    it("should respect the limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await repository.saveProcessedId(
          "poe1",
          `id-${String(i).padStart(3, "0")}`,
          `Card ${i}`,
        );
      }

      const drops = await repository.getRecentDrops("poe1", 5);
      expect(drops).toHaveLength(5);
    });

    it("should default to 20 results", async () => {
      for (let i = 0; i < 25; i++) {
        await repository.saveProcessedId(
          "poe1",
          `id-${String(i).padStart(3, "0")}`,
          `Card ${i}`,
        );
      }

      const drops = await repository.getRecentDrops("poe1");
      expect(drops).toHaveLength(20);
    });

    it("should not return processed IDs with null card_name", async () => {
      await testDb.kysely
        .insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "null-card-id",
          card_name: null,
        })
        .execute();

      await repository.saveProcessedId("poe1", "valid-id", "The Doctor");

      const drops = await repository.getRecentDrops("poe1");
      expect(drops).toHaveLength(1);
      expect(drops[0]).toBe("The Doctor");
    });
  });

  describe("clearRecentDrops", () => {
    it("should set card_name to NULL for all processed IDs of a game", async () => {
      await repository.saveProcessedId("poe1", "id-1", "Card A");
      await repository.saveProcessedId("poe1", "id-2", "Card B");

      await repository.clearRecentDrops("poe1");

      const drops = await repository.getRecentDrops("poe1");
      expect(drops).toHaveLength(0);
    });

    it("should not throw when no drops exist", async () => {
      await expect(repository.clearRecentDrops("poe1")).resolves.not.toThrow();
    });

    it("should not affect other games", async () => {
      await repository.saveProcessedId("poe1", "p1-id", "Card A");
      await repository.saveProcessedId("poe2", "p2-id", "Card B");

      await repository.clearRecentDrops("poe1");

      const poe2Drops = await repository.getRecentDrops("poe2");
      expect(poe2Drops).toHaveLength(1);
      expect(poe2Drops[0]).toBe("Card B");
    });
  });

  // ─── League Operations ───────────────────────────────────────────────────

  describe("getLeagueId", () => {
    it("should return league ID when league exists", async () => {
      const expectedId = await seedLeague(testDb.kysely, {
        id: "league-settlers",
        game: "poe1",
        name: "Settlers",
      });

      const result = await repository.getLeagueId("poe1", "Settlers");
      expect(result).toBe(expectedId);
    });

    it("should return null when league does not exist", async () => {
      const result = await repository.getLeagueId("poe1", "NonExistent");
      expect(result).toBeNull();
    });

    it("should match game and name exactly", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
      });
      await seedLeague(testDb.kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
      });

      const result = await repository.getLeagueId("poe2", "Settlers");
      expect(result).toBeNull();

      const correct = await repository.getLeagueId("poe2", "Dawn");
      expect(correct).toBe("league-poe2");
    });
  });

  // ─── Session Summary Operations ──────────────────────────────────────────

  describe("createSessionSummary", () => {
    it("should create a session summary", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-summary",
        leagueId,
      });

      await repository.createSessionSummary({
        sessionId: "session-summary",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        durationMinutes: 90,
        totalDecksOpened: 150,
        totalExchangeValue: 1200,
        totalStashValue: 1100,
        totalExchangeNetProfit: 750,
        totalStashNetProfit: 650,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
      });

      // Verify it was inserted by querying directly
      const row = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .where("session_id", "=", "session-summary")
        .executeTakeFirst();

      expect(row).toBeDefined();
      expect(row!.session_id).toBe("session-summary");
      expect(row!.game).toBe("poe1");
      expect(row!.league).toBe("Settlers");
      expect(row!.duration_minutes).toBe(90);
      expect(row!.total_decks_opened).toBe(150);
      expect(row!.total_exchange_value).toBe(1200);
      expect(row!.total_stash_value).toBe(1100);
      expect(row!.total_exchange_net_profit).toBe(750);
      expect(row!.total_stash_net_profit).toBe(650);
      expect(row!.exchange_chaos_to_divine).toBe(200);
      expect(row!.stash_chaos_to_divine).toBe(195);
      expect(row!.stacked_deck_chaos_cost).toBe(3);
    });

    it("should handle null net profit values", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-summary-null",
        leagueId,
      });

      await repository.createSessionSummary({
        sessionId: "session-summary-null",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        durationMinutes: 60,
        totalDecksOpened: 50,
        totalExchangeValue: 200,
        totalStashValue: 180,
        totalExchangeNetProfit: null,
        totalStashNetProfit: null,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 0,
      });

      const row = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .where("session_id", "=", "session-summary-null")
        .executeTakeFirst();

      expect(row).toBeDefined();
      expect(row!.total_exchange_net_profit).toBeNull();
      expect(row!.total_stash_net_profit).toBeNull();
    });

    it("should handle zero values", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-summary-zero",
        leagueId,
      });

      await repository.createSessionSummary({
        sessionId: "session-summary-zero",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T10:00:00Z",
        durationMinutes: 0,
        totalDecksOpened: 0,
        totalExchangeValue: 0,
        totalStashValue: 0,
        totalExchangeNetProfit: 0,
        totalStashNetProfit: 0,
        exchangeChaosToDivine: 0,
        stashChaosToDivine: 0,
        stackedDeckChaosCost: 0,
      });

      const row = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .where("session_id", "=", "session-summary-zero")
        .executeTakeFirst();

      expect(row).toBeDefined();
      expect(row!.duration_minutes).toBe(0);
      expect(row!.total_decks_opened).toBe(0);
      expect(row!.total_exchange_value).toBe(0);
    });
  });

  // ─── Full Lifecycle Integration ──────────────────────────────────────────

  describe("session lifecycle integration", () => {
    it("should support full lifecycle: create → add cards → stop → summarize", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      // 1. Create session
      await repository.createSession({
        id: "lifecycle-session",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
      });

      let session = await repository.getActiveSession("poe1");
      expect(session).not.toBeNull();
      expect(session!.isActive).toBe(true);
      expect(session!.totalCount).toBe(0);

      // 2. Add cards
      await repository.incrementCardCount(
        "lifecycle-session",
        "The Doctor",
        "2025-01-15T10:05:00Z",
      );
      await repository.incrementCardCount(
        "lifecycle-session",
        "Rain of Chaos",
        "2025-01-15T10:06:00Z",
      );
      await repository.incrementCardCount(
        "lifecycle-session",
        "Rain of Chaos",
        "2025-01-15T10:07:00Z",
      );
      await repository.incrementCardCount(
        "lifecycle-session",
        "The Fiend",
        "2025-01-15T10:10:00Z",
      );

      session = await repository.getSessionById("lifecycle-session");
      expect(session!.totalCount).toBe(4);

      const cards = await repository.getSessionCards("lifecycle-session");
      expect(cards).toHaveLength(3);

      // 3. Stop session
      await repository.updateSession("lifecycle-session", {
        endedAt: "2025-01-15T11:30:00Z",
        isActive: false,
        totalCount: 4,
      });

      session = await repository.getSessionById("lifecycle-session");
      expect(session!.isActive).toBe(false);
      expect(session!.endedAt).toBe("2025-01-15T11:30:00Z");

      const activeSession = await repository.getActiveSession("poe1");
      expect(activeSession).toBeNull();

      // 4. Create summary
      await repository.createSessionSummary({
        sessionId: "lifecycle-session",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        durationMinutes: 90,
        totalDecksOpened: 4,
        totalExchangeValue: 800,
        totalStashValue: 750,
        totalExchangeNetProfit: 788,
        totalStashNetProfit: 738,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
      });

      const summary = await testDb.kysely
        .selectFrom("session_summaries")
        .selectAll()
        .where("session_id", "=", "lifecycle-session")
        .executeTakeFirst();

      expect(summary).toBeDefined();
      expect(summary!.total_decks_opened).toBe(4);
      expect(summary!.total_exchange_value).toBe(800);
    });

    it("should support saving processed IDs alongside session cards", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      await seedSession(testDb.kysely, {
        id: "session-processed",
        leagueId,
      });

      // Save processed IDs as cards are added
      await repository.saveProcessedId("poe1", "pid-001", "The Doctor");
      await repository.incrementCardCount(
        "session-processed",
        "The Doctor",
        "2025-01-15T10:00:00Z",
      );

      await repository.saveProcessedId("poe1", "pid-002", "Rain of Chaos");
      await repository.incrementCardCount(
        "session-processed",
        "Rain of Chaos",
        "2025-01-15T10:01:00Z",
      );

      // Verify both processed IDs and session cards
      const processedIds = await repository.getProcessedIds("poe1");
      expect(processedIds).toHaveLength(2);

      const sessionCards =
        await repository.getSessionCards("session-processed");
      expect(sessionCards).toHaveLength(2);

      const recentDrops = await repository.getRecentDrops("poe1");
      expect(recentDrops).toHaveLength(2);
    });

    it("should handle starting a new session after stopping the previous one", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const snap1Id = await seedSnapshot(testDb.kysely, {
        id: "snap-1",
        leagueId,
      });
      const snap2Id = await seedSnapshot(testDb.kysely, {
        id: "snap-2",
        leagueId,
      });

      // First session
      await repository.createSession({
        id: "session-first",
        game: "poe1",
        leagueId,
        snapshotId: snap1Id,
        startedAt: "2025-01-15T10:00:00Z",
      });

      await repository.incrementCardCount(
        "session-first",
        "The Doctor",
        "2025-01-15T10:05:00Z",
      );

      await repository.updateSession("session-first", {
        endedAt: "2025-01-15T11:00:00Z",
        isActive: false,
        totalCount: 1,
      });

      // Second session
      await repository.createSession({
        id: "session-second",
        game: "poe1",
        leagueId,
        snapshotId: snap2Id,
        startedAt: "2025-01-15T12:00:00Z",
      });

      await repository.incrementCardCount(
        "session-second",
        "Rain of Chaos",
        "2025-01-15T12:05:00Z",
      );
      await repository.incrementCardCount(
        "session-second",
        "Rain of Chaos",
        "2025-01-15T12:06:00Z",
      );

      // Verify sessions are independent
      const firstSession = await repository.getSessionById("session-first");
      const secondSession = await repository.getSessionById("session-second");

      expect(firstSession!.isActive).toBe(false);
      expect(firstSession!.totalCount).toBe(1);

      expect(secondSession!.isActive).toBe(true);
      expect(secondSession!.totalCount).toBe(2);

      const firstCards = await repository.getSessionCards("session-first");
      const secondCards = await repository.getSessionCards("session-second");

      expect(firstCards).toHaveLength(1);
      expect(firstCards[0].cardName).toBe("The Doctor");
      expect(secondCards).toHaveLength(1);
      expect(secondCards[0].cardName).toBe("Rain of Chaos");
      expect(secondCards[0].count).toBe(2);

      const activeSession = await repository.getActiveSession("poe1");
      expect(activeSession).not.toBeNull();
      expect(activeSession!.id).toBe("session-second");
    });
  });
});
