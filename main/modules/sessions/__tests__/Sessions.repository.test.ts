import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  seedDivinationCardRarity,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSessionSummary,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { SessionsRepository } from "../Sessions.repository";

describe("SessionsRepository", () => {
  let testDb: TestDatabase;
  let repository: SessionsRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new SessionsRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── getSessionCount ─────────────────────────────────────────────────

  describe("getSessionCount", () => {
    it("should return 0 when no sessions exist", async () => {
      const count = await repository.getSessionCount("poe1");
      expect(count).toBe(0);
    });

    it("should return the count of sessions for a given game", async () => {
      const leagueId = await seedLeague(testDb.kysely, { game: "poe1" });
      await seedSession(testDb.kysely, { game: "poe1", leagueId });
      await seedSession(testDb.kysely, { game: "poe1", leagueId });
      await seedSession(testDb.kysely, { game: "poe1", leagueId });

      const count = await repository.getSessionCount("poe1");
      expect(count).toBe(3);
    });

    it("should only count sessions for the specified game", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      await seedSession(testDb.kysely, { game: "poe1", leagueId: poe1League });
      await seedSession(testDb.kysely, { game: "poe1", leagueId: poe1League });
      await seedSession(testDb.kysely, { game: "poe2", leagueId: poe2League });

      const poe1Count = await repository.getSessionCount("poe1");
      const poe2Count = await repository.getSessionCount("poe2");

      expect(poe1Count).toBe(2);
      expect(poe2Count).toBe(1);
    });

    it("should count both active and inactive sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, { game: "poe1" });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        isActive: true,
      });
      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        isActive: false,
        endedAt: "2025-01-15T12:00:00Z",
      });

      const count = await repository.getSessionCount("poe1");
      expect(count).toBe(2);
    });
  });

  // ─── getSessionById ──────────────────────────────────────────────────

  describe("getSessionById", () => {
    it("should return null for a non-existent session", async () => {
      const result = await repository.getSessionById("non-existent-id");
      expect(result).toBeNull();
    });

    it("should return session details with correctly mapped fields", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-1",
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        id: "snap-1",
        leagueId,
      });
      const sessionId = await seedSession(testDb.kysely, {
        id: "session-1",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        totalCount: 150,
        isActive: false,
      });

      const result = await repository.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("session-1");
      expect(result!.game).toBe("poe1");
      expect(result!.leagueId).toBe("league-1");
      expect(result!.league).toBe("Settlers");
      expect(result!.snapshotId).toBe("snap-1");
      expect(result!.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(result!.endedAt).toBe("2025-01-15T11:30:00Z");
      expect(result!.totalCount).toBe(150);
      expect(result!.isActive).toBe(false);
    });

    it("should convert isActive from integer to boolean (active)", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        isActive: true,
      });

      const result = await repository.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(true);
      expect(typeof result!.isActive).toBe("boolean");
    });

    it("should convert isActive from integer to boolean (inactive)", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const result = await repository.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
      expect(typeof result!.isActive).toBe("boolean");
    });

    it("should handle null snapshotId", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        // no snapshotId — defaults to null
      });

      const result = await repository.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.snapshotId).toBeNull();
    });

    it("should handle null endedAt for active sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        isActive: true,
        endedAt: null,
      });

      const result = await repository.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.endedAt).toBeNull();
      expect(result!.isActive).toBe(true);
    });
  });

  // ─── getSessionsPage ────────────────────────────────────────────────

  describe("getSessionsPage", () => {
    it("should return empty array when no sessions exist", async () => {
      const sessions = await repository.getSessionsPage("poe1", 10, 0);
      expect(sessions).toEqual([]);
    });

    it("should return sessions for the specified game only", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: poe1League,
        totalCount: 10,
        isActive: false,
      });
      await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId: poe2League,
        totalCount: 20,
        isActive: false,
      });

      const poe1Sessions = await repository.getSessionsPage("poe1", 10, 0);
      const poe2Sessions = await repository.getSessionsPage("poe2", 10, 0);

      expect(poe1Sessions).toHaveLength(1);
      expect(poe2Sessions).toHaveLength(1);
      expect(poe1Sessions[0].game).toBe("poe1");
      expect(poe2Sessions[0].game).toBe("poe2");
    });

    it("should order sessions by started_at descending", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await seedSession(testDb.kysely, {
        id: "oldest",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-10T10:00:00Z",
        isActive: false,
      });
      await seedSession(testDb.kysely, {
        id: "newest",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-15T10:00:00Z",
        isActive: false,
      });
      await seedSession(testDb.kysely, {
        id: "middle",
        game: "poe1",
        leagueId,
        startedAt: "2025-01-12T10:00:00Z",
        isActive: false,
      });

      const sessions = await repository.getSessionsPage("poe1", 10, 0);

      expect(sessions).toHaveLength(3);
      expect(sessions[0].sessionId).toBe("newest");
      expect(sessions[1].sessionId).toBe("middle");
      expect(sessions[2].sessionId).toBe("oldest");
    });

    it("should respect limit parameter", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      for (let i = 0; i < 5; i++) {
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          startedAt: `2025-01-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
          isActive: false,
        });
      }

      const sessions = await repository.getSessionsPage("poe1", 3, 0);
      expect(sessions).toHaveLength(3);
    });

    it("should respect offset parameter for pagination", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      for (let i = 0; i < 5; i++) {
        await seedSession(testDb.kysely, {
          id: `session-${i}`,
          game: "poe1",
          leagueId,
          startedAt: `2025-01-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
          isActive: false,
        });
      }

      const page1 = await repository.getSessionsPage("poe1", 2, 0);
      const page2 = await repository.getSessionsPage("poe1", 2, 2);
      const page3 = await repository.getSessionsPage("poe1", 2, 4);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page3).toHaveLength(1);

      // Sessions are ordered by started_at desc, so session-4 is newest
      expect(page1[0].sessionId).toBe("session-4");
      expect(page1[1].sessionId).toBe("session-3");
      expect(page2[0].sessionId).toBe("session-2");
      expect(page2[1].sessionId).toBe("session-1");
      expect(page3[0].sessionId).toBe("session-0");
    });

    it("should convert isActive to boolean in results", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await seedSession(testDb.kysely, {
        id: "active-session",
        game: "poe1",
        leagueId,
        isActive: true,
        startedAt: "2025-01-15T10:00:00Z",
      });
      await seedSession(testDb.kysely, {
        id: "inactive-session",
        game: "poe1",
        leagueId,
        isActive: false,
        startedAt: "2025-01-14T10:00:00Z",
        endedAt: "2025-01-14T11:00:00Z",
      });

      const sessions = await repository.getSessionsPage("poe1", 10, 0);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe("active-session");
      expect(sessions[0].isActive).toBe(true);
      expect(typeof sessions[0].isActive).toBe("boolean");
      expect(sessions[1].sessionId).toBe("inactive-session");
      expect(sessions[1].isActive).toBe(false);
      expect(typeof sessions[1].isActive).toBe("boolean");
    });

    it("should include league name from joined leagues table", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers of Kalguur",
      });

      await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        isActive: false,
      });

      const sessions = await repository.getSessionsPage("poe1", 10, 0);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].league).toBe("Settlers of Kalguur");
    });

    // ─── Summary vs Computed Values ──────────────────────────────────

    describe("with session_summaries (COALESCE priority)", () => {
      it("should prefer summary values when session_summaries row exists", async () => {
        const leagueId = await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          exchangeChaosToDivine: 180,
          stashChaosToDivine: 170,
          stackedDeckChaosCost: 2,
        });

        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
          totalCount: 100,
          isActive: false,
        });

        // Summary row with different values — these should take priority
        await seedSessionSummary(testDb.kysely, {
          sessionId,
          game: "poe1",
          league: "Settlers",
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
          durationMinutes: 60,
          totalDecksOpened: 100,
          totalExchangeValue: 5000,
          totalStashValue: 4800,
          totalExchangeNetProfit: 4700,
          totalStashNetProfit: 4500,
          exchangeChaosToDivine: 200,
          stashChaosToDivine: 195,
          stackedDeckChaosCost: 3,
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        const s = sessions[0];

        expect(s.durationMinutes).toBe(60);
        expect(s.totalDecksOpened).toBe(100);
        expect(s.totalExchangeValue).toBe(5000);
        expect(s.totalStashValue).toBe(4800);
        expect(s.totalExchangeNetProfit).toBe(4700);
        expect(s.totalStashNetProfit).toBe(4500);
        // Summary chaos-to-divine should take priority over snapshot
        expect(s.exchangeChaosToDivine).toBe(200);
        expect(s.stashChaosToDivine).toBe(195);
        expect(s.stackedDeckChaosCost).toBe(3);
      });

      it("should handle null net profit in summary", async () => {
        const leagueId = await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });
        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        await seedSessionSummary(testDb.kysely, {
          sessionId,
          totalExchangeNetProfit: null,
          totalStashNetProfit: null,
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);
        expect(sessions).toHaveLength(1);
        // When summary has null, COALESCE falls through to computed value
        // Since no snapshot/session_cards, computed value will be 0 - 0 = 0
        expect(sessions[0].totalExchangeNetProfit).not.toBeUndefined();
        expect(sessions[0].totalStashNetProfit).not.toBeUndefined();
      });
    });

    describe("without session_summaries (computed values)", () => {
      it("should compute totalDecksOpened from session total_count", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          totalCount: 250,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:30:00Z",
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].totalDecksOpened).toBe(250);
      });

      it("should compute durationMinutes from startedAt and endedAt", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:30:00Z",
          isActive: false,
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].durationMinutes).toBe(90);
      });

      it("should return null durationMinutes when endedAt is null", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: null,
          isActive: true,
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].durationMinutes).toBeNull();
      });

      it("should compute exchange value from session_cards and snapshot_card_prices", async () => {
        const leagueId = await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          cardPrices: [
            {
              cardName: "The Doctor",
              priceSource: "exchange",
              chaosValue: 5000,
              divineValue: 25,
            },
            {
              cardName: "Rain of Chaos",
              priceSource: "exchange",
              chaosValue: 2,
              divineValue: 0.01,
            },
          ],
        });

        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          totalCount: 50,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        await seedSessionCards(testDb.kysely, sessionId, [
          { cardName: "The Doctor", count: 2 },
          { cardName: "Rain of Chaos", count: 10 },
        ]);

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        // Exchange value = (2 * 5000) + (10 * 2) = 10020
        expect(sessions[0].totalExchangeValue).toBe(10020);
      });

      it("should compute stash value from session_cards and snapshot_card_prices", async () => {
        const leagueId = await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          cardPrices: [
            {
              cardName: "The Doctor",
              priceSource: "stash",
              chaosValue: 4800,
              divineValue: 24,
            },
            {
              cardName: "Rain of Chaos",
              priceSource: "stash",
              chaosValue: 1.5,
              divineValue: 0.0075,
            },
          ],
        });

        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          totalCount: 50,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        await seedSessionCards(testDb.kysely, sessionId, [
          { cardName: "The Doctor", count: 2 },
          { cardName: "Rain of Chaos", count: 10 },
        ]);

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        // Stash value = (2 * 4800) + (10 * 1.5) = 9615
        expect(sessions[0].totalStashValue).toBe(9615);
      });

      it("should exclude hidden exchange-priced cards from exchange value", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          cardPrices: [
            {
              cardName: "The Doctor",
              priceSource: "exchange",
              chaosValue: 5000,
              divineValue: 25,
            },
            {
              cardName: "Rain of Chaos",
              priceSource: "exchange",
              chaosValue: 2,
              divineValue: 0.01,
            },
          ],
        });

        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          totalCount: 50,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        await seedSessionCards(testDb.kysely, sessionId, [
          { cardName: "The Doctor", count: 2, hidePriceExchange: true },
          { cardName: "Rain of Chaos", count: 10 },
        ]);

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        // Only Rain of Chaos counted: 10 * 2 = 20
        expect(sessions[0].totalExchangeValue).toBe(20);
      });

      it("should exclude hidden stash-priced cards from stash value", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          cardPrices: [
            {
              cardName: "The Doctor",
              priceSource: "stash",
              chaosValue: 4800,
              divineValue: 24,
            },
            {
              cardName: "Rain of Chaos",
              priceSource: "stash",
              chaosValue: 1.5,
              divineValue: 0.0075,
            },
          ],
        });

        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          totalCount: 50,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        await seedSessionCards(testDb.kysely, sessionId, [
          { cardName: "The Doctor", count: 2, hidePriceStash: true },
          { cardName: "Rain of Chaos", count: 10 },
        ]);

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        // Only Rain of Chaos counted: 10 * 1.5 = 15
        expect(sessions[0].totalStashValue).toBe(15);
      });

      it("should compute net profit as value minus deck cost", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          stackedDeckChaosCost: 3,
          cardPrices: [
            {
              cardName: "The Doctor",
              priceSource: "exchange",
              chaosValue: 5000,
              divineValue: 25,
            },
            {
              cardName: "The Doctor",
              priceSource: "stash",
              chaosValue: 4800,
              divineValue: 24,
            },
          ],
        });

        const sessionId = await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          totalCount: 100,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        await seedSessionCards(testDb.kysely, sessionId, [
          { cardName: "The Doctor", count: 1 },
        ]);

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        // Exchange net profit = 5000 - (3 * 100) = 4700
        expect(sessions[0].totalExchangeNetProfit).toBe(4700);
        // Stash net profit = 4800 - (3 * 100) = 4500
        expect(sessions[0].totalStashNetProfit).toBe(4500);
      });

      it("should use snapshot chaos-to-divine ratios when no summary exists", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        const snapshotId = await seedSnapshot(testDb.kysely, {
          leagueId,
          exchangeChaosToDivine: 210,
          stashChaosToDivine: 205,
          stackedDeckChaosCost: 4,
        });

        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          snapshotId,
          totalCount: 50,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].exchangeChaosToDivine).toBe(210);
        expect(sessions[0].stashChaosToDivine).toBe(205);
        expect(sessions[0].stackedDeckChaosCost).toBe(4);
      });

      it("should default to 0 for chaos-to-divine when no snapshot exists", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          // no snapshotId
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].exchangeChaosToDivine).toBe(0);
        expect(sessions[0].stashChaosToDivine).toBe(0);
        expect(sessions[0].stackedDeckChaosCost).toBe(0);
      });

      it("should return 0 for values when session has no cards and no snapshot", async () => {
        const leagueId = await seedLeague(testDb.kysely);
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          totalCount: 0,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].totalExchangeValue).toBe(0);
        expect(sessions[0].totalStashValue).toBe(0);
      });
    });

    describe("DTO structure", () => {
      it("should return DTOs with all expected fields", async () => {
        const leagueId = await seedLeague(testDb.kysely, {
          game: "poe1",
          name: "Settlers",
        });
        await seedSession(testDb.kysely, {
          game: "poe1",
          leagueId,
          isActive: false,
          startedAt: "2025-01-15T10:00:00Z",
          endedAt: "2025-01-15T11:00:00Z",
        });

        const sessions = await repository.getSessionsPage("poe1", 10, 0);

        expect(sessions).toHaveLength(1);
        const s = sessions[0];

        const expectedKeys = [
          "sessionId",
          "game",
          "league",
          "startedAt",
          "endedAt",
          "durationMinutes",
          "totalDecksOpened",
          "totalExchangeValue",
          "totalStashValue",
          "totalExchangeNetProfit",
          "totalStashNetProfit",
          "exchangeChaosToDivine",
          "stashChaosToDivine",
          "stackedDeckChaosCost",
          "isActive",
        ];

        expect(Object.keys(s).sort()).toEqual(expectedKeys.sort());
      });
    });
  });

  // ─── getSessionCards ─────────────────────────────────────────────────

  describe("getSessionCards", () => {
    it("should return empty array when session has no cards", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
      });

      const cards = await repository.getSessionCards(sessionId);
      expect(cards).toEqual([]);
    });

    it("should return empty array for non-existent session", async () => {
      const cards = await repository.getSessionCards("non-existent");
      expect(cards).toEqual([]);
    });

    it("should return cards with correctly mapped fields", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 3 },
        { cardName: "Rain of Chaos", count: 15 },
      ]);

      const cards = await repository.getSessionCards(sessionId);

      expect(cards).toHaveLength(2);

      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");

      expect(doctor).toBeDefined();
      expect(doctor!.count).toBe(3);
      expect(rain).toBeDefined();
      expect(rain!.count).toBe(15);
    });

    it("should convert hidePriceExchange and hidePriceStash to booleans", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
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

      const cards = await repository.getSessionCards(sessionId);

      const doctor = cards.find((c) => c.cardName === "The Doctor");
      const rain = cards.find((c) => c.cardName === "Rain of Chaos");

      expect(doctor!.hidePriceExchange).toBe(true);
      expect(doctor!.hidePriceStash).toBe(false);
      expect(typeof doctor!.hidePriceExchange).toBe("boolean");
      expect(typeof doctor!.hidePriceStash).toBe("boolean");

      expect(rain!.hidePriceExchange).toBe(false);
      expect(rain!.hidePriceStash).toBe(true);
    });

    it("should include divination card metadata when available", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const sessionId = await seedSession(testDb.kysely, {
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
        flavourHtml: "<i>Trust me</i>",
      });

      await seedDivinationCardRarity(testDb.kysely, {
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        rarity: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const cards = await repository.getSessionCards(sessionId);

      expect(cards).toHaveLength(1);
      expect(cards[0].divinationCard).toBeDefined();
      expect(cards[0].divinationCard!.stackSize).toBe(8);
      expect(cards[0].divinationCard!.description).toBe("A powerful card");
      expect(cards[0].divinationCard!.rewardHtml).toBe(
        "<span>Headhunter</span>",
      );
      expect(cards[0].divinationCard!.artSrc).toBe(
        "https://example.com/doctor.png",
      );
      expect(cards[0].divinationCard!.flavourHtml).toBe("<i>Trust me</i>");
      expect(cards[0].divinationCard!.rarity).toBe(1);
    });

    it("should default rarity to 4 when no rarity data exists", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
      });
      // No rarity data seeded

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const cards = await repository.getSessionCards(sessionId);

      expect(cards).toHaveLength(1);
      expect(cards[0].divinationCard).toBeDefined();
      expect(cards[0].divinationCard!.rarity).toBe(4);
    });

    it("should set divinationCard to undefined when no matching div card exists", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Unknown Card", count: 1 },
      ]);

      const cards = await repository.getSessionCards(sessionId);

      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("Unknown Card");
      expect(cards[0].divinationCard).toBeUndefined();
    });

    it("should only return cards for the specified session", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const session1 = await seedSession(testDb.kysely, {
        id: "s1",
        game: "poe1",
        leagueId,
      });
      const session2 = await seedSession(testDb.kysely, {
        id: "s2",
        game: "poe1",
        leagueId,
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);
      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "The Fiend", count: 2 },
      ]);

      const cards1 = await repository.getSessionCards(session1);
      const cards2 = await repository.getSessionCards(session2);

      expect(cards1).toHaveLength(2);
      expect(cards2).toHaveLength(1);
      expect(cards1.map((c) => c.cardName).sort()).toEqual([
        "Rain of Chaos",
        "The Doctor",
      ]);
      expect(cards2[0].cardName).toBe("The Fiend");
    });

    it("should match divination card by game correctly", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      // Card exists for poe1 but not poe2
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
      });

      const poe1Session = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: poe1League,
      });
      const poe2Session = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId: poe2League,
      });

      await seedSessionCards(testDb.kysely, poe1Session, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, poe2Session, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const poe1Cards = await repository.getSessionCards(poe1Session);
      const poe2Cards = await repository.getSessionCards(poe2Session);

      // poe1 should find divination card metadata
      expect(poe1Cards[0].divinationCard).toBeDefined();
      expect(poe1Cards[0].divinationCard!.stackSize).toBe(8);

      // poe2 should NOT find divination card metadata (it's only in poe1)
      expect(poe2Cards[0].divinationCard).toBeUndefined();
    });
  });

  // ─── searchSessionsByCard ────────────────────────────────────────────

  describe("searchSessionsByCard", () => {
    it("should return empty array when no sessions contain the card", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
        isActive: false,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      const results = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        10,
        0,
      );
      expect(results).toEqual([]);
    });

    it("should find sessions containing a card by exact name", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 50,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      const results = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        10,
        0,
      );

      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe(sessionId);
    });

    it("should perform partial matching (LIKE %name%)", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      // Searching with partial name
      const results = await repository.searchSessionsByCard(
        "poe1",
        "Doctor",
        10,
        0,
      );

      expect(results).toHaveLength(1);
    });

    it("should only return sessions for the specified game", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      const poe1Session = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: poe1League,
        totalCount: 10,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });
      const poe2Session = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId: poe2League,
        totalCount: 20,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, poe1Session, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, poe2Session, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const poe1Results = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        10,
        0,
      );
      const poe2Results = await repository.searchSessionsByCard(
        "poe2",
        "The Doctor",
        10,
        0,
      );

      expect(poe1Results).toHaveLength(1);
      expect(poe1Results[0].game).toBe("poe1");
      expect(poe2Results).toHaveLength(1);
      expect(poe2Results[0].game).toBe("poe2");
    });

    it("should only return sessions with total_count > 0", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      // Session with totalCount = 0 (empty session)
      const emptySession = await seedSession(testDb.kysely, {
        id: "empty",
        game: "poe1",
        leagueId,
        totalCount: 0,
        isActive: false,
        startedAt: "2025-01-14T10:00:00Z",
        endedAt: "2025-01-14T11:00:00Z",
      });

      // Session with totalCount > 0
      const fullSession = await seedSession(testDb.kysely, {
        id: "full",
        game: "poe1",
        leagueId,
        totalCount: 50,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, emptySession, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, fullSession, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const results = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        10,
        0,
      );

      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe("full");
    });

    it("should order results by started_at descending", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const oldSession = await seedSession(testDb.kysely, {
        id: "old",
        game: "poe1",
        leagueId,
        totalCount: 10,
        isActive: false,
        startedAt: "2025-01-10T10:00:00Z",
        endedAt: "2025-01-10T11:00:00Z",
      });
      const newSession = await seedSession(testDb.kysely, {
        id: "new",
        game: "poe1",
        leagueId,
        totalCount: 20,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, oldSession, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, newSession, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const results = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        10,
        0,
      );

      expect(results).toHaveLength(2);
      expect(results[0].sessionId).toBe("new");
      expect(results[1].sessionId).toBe("old");
    });

    it("should respect limit and offset for pagination", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      for (let i = 0; i < 5; i++) {
        const sessionId = await seedSession(testDb.kysely, {
          id: `session-${i}`,
          game: "poe1",
          leagueId,
          totalCount: 10,
          isActive: false,
          startedAt: `2025-01-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
          endedAt: `2025-01-${String(10 + i).padStart(2, "0")}T11:00:00Z`,
        });
        await seedSessionCards(testDb.kysely, sessionId, [
          { cardName: "The Doctor", count: 1 },
        ]);
      }

      const page1 = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        2,
        0,
      );
      const page2 = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        2,
        2,
      );
      const page3 = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        2,
        4,
      );

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page3).toHaveLength(1);

      expect(page1[0].sessionId).toBe("session-4");
      expect(page1[1].sessionId).toBe("session-3");
      expect(page2[0].sessionId).toBe("session-2");
      expect(page2[1].sessionId).toBe("session-1");
      expect(page3[0].sessionId).toBe("session-0");
    });

    it("should not return duplicate sessions when multiple cards match", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const sessionId = await seedSession(testDb.kysely, {
        id: "multi-card-session",
        game: "poe1",
        leagueId,
        totalCount: 50,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      // Multiple cards that all match "Rain"
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 10 },
        { cardName: "Raining Cats", count: 5 },
      ]);

      const results = await repository.searchSessionsByCard(
        "poe1",
        "Rain",
        10,
        0,
      );

      // Should be deduplicated via GROUP BY
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe("multi-card-session");
    });

    it("should return session summary DTOs with all expected fields", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
      });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 100,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const results = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        10,
        0,
      );

      expect(results).toHaveLength(1);
      const s = results[0];

      const expectedKeys = [
        "sessionId",
        "game",
        "league",
        "startedAt",
        "endedAt",
        "durationMinutes",
        "totalDecksOpened",
        "totalExchangeValue",
        "totalStashValue",
        "totalExchangeNetProfit",
        "totalStashNetProfit",
        "exchangeChaosToDivine",
        "stashChaosToDivine",
        "stackedDeckChaosCost",
        "isActive",
      ];

      expect(Object.keys(s).sort()).toEqual(expectedKeys.sort());
    });
  });

  // ─── getSessionCountByCard ───────────────────────────────────────────

  describe("getSessionCountByCard", () => {
    it("should return 0 when no sessions contain the card", async () => {
      const count = await repository.getSessionCountByCard(
        "poe1",
        "The Doctor",
      );
      expect(count).toBe(0);
    });

    it("should return the count of sessions containing the card", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const session1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
        isActive: false,
        startedAt: "2025-01-14T10:00:00Z",
        endedAt: "2025-01-14T11:00:00Z",
      });
      const session2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 20,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });
      const session3 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 30,
        isActive: false,
        startedAt: "2025-01-16T10:00:00Z",
        endedAt: "2025-01-16T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);
      await seedSessionCards(testDb.kysely, session3, [
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      const doctorCount = await repository.getSessionCountByCard(
        "poe1",
        "The Doctor",
      );
      const rainCount = await repository.getSessionCountByCard(
        "poe1",
        "Rain of Chaos",
      );

      expect(doctorCount).toBe(2);
      expect(rainCount).toBe(2);
    });

    it("should use partial matching (LIKE %name%)", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const count = await repository.getSessionCountByCard("poe1", "Doctor");
      expect(count).toBe(1);
    });

    it("should only count sessions for the specified game", async () => {
      const poe1League = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const poe2League = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Dawn",
      });

      const poe1Session = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId: poe1League,
        totalCount: 10,
        isActive: false,
      });
      const poe2Session = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId: poe2League,
        totalCount: 20,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, poe1Session, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, poe2Session, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const poe1Count = await repository.getSessionCountByCard(
        "poe1",
        "The Doctor",
      );
      const poe2Count = await repository.getSessionCountByCard(
        "poe2",
        "The Doctor",
      );

      expect(poe1Count).toBe(1);
      expect(poe2Count).toBe(1);
    });

    it("should only count sessions with total_count > 0", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const emptySession = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 0,
        isActive: false,
      });
      const fullSession = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, emptySession, [
        { cardName: "The Doctor", count: 1 },
      ]);
      await seedSessionCards(testDb.kysely, fullSession, [
        { cardName: "The Doctor", count: 2 },
      ]);

      const count = await repository.getSessionCountByCard(
        "poe1",
        "The Doctor",
      );
      expect(count).toBe(1);
    });

    it("should not double-count sessions with multiple matching cards", async () => {
      const leagueId = await seedLeague(testDb.kysely, { name: "Settlers" });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 50,
        isActive: false,
      });

      // Two cards both matching "Rain"
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 10 },
        { cardName: "Raining Cats", count: 5 },
      ]);

      const count = await repository.getSessionCountByCard("poe1", "Rain");
      // grouped by session id, so result.length should be 1
      expect(count).toBe(1);
    });
  });

  // ─── Integration / Realistic Scenarios ───────────────────────────────

  describe("integration scenarios", () => {
    it("should correctly compute all values for a full session with cards and snapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 25,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 4800,
            divineValue: 24,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 2,
            divineValue: 0.01,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "stash",
            chaosValue: 1.5,
            divineValue: 0.0075,
          },
        ],
      });

      const sessionId = await seedSession(testDb.kysely, {
        id: "full-session",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        totalCount: 200,
        isActive: false,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 50 },
      ]);

      const sessions = await repository.getSessionsPage("poe1", 10, 0);

      expect(sessions).toHaveLength(1);
      const s = sessions[0];

      expect(s.sessionId).toBe("full-session");
      expect(s.game).toBe("poe1");
      expect(s.league).toBe("Settlers");
      expect(s.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(s.endedAt).toBe("2025-01-15T11:30:00Z");
      expect(s.durationMinutes).toBe(90);
      expect(s.totalDecksOpened).toBe(200);
      expect(s.isActive).toBe(false);

      // Exchange value: (1 * 5000) + (50 * 2) = 5100
      expect(s.totalExchangeValue).toBe(5100);
      // Stash value: (1 * 4800) + (50 * 1.5) = 4875
      expect(s.totalStashValue).toBe(4875);

      // Exchange net profit: 5100 - (3 * 200) = 4500
      expect(s.totalExchangeNetProfit).toBe(4500);
      // Stash net profit: 4875 - (3 * 200) = 4275
      expect(s.totalStashNetProfit).toBe(4275);

      expect(s.exchangeChaosToDivine).toBe(200);
      expect(s.stashChaosToDivine).toBe(195);
      expect(s.stackedDeckChaosCost).toBe(3);
    });

    it("should handle a session with negative net profit (bad luck run)", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        stackedDeckChaosCost: 5,
        cardPrices: [
          {
            cardName: "Rain of Chaos",
            priceSource: "exchange",
            chaosValue: 2,
            divineValue: 0.01,
          },
          {
            cardName: "Rain of Chaos",
            priceSource: "stash",
            chaosValue: 1.5,
            divineValue: 0.0075,
          },
        ],
      });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 100,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 80 },
      ]);

      const sessions = await repository.getSessionsPage("poe1", 10, 0);

      expect(sessions).toHaveLength(1);
      // Exchange value: 80 * 2 = 160
      // Exchange net profit: 160 - (5 * 100) = -340
      expect(sessions[0].totalExchangeValue).toBe(160);
      expect(sessions[0].totalExchangeNetProfit).toBe(-340);

      // Stash value: 80 * 1.5 = 120
      // Stash net profit: 120 - (5 * 100) = -380
      expect(sessions[0].totalStashValue).toBe(120);
      expect(sessions[0].totalStashNetProfit).toBe(-380);
    });

    it("should handle multiple sessions across different leagues", async () => {
      const settlersId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const standardId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Standard",
      });

      await seedSession(testDb.kysely, {
        id: "settlers-session",
        game: "poe1",
        leagueId: settlersId,
        totalCount: 100,
        isActive: false,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
      });
      await seedSession(testDb.kysely, {
        id: "standard-session",
        game: "poe1",
        leagueId: standardId,
        totalCount: 50,
        isActive: false,
        startedAt: "2025-01-14T10:00:00Z",
        endedAt: "2025-01-14T11:00:00Z",
      });

      const sessions = await repository.getSessionsPage("poe1", 10, 0);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe("settlers-session");
      expect(sessions[0].league).toBe("Settlers");
      expect(sessions[1].sessionId).toBe("standard-session");
      expect(sessions[1].league).toBe("Standard");
    });

    it("should support getSessionById + getSessionCards together", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      const sessionId = await seedSession(testDb.kysely, {
        id: "detail-session",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T12:00:00Z",
        totalCount: 75,
        isActive: false,
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 30 },
      ]);

      // Get session details
      const details = await repository.getSessionById(sessionId);
      expect(details).not.toBeNull();
      expect(details!.id).toBe("detail-session");
      expect(details!.league).toBe("Settlers");
      expect(details!.totalCount).toBe(75);

      // Get session cards
      const cards = await repository.getSessionCards(sessionId);
      expect(cards).toHaveLength(2);

      const doctor = cards.find((c) => c.cardName === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.count).toBe(2);
      expect(doctor!.divinationCard).toBeDefined();
      expect(doctor!.divinationCard!.stackSize).toBe(8);

      const rain = cards.find((c) => c.cardName === "Rain of Chaos");
      expect(rain).toBeDefined();
      expect(rain!.count).toBe(30);
      expect(rain!.divinationCard).toBeUndefined();
    });

    it("should correctly count and paginate across all query methods", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // Create 5 sessions, 3 with "The Doctor"
      for (let i = 0; i < 5; i++) {
        const sessionId = await seedSession(testDb.kysely, {
          id: `session-${i}`,
          game: "poe1",
          leagueId,
          totalCount: 10 * (i + 1),
          isActive: false,
          startedAt: `2025-01-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
          endedAt: `2025-01-${String(10 + i).padStart(2, "0")}T11:00:00Z`,
        });

        const cards =
          i < 3
            ? [
                { cardName: "The Doctor", count: 1 },
                { cardName: "Rain of Chaos", count: 5 },
              ]
            : [{ cardName: "Rain of Chaos", count: 10 }];

        await seedSessionCards(testDb.kysely, sessionId, cards);
      }

      // Total session count
      const totalCount = await repository.getSessionCount("poe1");
      expect(totalCount).toBe(5);

      // Total sessions with The Doctor
      const doctorCount = await repository.getSessionCountByCard(
        "poe1",
        "The Doctor",
      );
      expect(doctorCount).toBe(3);

      // Search for Doctor sessions, paginated
      const doctorPage1 = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        2,
        0,
      );
      const doctorPage2 = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        2,
        2,
      );

      expect(doctorPage1).toHaveLength(2);
      expect(doctorPage2).toHaveLength(1);

      // All sessions page
      const allSessions = await repository.getSessionsPage("poe1", 10, 0);
      expect(allSessions).toHaveLength(5);
    });
  });
});
