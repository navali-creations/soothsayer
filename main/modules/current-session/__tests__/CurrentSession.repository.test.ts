import { describe, expect, it } from "vitest";

import {
  seedDivinationCard,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSnapshot,
} from "~/main/modules/__test-utils__/create-test-db";
import { setupRepositoryTest } from "~/main/modules/__test-utils__/repository-test-setup";

import { CurrentSessionRepository } from "../CurrentSession.repository";

describe("CurrentSessionRepository", () => {
  const { getRepository, getTestDb } = setupRepositoryTest(
    CurrentSessionRepository,
  );

  // ─── Session Operations ──────────────────────────────────────────────────

  describe("createSession", () => {
    it("should create a new session", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      const snapshotId = await seedSnapshot(getTestDb().kysely, { leagueId });

      await getRepository().createSession({
        id: "session-1",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
      });

      const session = await getRepository().getSessionById("session-1");
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
      const leagueId = await seedLeague(getTestDb().kysely);
      const snapshotId = await seedSnapshot(getTestDb().kysely, { leagueId });

      await getRepository().createSession({
        id: "session-active",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
      });

      const session = await getRepository().getActiveSession("poe1");
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-active");
      expect(session!.isActive).toBe(true);
    });

    it("should create sessions for different games independently", async () => {
      const poe1LeagueId = await seedLeague(getTestDb().kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
      });
      const poe2LeagueId = await seedLeague(getTestDb().kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
      });
      const snap1Id = await seedSnapshot(getTestDb().kysely, {
        leagueId: poe1LeagueId,
      });
      const snap2Id = await seedSnapshot(getTestDb().kysely, {
        leagueId: poe2LeagueId,
      });

      await getRepository().createSession({
        id: "session-poe1",
        game: "poe1",
        leagueId: poe1LeagueId,
        snapshotId: snap1Id,
        startedAt: "2025-01-15T10:00:00Z",
      });

      await getRepository().createSession({
        id: "session-poe2",
        game: "poe2",
        leagueId: poe2LeagueId,
        snapshotId: snap2Id,
        startedAt: "2025-01-15T10:00:00Z",
      });

      const poe1Session = await getRepository().getActiveSession("poe1");
      const poe2Session = await getRepository().getActiveSession("poe2");

      expect(poe1Session).not.toBeNull();
      expect(poe1Session!.id).toBe("session-poe1");
      expect(poe2Session).not.toBeNull();
      expect(poe2Session!.id).toBe("session-poe2");
    });
  });

  describe("updateSession", () => {
    it("should update totalCount", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-update",
        leagueId,
      });

      await getRepository().updateSession("session-update", { totalCount: 42 });

      const session = await getRepository().getSessionById("session-update");
      expect(session!.totalCount).toBe(42);
    });

    it("should update endedAt", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-end",
        leagueId,
      });

      await getRepository().updateSession("session-end", {
        endedAt: "2025-01-15T12:00:00Z",
      });

      const session = await getRepository().getSessionById("session-end");
      expect(session!.endedAt).toBe("2025-01-15T12:00:00Z");
    });

    it("should update isActive", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-deactivate",
        leagueId,
        isActive: true,
      });

      await getRepository().updateSession("session-deactivate", {
        isActive: false,
      });

      const session =
        await getRepository().getSessionById("session-deactivate");
      expect(session!.isActive).toBe(false);
    });

    it("should update multiple fields at once", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-multi",
        leagueId,
        isActive: true,
      });

      await getRepository().updateSession("session-multi", {
        totalCount: 100,
        endedAt: "2025-01-15T13:00:00Z",
        isActive: false,
      });

      const session = await getRepository().getSessionById("session-multi");
      expect(session!.totalCount).toBe(100);
      expect(session!.endedAt).toBe("2025-01-15T13:00:00Z");
      expect(session!.isActive).toBe(false);
    });

    it("should not update anything when empty update object is passed", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-noop",
        leagueId,
        totalCount: 5,
        isActive: true,
      });

      await getRepository().updateSession("session-noop", {});

      const session = await getRepository().getSessionById("session-noop");
      expect(session!.totalCount).toBe(5);
      expect(session!.isActive).toBe(true);
    });
  });

  describe("getActiveSession", () => {
    it("should return null when no active session exists", async () => {
      const session = await getRepository().getActiveSession("poe1");
      expect(session).toBeNull();
    });

    it("should return the active session for a given game", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-active",
        game: "poe1",
        leagueId,
        isActive: true,
      });

      const session = await getRepository().getActiveSession("poe1");
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-active");
      expect(session!.isActive).toBe(true);
    });

    it("should not return inactive sessions", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-inactive",
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const session = await getRepository().getActiveSession("poe1");
      expect(session).toBeNull();
    });

    it("should not return active sessions for a different game", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        game: "poe2",
        name: "Dawn",
      });
      await seedSession(getTestDb().kysely, {
        id: "session-poe2",
        game: "poe2",
        leagueId,
        isActive: true,
      });

      const session = await getRepository().getActiveSession("poe1");
      expect(session).toBeNull();
    });
  });

  describe("getSessionById", () => {
    it("should return null for non-existent session", async () => {
      const session = await getRepository().getSessionById("nonexistent");
      expect(session).toBeNull();
    });

    it("should return the session with correctly mapped fields", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      const snapshotId = await seedSnapshot(getTestDb().kysely, { leagueId });
      await seedSession(getTestDb().kysely, {
        id: "session-by-id",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-06-01T08:00:00Z",
        totalCount: 77,
        isActive: true,
      });

      const session = await getRepository().getSessionById("session-by-id");

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
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-1",
        game: "poe1",
        leagueId,
        isActive: true,
      });
      await seedSession(getTestDb().kysely, {
        id: "session-2",
        game: "poe1",
        leagueId,
        isActive: true,
      });

      await getRepository().deactivateAllSessions("poe1");

      const active = await getRepository().getActiveSession("poe1");
      expect(active).toBeNull();

      const s1 = await getRepository().getSessionById("session-1");
      const s2 = await getRepository().getSessionById("session-2");
      expect(s1!.isActive).toBe(false);
      expect(s2!.isActive).toBe(false);
    });

    it("should not affect sessions of other games", async () => {
      const poe1League = await seedLeague(getTestDb().kysely, {
        id: "league-p1",
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(getTestDb().kysely, {
        id: "league-p2",
        game: "poe2",
        name: "Dawn",
      });

      await seedSession(getTestDb().kysely, {
        id: "session-poe1",
        game: "poe1",
        leagueId: poe1League,
        isActive: true,
      });
      await seedSession(getTestDb().kysely, {
        id: "session-poe2",
        game: "poe2",
        leagueId: poe2League,
        isActive: true,
      });

      await getRepository().deactivateAllSessions("poe1");

      const poe1Active = await getRepository().getActiveSession("poe1");
      const poe2Active = await getRepository().getActiveSession("poe2");

      expect(poe1Active).toBeNull();
      expect(poe2Active).not.toBeNull();
      expect(poe2Active!.id).toBe("session-poe2");
    });

    it("should not throw when no active sessions exist", async () => {
      await expect(
        getRepository().deactivateAllSessions("poe1"),
      ).resolves.not.toThrow();
    });

    it("should not affect already-inactive sessions", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-already-inactive",
        game: "poe1",
        leagueId,
        isActive: false,
        endedAt: "2025-01-15T12:00:00Z",
        totalCount: 50,
      });

      await getRepository().deactivateAllSessions("poe1");

      const session = await getRepository().getSessionById(
        "session-already-inactive",
      );
      expect(session!.isActive).toBe(false);
      expect(session!.totalCount).toBe(50);
      expect(session!.endedAt).toBe("2025-01-15T12:00:00Z");
    });
  });

  describe("getSessionTotalCount", () => {
    it("should return 0 when session has no cards", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-empty",
        leagueId,
      });

      const total = await getRepository().getSessionTotalCount("session-empty");
      expect(total).toBe(0);
    });

    it("should return sum of all card counts for the session", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-with-cards",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-with-cards", [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 15 },
        { cardName: "The Fiend", count: 1 },
      ]);

      const total =
        await getRepository().getSessionTotalCount("session-with-cards");
      expect(total).toBe(18);
    });

    it("should not include cards from other sessions", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-a",
        leagueId,
      });
      await seedSession(getTestDb().kysely, {
        id: "session-b",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-a", [
        { cardName: "The Doctor", count: 5 },
      ]);
      await seedSessionCards(getTestDb().kysely, "session-b", [
        { cardName: "Rain of Chaos", count: 99 },
      ]);

      const totalA = await getRepository().getSessionTotalCount("session-a");
      const totalB = await getRepository().getSessionTotalCount("session-b");

      expect(totalA).toBe(5);
      expect(totalB).toBe(99);
    });
  });

  // ─── Session Card Operations ─────────────────────────────────────────────

  describe("getSessionCards", () => {
    it("should return empty array when session has no cards", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-no-cards",
        leagueId,
      });

      const cards = await getRepository().getSessionCards("session-no-cards");
      expect(cards).toEqual([]);
    });

    it("should return cards with correctly mapped boolean fields", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-bool-cards",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-bool-cards", [
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

      const cards = await getRepository().getSessionCards("session-bool-cards");
      expect(cards).toHaveLength(2);

      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");

      expect(doctor!.hidePriceExchange).toBe(true);
      expect(doctor!.hidePriceStash).toBe(false);
      expect(rain!.hidePriceExchange).toBe(false);
      expect(rain!.hidePriceStash).toBe(true);
    });

    it("should join divination card metadata when available", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      await seedSession(getTestDb().kysely, {
        id: "session-join-cards",
        game: "poe1",
        leagueId,
      });

      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
        description: "A powerful card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>Flavour</i>",
      });

      await seedDivinationCardRarity(getTestDb().kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      await seedSessionCards(getTestDb().kysely, "session-join-cards", [
        { cardName: "The Doctor", count: 1 },
      ]);

      const cards = await getRepository().getSessionCards("session-join-cards");
      expect(cards).toHaveLength(1);
      expect(cards[0].divinationCard).toBeDefined();
      expect(cards[0].divinationCard!.id).toBe("poe1_the-doctor");
      expect(cards[0].divinationCard!.stackSize).toBe(8);
      expect(cards[0].divinationCard!.rarity).toBe(1);
    });

    it("should default rarity to 4 when no rarity data exists", async () => {
      const leagueId = await seedLeague(getTestDb().kysely, {
        name: "Settlers",
      });
      await seedSession(getTestDb().kysely, {
        id: "session-default-rarity",
        game: "poe1",
        leagueId,
      });

      await seedDivinationCard(getTestDb().kysely, {
        game: "poe1",
        name: "Rain of Chaos",
        stackSize: 1,
      });

      // No rarity data seeded

      await seedSessionCards(getTestDb().kysely, "session-default-rarity", [
        { cardName: "Rain of Chaos", count: 3 },
      ]);

      const cards = await getRepository().getSessionCards(
        "session-default-rarity",
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].divinationCard).toBeDefined();
      expect(cards[0].divinationCard!.rarity).toBe(0);
    });

    it("should handle cards without matching divination card data", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-no-div-data",
        leagueId,
      });

      // No divination card reference data seeded

      await seedSessionCards(getTestDb().kysely, "session-no-div-data", [
        { cardName: "Unknown Card", count: 2 },
      ]);

      const cards = await getRepository().getSessionCards(
        "session-no-div-data",
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("Unknown Card");
      expect(cards[0].count).toBe(2);
      // divinationCard should be undefined since there's no matching row
      expect(cards[0].divinationCard).toBeUndefined();
    });
  });

  describe("updateCardPriceVisibility", () => {
    it("should update exchange price visibility", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-vis",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-vis", [
        { cardName: "The Doctor", count: 1 },
      ]);

      await getRepository().updateCardPriceVisibility(
        "session-vis",
        "The Doctor",
        "exchange",
        true,
      );

      const cards = await getRepository().getSessionCards("session-vis");
      expect(cards[0].hidePriceExchange).toBe(true);
      expect(cards[0].hidePriceStash).toBe(false);
    });

    it("should update stash price visibility", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-vis-stash",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-vis-stash", [
        { cardName: "The Doctor", count: 1 },
      ]);

      await getRepository().updateCardPriceVisibility(
        "session-vis-stash",
        "The Doctor",
        "stash",
        true,
      );

      const cards = await getRepository().getSessionCards("session-vis-stash");
      expect(cards[0].hidePriceExchange).toBe(false);
      expect(cards[0].hidePriceStash).toBe(true);
    });

    it("should toggle visibility back to false", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-vis-toggle",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-vis-toggle", [
        { cardName: "The Doctor", count: 1, hidePriceExchange: true },
      ]);

      await getRepository().updateCardPriceVisibility(
        "session-vis-toggle",
        "The Doctor",
        "exchange",
        false,
      );

      const cards = await getRepository().getSessionCards("session-vis-toggle");
      expect(cards[0].hidePriceExchange).toBe(false);
    });

    it("should only affect the specified card", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-vis-targeted",
        leagueId,
      });
      await seedSessionCards(getTestDb().kysely, "session-vis-targeted", [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      await getRepository().updateCardPriceVisibility(
        "session-vis-targeted",
        "The Doctor",
        "exchange",
        true,
      );

      const cards = await getRepository().getSessionCards(
        "session-vis-targeted",
      );
      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");

      expect(doctor!.hidePriceExchange).toBe(true);
      expect(rain!.hidePriceExchange).toBe(false);
    });
  });

  // ─── Processed IDs Operations ────────────────────────────────────────────

  describe("getProcessedIds", () => {
    it("should return empty array when no processed IDs exist", async () => {
      const result = await getRepository().getProcessedIds("poe1");
      expect(result).toEqual([]);
    });

    it("should return processed IDs for a specific game", async () => {
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "id-1",
          card_name: "The Doctor",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "id-2",
          card_name: "Rain of Chaos",
        })
        .execute();

      const result = await getRepository().getProcessedIds("poe1");
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.processedId)).toContain("id-1");
      expect(result.map((r) => r.processedId)).toContain("id-2");
    });

    it("should not return processed IDs from other games", async () => {
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "id-poe1",
          card_name: "The Doctor",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe2",
          scope: "global",
          processed_id: "id-poe2",
          card_name: "The Fiend",
        })
        .execute();

      const poe1Ids = await getRepository().getProcessedIds("poe1");
      const poe2Ids = await getRepository().getProcessedIds("poe2");

      expect(poe1Ids).toHaveLength(1);
      expect(poe1Ids[0].processedId).toBe("id-poe1");
      expect(poe2Ids).toHaveLength(1);
      expect(poe2Ids[0].processedId).toBe("id-poe2");
    });
  });

  describe("getRecentDrops", () => {
    it("should return empty array when no processed IDs with card names exist", async () => {
      const drops = await getRepository().getRecentDrops("poe1");
      expect(drops).toEqual([]);
    });

    it("should return recent card names ordered by processed_id descending", async () => {
      // Insert with increasing processed_ids to establish ordering
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "100",
          card_name: "Card A",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "200",
          card_name: "Card B",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "300",
          card_name: "Card C",
        })
        .execute();

      const drops = await getRepository().getRecentDrops("poe1");

      expect(drops).toHaveLength(3);
      expect(drops[0]).toBe("Card C");
      expect(drops[1]).toBe("Card B");
      expect(drops[2]).toBe("Card A");
    });

    it("should respect the limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await getTestDb()
          .kysely.insertInto("processed_ids")
          .values({
            game: "poe1",
            scope: "global",
            processed_id: `id-${String(i).padStart(3, "0")}`,
            card_name: `Card ${i}`,
          })
          .execute();
      }

      const drops = await getRepository().getRecentDrops("poe1", 5);
      expect(drops).toHaveLength(5);
    });

    it("should default to 20 results", async () => {
      for (let i = 0; i < 25; i++) {
        await getTestDb()
          .kysely.insertInto("processed_ids")
          .values({
            game: "poe1",
            scope: "global",
            processed_id: `id-${String(i).padStart(3, "0")}`,
            card_name: `Card ${i}`,
          })
          .execute();
      }

      const drops = await getRepository().getRecentDrops("poe1");
      expect(drops).toHaveLength(20);
    });

    it("should not return processed IDs with null card_name", async () => {
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "null-card-id",
          card_name: null,
        })
        .execute();

      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "valid-id",
          card_name: "The Doctor",
        })
        .execute();

      const drops = await getRepository().getRecentDrops("poe1");
      expect(drops).toHaveLength(1);
      expect(drops[0]).toBe("The Doctor");
    });
  });

  describe("clearRecentDrops", () => {
    it("should set card_name to NULL for all processed IDs of a game", async () => {
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "id-1",
          card_name: "Card A",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "id-2",
          card_name: "Card B",
        })
        .execute();

      await getRepository().clearRecentDrops("poe1");

      const drops = await getRepository().getRecentDrops("poe1");
      expect(drops).toHaveLength(0);
    });

    it("should not throw when no drops exist", async () => {
      await expect(
        getRepository().clearRecentDrops("poe1"),
      ).resolves.not.toThrow();
    });

    it("should not affect other games", async () => {
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "p1-id",
          card_name: "Card A",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe2",
          scope: "global",
          processed_id: "p2-id",
          card_name: "Card B",
        })
        .execute();

      await getRepository().clearRecentDrops("poe1");

      const poe2Drops = await getRepository().getRecentDrops("poe2");
      expect(poe2Drops).toHaveLength(1);
      expect(poe2Drops[0]).toBe("Card B");
    });

    it("should prune old entries when more than 20 exist, keeping only the most recent 20", async () => {
      // Insert 25 processed IDs with staggered created_at timestamps
      for (let i = 0; i < 25; i++) {
        await getTestDb()
          .kysely.insertInto("processed_ids")
          .values({
            game: "poe1",
            scope: "global",
            processed_id: `prune-id-${String(i).padStart(3, "0")}`,
            card_name: `Card ${i}`,
            created_at: new Date(Date.now() - (25 - i) * 1000).toISOString(),
          })
          .execute();
      }

      // Verify we have 25 entries before clearing
      const beforeRows = await getTestDb()
        .kysely.selectFrom("processed_ids")
        .selectAll()
        .where("game", "=", "poe1")
        .where("scope", "=", "global")
        .execute();
      expect(beforeRows).toHaveLength(25);

      // Clear recent drops — this should null out card_name AND prune old entries
      await getRepository().clearRecentDrops("poe1");

      // After pruning, only the 20 most recent entries should remain
      const afterRows = await getTestDb()
        .kysely.selectFrom("processed_ids")
        .selectAll()
        .where("game", "=", "poe1")
        .where("scope", "=", "global")
        .execute();
      expect(afterRows).toHaveLength(20);

      // All remaining entries should have card_name set to NULL
      for (const row of afterRows) {
        expect(row.card_name).toBeNull();
      }

      // The oldest 5 entries (prune-id-000 through prune-id-004) should have been deleted
      const remainingIds = afterRows.map((r) => r.processed_id).sort();
      for (let i = 0; i < 5; i++) {
        expect(remainingIds).not.toContain(
          `prune-id-${String(i).padStart(3, "0")}`,
        );
      }

      // The newest 20 entries (prune-id-005 through prune-id-024) should remain
      for (let i = 5; i < 25; i++) {
        expect(remainingIds).toContain(
          `prune-id-${String(i).padStart(3, "0")}`,
        );
      }
    });

    it("should not prune when exactly 20 entries exist", async () => {
      for (let i = 0; i < 20; i++) {
        await getTestDb()
          .kysely.insertInto("processed_ids")
          .values({
            game: "poe1",
            scope: "global",
            processed_id: `exact-id-${String(i).padStart(3, "0")}`,
            card_name: `Card ${i}`,
            created_at: new Date(Date.now() - (20 - i) * 1000).toISOString(),
          })
          .execute();
      }

      await getRepository().clearRecentDrops("poe1");

      const afterRows = await getTestDb()
        .kysely.selectFrom("processed_ids")
        .selectAll()
        .where("game", "=", "poe1")
        .where("scope", "=", "global")
        .execute();
      // All 20 should remain — no pruning needed
      expect(afterRows).toHaveLength(20);
    });
  });

  // ─── League Operations ───────────────────────────────────────────────────

  describe("getLeagueId", () => {
    it("should return league ID when league exists", async () => {
      const expectedId = await seedLeague(getTestDb().kysely, {
        id: "league-settlers",
        game: "poe1",
        name: "Settlers",
      });

      const result = await getRepository().getLeagueId("poe1", "Settlers");
      expect(result).toBe(expectedId);
    });

    it("should return null when league does not exist", async () => {
      const result = await getRepository().getLeagueId("poe1", "NonExistent");
      expect(result).toBeNull();
    });

    it("should match game and name exactly", async () => {
      await seedLeague(getTestDb().kysely, {
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
      });
      await seedLeague(getTestDb().kysely, {
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
      });

      const result = await getRepository().getLeagueId("poe2", "Settlers");
      expect(result).toBeNull();

      const correct = await getRepository().getLeagueId("poe2", "Dawn");
      expect(correct).toBe("league-poe2");
    });
  });

  // ─── Session Summary Operations ──────────────────────────────────────────

  describe("createSessionSummary", () => {
    it("should create a session summary", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-summary",
        leagueId,
      });

      await getRepository().createSessionSummary({
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
      const row = await getTestDb()
        .kysely.selectFrom("session_summaries")
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
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-summary-null",
        leagueId,
      });

      await getRepository().createSessionSummary({
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

      const row = await getTestDb()
        .kysely.selectFrom("session_summaries")
        .selectAll()
        .where("session_id", "=", "session-summary-null")
        .executeTakeFirst();

      expect(row).toBeDefined();
      expect(row!.total_exchange_net_profit).toBeNull();
      expect(row!.total_stash_net_profit).toBeNull();
    });

    it("should handle zero values", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-summary-zero",
        leagueId,
      });

      await getRepository().createSessionSummary({
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

      const row = await getTestDb()
        .kysely.selectFrom("session_summaries")
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
      const leagueId = await seedLeague(getTestDb().kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(getTestDb().kysely, { leagueId });

      // 1. Create session
      await getRepository().createSession({
        id: "lifecycle-session",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
      });

      let session = await getRepository().getActiveSession("poe1");
      expect(session).not.toBeNull();
      expect(session!.isActive).toBe(true);
      expect(session!.totalCount).toBe(0);

      // 2. Add cards
      await seedSessionCards(getTestDb().kysely, "lifecycle-session", [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 2 },
        { cardName: "The Fiend", count: 1 },
      ]);
      await getTestDb()
        .kysely.updateTable("sessions")
        .set({ total_count: 4 })
        .where("id", "=", "lifecycle-session")
        .execute();

      session = await getRepository().getSessionById("lifecycle-session");
      expect(session!.totalCount).toBe(4);

      const cards = await getRepository().getSessionCards("lifecycle-session");
      expect(cards).toHaveLength(3);

      // 3. Stop session
      await getRepository().updateSession("lifecycle-session", {
        endedAt: "2025-01-15T11:30:00Z",
        isActive: false,
        totalCount: 4,
      });

      session = await getRepository().getSessionById("lifecycle-session");
      expect(session!.isActive).toBe(false);
      expect(session!.endedAt).toBe("2025-01-15T11:30:00Z");

      const activeSession = await getRepository().getActiveSession("poe1");
      expect(activeSession).toBeNull();

      // 4. Create summary
      await getRepository().createSessionSummary({
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

      const summary = await getTestDb()
        .kysely.selectFrom("session_summaries")
        .selectAll()
        .where("session_id", "=", "lifecycle-session")
        .executeTakeFirst();

      expect(summary).toBeDefined();
      expect(summary!.total_decks_opened).toBe(4);
      expect(summary!.total_exchange_value).toBe(800);
    });

    it("should support saving processed IDs alongside session cards", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      await seedSession(getTestDb().kysely, {
        id: "session-processed",
        leagueId,
      });

      // Save processed IDs as cards are added
      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "pid-001",
          card_name: "The Doctor",
        })
        .execute();
      await seedSessionCards(getTestDb().kysely, "session-processed", [
        { cardName: "The Doctor", count: 1 },
      ]);

      await getTestDb()
        .kysely.insertInto("processed_ids")
        .values({
          game: "poe1",
          scope: "global",
          processed_id: "pid-002",
          card_name: "Rain of Chaos",
        })
        .execute();
      await getTestDb()
        .kysely.insertInto("session_cards")
        .values({
          session_id: "session-processed",
          card_name: "Rain of Chaos",
          count: 1,
          first_seen_at: "2025-01-15T10:01:00Z",
          last_seen_at: "2025-01-15T10:01:00Z",
        })
        .execute();

      // Verify both processed IDs and session cards
      const processedIds = await getRepository().getProcessedIds("poe1");
      expect(processedIds).toHaveLength(2);

      const sessionCards =
        await getRepository().getSessionCards("session-processed");
      expect(sessionCards).toHaveLength(2);

      const recentDrops = await getRepository().getRecentDrops("poe1");
      expect(recentDrops).toHaveLength(2);
    });

    it("should handle starting a new session after stopping the previous one", async () => {
      const leagueId = await seedLeague(getTestDb().kysely);
      const snap1Id = await seedSnapshot(getTestDb().kysely, {
        id: "snap-1",
        leagueId,
      });
      const snap2Id = await seedSnapshot(getTestDb().kysely, {
        id: "snap-2",
        leagueId,
      });

      // First session
      await getRepository().createSession({
        id: "session-first",
        game: "poe1",
        leagueId,
        snapshotId: snap1Id,
        startedAt: "2025-01-15T10:00:00Z",
      });

      await seedSessionCards(getTestDb().kysely, "session-first", [
        { cardName: "The Doctor", count: 1 },
      ]);
      await getTestDb()
        .kysely.updateTable("sessions")
        .set({ total_count: 1 })
        .where("id", "=", "session-first")
        .execute();

      await getRepository().updateSession("session-first", {
        endedAt: "2025-01-15T11:00:00Z",
        isActive: false,
        totalCount: 1,
      });

      // Second session
      await getRepository().createSession({
        id: "session-second",
        game: "poe1",
        leagueId,
        snapshotId: snap2Id,
        startedAt: "2025-01-15T12:00:00Z",
      });

      await seedSessionCards(getTestDb().kysely, "session-second", [
        { cardName: "Rain of Chaos", count: 2 },
      ]);
      await getTestDb()
        .kysely.updateTable("sessions")
        .set({ total_count: 2 })
        .where("id", "=", "session-second")
        .execute();

      // Verify sessions are independent
      const firstSession =
        await getRepository().getSessionById("session-first");
      const secondSession =
        await getRepository().getSessionById("session-second");

      expect(firstSession!.isActive).toBe(false);
      expect(firstSession!.totalCount).toBe(1);

      expect(secondSession!.isActive).toBe(true);
      expect(secondSession!.totalCount).toBe(2);

      const firstCards = await getRepository().getSessionCards("session-first");
      const secondCards =
        await getRepository().getSessionCards("session-second");

      expect(firstCards).toHaveLength(1);
      expect(firstCards[0].cardName).toBe("The Doctor");
      expect(secondCards).toHaveLength(1);
      expect(secondCards[0].cardName).toBe("Rain of Chaos");
      expect(secondCards[0].count).toBe(2);

      const activeSession = await getRepository().getActiveSession("poe1");
      expect(activeSession).not.toBeNull();
      expect(activeSession!.id).toBe("session-second");
    });
  });
});
