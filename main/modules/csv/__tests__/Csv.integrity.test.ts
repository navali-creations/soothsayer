import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedCards,
  seedCsvExportSnapshot,
  seedLeague,
  seedSession,
  seedSessionCards,
} from "~/main/modules/__test-utils__/create-test-db";
import type { Database } from "~/main/modules/database";

import { CsvIntegrityCheck, CsvIntegrityStatus } from "../Csv.dto";
import { CsvIntegrityChecker } from "../Csv.integrity";
import { CsvRepository } from "../Csv.repository";

describe("CsvIntegrityChecker", () => {
  let testDb: ReturnType<typeof createTestDatabase>;
  let repository: CsvRepository;
  let checker: CsvIntegrityChecker;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new CsvRepository(
      testDb.kysely as unknown as Kysely<Database>,
    );
    checker = new CsvIntegrityChecker(repository);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ============================================================================
  // runChecks — aggregate behavior
  // ============================================================================

  describe("runChecks", () => {
    it("should return pass when all checks pass", async () => {
      // Seed consistent data: all-time cards, global counter, no sessions, no leagues, no snapshot
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 10 },
      ]);

      // Set global counter to >= all-time total (15)
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 20 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5, "Rain of Chaos": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      expect(result.status).toBe(CsvIntegrityStatus.Pass);
      expect(result.details).toHaveLength(4);
      expect(
        result.details.every((d) => d.status === CsvIntegrityStatus.Pass),
      ).toBe(true);
    });

    it("should return warn when a soft check fails", async () => {
      // All-time total exceeds global counter → warn
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 100 },
      ]);

      // Global counter is 0 (default), which is < 100 → warn
      const currentCounts = { "The Doctor": 100 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      expect(result.status).toBe(CsvIntegrityStatus.Warn);
      expect(
        result.details.some((d) => d.status === CsvIntegrityStatus.Warn),
      ).toBe(true);
    });

    it("should return fail when a hard check fails", async () => {
      // Create a prior snapshot with higher counts than current → fail
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 10,
          totalCount: 10,
          exportedAt: "2025-06-01T10:00:00.000Z",
        },
      ]);

      // Set global counter high enough to pass soft checks
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Current count is less than snapshot → fail
      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      expect(result.status).toBe(CsvIntegrityStatus.Fail);
      const snapshotCheck = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(snapshotCheck?.status).toBe(CsvIntegrityStatus.Fail);
    });

    it("should return fail even when some checks pass and one fails", async () => {
      // Set up passing data for most checks
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 10 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // But snapshot has higher count → fail (hard check)
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 20,
          totalCount: 20,
        },
      ]);

      const currentCounts = { "The Doctor": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      expect(result.status).toBe(CsvIntegrityStatus.Fail);
      // Some checks should still pass
      const passingChecks = result.details.filter(
        (d) => d.status === CsvIntegrityStatus.Pass,
      );
      expect(passingChecks.length).toBeGreaterThan(0);
    });

    it("should always return exactly 4 check details", async () => {
      const result = await checker.runChecks("poe1", "all-time", {});
      expect(result.details).toHaveLength(4);

      const checkNames = result.details.map((d) => d.check);
      expect(checkNames).toContain(CsvIntegrityCheck.AllTimeVsSessionCards);
      expect(checkNames).toContain(CsvIntegrityCheck.AllTimeVsGlobalCounter);
      expect(checkNames).toContain(CsvIntegrityCheck.AllTimeVsLeagueSum);
      expect(checkNames).toContain(CsvIntegrityCheck.SnapshotNonDecreasing);
    });

    it("should handle empty current counts", async () => {
      const result = await checker.runChecks("poe1", "all-time", {});

      expect(result.status).toBe(CsvIntegrityStatus.Pass);
      expect(result.details).toHaveLength(4);
    });

    it("should isolate checks by game", async () => {
      // poe1 has all-time cards
      await seedCards(testDb.kysely, [
        { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 5 },
      ]);

      // poe2 has no all-time cards, but we pass counts for poe2
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const result = await checker.runChecks("poe2", "all-time", {
        "The Doctor": 5,
      });

      // poe2 has no cards in DB but currentCounts has 5 → checks should still work
      expect(result.details).toHaveLength(4);
    });
  });

  // ============================================================================
  // allTimeVsSessionCards check
  // ============================================================================

  describe("allTimeVsSessionCards", () => {
    it("should pass when session card totals are less than all-time", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 8,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 3 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      // Seed all-time cards in DB (total = 15)
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 10 },
      ]);

      // Global counter high enough
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // All-time total is 15 (from cards table), session total is 8 → pass
      const currentCounts = { "The Doctor": 5, "Rain of Chaos": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.actual).toBe(8);
      expect(check?.expected).toBe(15);
    });

    it("should pass when session total equals all-time total", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 10,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 5 },
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      // Seed all-time cards in DB (total = 10)
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 5 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5, "Rain of Chaos": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should warn when session card totals exceed all-time", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 20,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 12 },
        { cardName: "Rain of Chaos", count: 8 },
      ]);

      // Seed all-time cards in DB (total = 10, less than session total of 20)
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 5 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // All-time total is only 10 (from cards table), but sessions have 20 → warn
      const currentCounts = { "The Doctor": 5, "Rain of Chaos": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Warn);
      expect(check?.actual).toBe(20);
      expect(check?.expected).toBe(10);
      expect(check?.message).toContain("exceeds");
    });

    it("should pass when there are no sessions", async () => {
      // Seed all-time cards in DB
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.actual).toBe(0);
    });

    it("should aggregate across multiple sessions", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      const session1 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 5,
      });
      await seedSessionCards(testDb.kysely, session1, [
        { cardName: "The Doctor", count: 5 },
      ]);

      const session2 = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        totalCount: 3,
      });
      await seedSessionCards(testDb.kysely, session2, [
        { cardName: "The Doctor", count: 3 },
      ]);

      // Seed all-time cards in DB (total = 10)
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 10 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Total sessions: 8. All-time from cards table: 10 → pass
      const currentCounts = { "The Doctor": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.actual).toBe(8);
    });

    it("should not count sessions from a different game", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Settlers",
      });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId,
        totalCount: 100,
      });
      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 100 },
      ]);

      // Seed all-time cards for poe1 in DB
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 200 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Checking poe1 — should not see poe2 sessions
      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.actual).toBe(0);
    });
  });

  // ============================================================================
  // allTimeVsGlobalCounter check
  // ============================================================================

  describe("allTimeVsGlobalCounter", () => {
    it("should pass when all-time total is less than global counter", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 10 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 20 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5, "Rain of Chaos": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsGlobalCounter,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.expected).toBe(20);
      expect(check?.actual).toBe(15);
    });

    it("should pass when all-time total equals global counter", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 15 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 15 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 15 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsGlobalCounter,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should warn when all-time total exceeds global counter", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 50 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 30 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 50 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsGlobalCounter,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Warn);
      expect(check?.expected).toBe(30);
      expect(check?.actual).toBe(50);
      expect(check?.message).toContain("exceeds");
    });

    it("should pass when global counter is 0 and no all-time cards exist", async () => {
      const currentCounts = {};
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsGlobalCounter,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.expected).toBe(0);
      expect(check?.actual).toBe(0);
    });

    it("should only count all-time cards for the specified game", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 10,
        },
        {
          game: "poe2",
          scope: "all-time",
          cardName: "The Doctor",
          count: 50,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 15 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Checking poe1 — should only see poe1's 10, not poe2's 50
      const currentCounts = { "The Doctor": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsGlobalCounter,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.actual).toBe(10);
    });
  });

  // ============================================================================
  // allTimeVsLeagueSum check
  // ============================================================================

  describe("allTimeVsLeagueSum", () => {
    it("should pass when all-time counts are >= league sums", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 10 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 20 },
        { scope: "Settlers", cardName: "The Doctor", count: 5 },
        { scope: "Settlers", cardName: "Rain of Chaos", count: 10 },
        { scope: "Keepers", cardName: "The Doctor", count: 3 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 10, "Rain of Chaos": 20 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.message).toContain("All card");
    });

    it("should pass when all-time count equals league sum exactly", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 8 },
        { scope: "Settlers", cardName: "The Doctor", count: 5 },
        { scope: "Keepers", cardName: "The Doctor", count: 3 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 8 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should warn when a league sum exceeds all-time count", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
        { scope: "Settlers", cardName: "The Doctor", count: 8 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Warn);
      expect(check?.actual).toBe(1);
      expect(check?.message).toContain("The Doctor");
      expect(check?.message).toContain("league sum 8 > all-time 5");
    });

    it("should warn when multiple cards have league sums exceeding all-time", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 3 },
        { scope: "all-time", cardName: "Rain of Chaos", count: 4 },
        { scope: "Settlers", cardName: "The Doctor", count: 5 },
        { scope: "Settlers", cardName: "Rain of Chaos", count: 6 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 3, "Rain of Chaos": 4 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Warn);
      expect(check?.actual).toBe(2);
      expect(check?.message).toContain("2 card(s)");
    });

    it("should pass when card exists in league but not in all-time with 0", async () => {
      // Card exists only in league scope, not in all-time
      await seedCards(testDb.kysely, [
        { scope: "Settlers", cardName: "The Doctor", count: 5 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = {};
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      // league sum (5) > all-time (0) → warn
      expect(check?.status).toBe(CsvIntegrityStatus.Warn);
    });

    it("should pass when no league data exists", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 10 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should only consider league data for the specified game", async () => {
      await seedCards(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
        },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 3,
        },
        // poe2 has league count exceeding poe1's all-time — should not affect poe1's check
        {
          game: "poe2",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 100,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 200 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should aggregate across multiple leagues for the same card", async () => {
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 10 },
        { scope: "Settlers", cardName: "The Doctor", count: 4 },
        { scope: "Keepers", cardName: "The Doctor", count: 4 },
        { scope: "Necropolis", cardName: "The Doctor", count: 4 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // League sum: 4+4+4=12 > all-time 10 → warn
      const currentCounts = { "The Doctor": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsLeagueSum,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Warn);
      expect(check?.message).toContain("league sum 12 > all-time 10");
    });
  });

  // ============================================================================
  // snapshotNonDecreasing check
  // ============================================================================

  describe("snapshotNonDecreasing", () => {
    it("should pass when no prior snapshot exists (first export)", async () => {
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.message).toContain("first export");
    });

    it("should pass when current counts are greater than snapshot", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 10 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.message).toContain("non-decreasing");
    });

    it("should pass when current counts equal snapshot counts", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should fail when current count is less than snapshot count", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 10,
          totalCount: 10,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 7 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Fail);
      expect(check?.actual).toBe(1);
      expect(check?.message).toContain("The Doctor");
      expect(check?.message).toContain("was 10, now 7");
    });

    it("should fail when a card from snapshot is missing in current counts", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Card is completely missing from current counts (effectively 0)
      const currentCounts = {};
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Fail);
      expect(check?.message).toContain("was 5, now 0");
    });

    it("should detect multiple cards with decreased counts", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 10,
          totalCount: 25,
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 15,
          totalCount: 25,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5, "Rain of Chaos": 8 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Fail);
      expect(check?.actual).toBe(2);
      expect(check?.message).toContain("2 card(s)");
    });

    it("should only compare against snapshot for the same game and scope", async () => {
      // Snapshot for poe1 all-time with count 20
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 20,
          totalCount: 20,
        },
      ]);

      // Snapshot for poe1 Settlers with count 50
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 50,
          totalCount: 50,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 200 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Check poe1 all-time — should compare against 20, not 50
      const currentCounts = { "The Doctor": 25 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should not compare against snapshot from a different game", async () => {
      // poe2 snapshot has high count
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe2",
          scope: "all-time",
          cardName: "The Doctor",
          count: 100,
          totalCount: 100,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 200 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Check poe1 — no poe1 snapshot exists, so should pass
      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
      expect(check?.message).toContain("first export");
    });

    it("should pass when some snapshot cards increased and new cards appeared", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Doctor increased, Rain of Chaos is new (not in snapshot)
      const currentCounts = { "The Doctor": 8, "Rain of Chaos": 3 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should handle league scope snapshots", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 10,
          totalCount: 10,
        },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      // Checking Settlers scope — count decreased → fail
      const currentCounts = { "The Doctor": 7 };
      const result = await checker.runChecks("poe1", "Settlers", currentCounts);

      const check = result.details.find(
        (d) => d.check === CsvIntegrityCheck.SnapshotNonDecreasing,
      );
      expect(check?.status).toBe(CsvIntegrityStatus.Fail);
    });
  });

  // ============================================================================
  // Status aggregation
  // ============================================================================

  describe("status aggregation", () => {
    it("should return pass when all checks pass", async () => {
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const result = await checker.runChecks("poe1", "all-time", {});
      expect(result.status).toBe(CsvIntegrityStatus.Pass);
    });

    it("should return warn as worst status when there is a warn but no fail", async () => {
      // All-time count exceeds global counter → warn
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 200 },
      ]);

      // Global counter is only 50
      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 50 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 200 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      expect(result.status).toBe(CsvIntegrityStatus.Warn);
      // No fail checks
      expect(
        result.details.some((d) => d.status === CsvIntegrityStatus.Fail),
      ).toBe(false);
    });

    it("should return fail when there is at least one fail", async () => {
      // Set up a snapshot decrease (fail) plus warn on global counter
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 100,
          totalCount: 100,
        },
      ]);

      // Global counter is 0 → warn
      // Snapshot decreased → fail
      const currentCounts = { "The Doctor": 50 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      expect(result.status).toBe(CsvIntegrityStatus.Fail);
      expect(
        result.details.some((d) => d.status === CsvIntegrityStatus.Fail),
      ).toBe(true);
    });
  });

  // ============================================================================
  // Detail structure
  // ============================================================================

  describe("detail structure", () => {
    it("should include check name, status, and message in every detail", async () => {
      const result = await checker.runChecks("poe1", "all-time", {});

      for (const detail of result.details) {
        expect(detail.check).toBeDefined();
        expect(detail.check).toBeTypeOf("string");
        expect(detail.status).toBeDefined();
        expect([
          CsvIntegrityStatus.Pass,
          CsvIntegrityStatus.Warn,
          CsvIntegrityStatus.Fail,
        ]).toContain(detail.status);
        expect(detail.message).toBeDefined();
        expect(detail.message).toBeTypeOf("string");
        expect(detail.message.length).toBeGreaterThan(0);
      }
    });

    it("should include expected and actual values in passing numeric checks", async () => {
      // Seed all-time cards so allTimeVsSessionCards reads from DB
      await seedCards(testDb.kysely, [
        { scope: "all-time", cardName: "The Doctor", count: 5 },
      ]);

      await testDb.kysely
        .updateTable("global_stats")
        .set({ value: 100 })
        .where("key", "=", "totalStackedDecksOpened")
        .execute();

      const currentCounts = { "The Doctor": 5 };
      const result = await checker.runChecks("poe1", "all-time", currentCounts);

      const sessionCheck = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsSessionCards,
      );
      expect(sessionCheck?.expected).toBeDefined();
      expect(sessionCheck?.actual).toBeDefined();

      const globalCheck = result.details.find(
        (d) => d.check === CsvIntegrityCheck.AllTimeVsGlobalCounter,
      );
      expect(globalCheck?.expected).toBeDefined();
      expect(globalCheck?.actual).toBeDefined();
    });
  });
});
