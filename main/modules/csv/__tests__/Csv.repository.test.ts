import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedCsvExportSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { CsvIntegrityStatus } from "../Csv.dto";
import { CsvRepository } from "../Csv.repository";

describe("CsvRepository", () => {
  let testDb: TestDatabase;
  let repository: CsvRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new CsvRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── getSnapshot ──────────────────────────────────────────────────────────

  describe("getSnapshot", () => {
    it("should return an empty array when no snapshots exist", async () => {
      const result = await repository.getSnapshot("poe1", "all-time");

      expect(result).toEqual([]);
    });

    it("should return snapshot rows for the given game and scope", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 12,
          exportedAt: "2025-06-01T10:00:00.000Z",
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 7,
          totalCount: 12,
          exportedAt: "2025-06-01T10:00:00.000Z",
        },
      ]);

      const result = await repository.getSnapshot("poe1", "all-time");

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(
        expect.objectContaining({
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 12,
          exportedAt: "2025-06-01T10:00:00.000Z",
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 7,
          totalCount: 12,
          exportedAt: "2025-06-01T10:00:00.000Z",
        })
      );
    });

    it("should not return snapshots for a different game", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe2",
          scope: "all-time",
          cardName: "The Doctor",
          count: 3,
          totalCount: 3,
        },
      ]);

      const result = await repository.getSnapshot("poe1", "all-time");

      expect(result).toEqual([]);
    });

    it("should not return snapshots for a different scope", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 3,
          totalCount: 3,
        },
      ]);

      const result = await repository.getSnapshot("poe1", "all-time");

      expect(result).toEqual([]);
    });

    it("should return DTOs with correct field mapping", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "House of Mirrors",
          count: 1,
          totalCount: 1,
          exportedAt: "2025-06-01T12:00:00.000Z",
          integrityStatus: CsvIntegrityStatus.Pass,
          integrityDetails: '{"check":"ok"}',
        },
      ]);

      const result = await repository.getSnapshot("poe1", "all-time");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        game: "poe1",
        scope: "all-time",
        cardName: "House of Mirrors",
        count: 1,
        totalCount: 1,
        exportedAt: "2025-06-01T12:00:00.000Z",
        integrityStatus: CsvIntegrityStatus.Pass,
        integrityDetails: '{"check":"ok"}',
      });
    });
  });

  // ─── getSnapshotMeta ──────────────────────────────────────────────────────

  describe("getSnapshotMeta", () => {
    it("should return null when no snapshots exist", async () => {
      const result = await repository.getSnapshotMeta("poe1", "all-time");

      expect(result).toBeNull();
    });

    it("should return the total count and exported timestamp", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 12,
          exportedAt: "2025-06-01T10:00:00.000Z",
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "Rain of Chaos",
          count: 7,
          totalCount: 12,
          exportedAt: "2025-06-01T10:00:00.000Z",
        },
      ]);

      const result = await repository.getSnapshotMeta("poe1", "all-time");

      expect(result).not.toBeNull();
      // totalCount is the SUM of all per-card counts
      expect(result!.totalCount).toBe(12);
      expect(result!.exportedAt).toBe("2025-06-01T10:00:00.000Z");
    });

    it("should return null for a different game", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe2",
          scope: "all-time",
          cardName: "The Doctor",
          count: 3,
          totalCount: 3,
        },
      ]);

      const result = await repository.getSnapshotMeta("poe1", "all-time");

      expect(result).toBeNull();
    });

    it("should return null for a different scope", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 3,
          totalCount: 3,
        },
      ]);

      const result = await repository.getSnapshotMeta("poe1", "all-time");

      expect(result).toBeNull();
    });

    it("should return the latest exported_at when rows have different timestamps", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 5,
          totalCount: 8,
          exportedAt: "2025-06-01T10:00:00.000Z",
        },
      ]);

      // Insert a second row with a later timestamp (simulating a separate insert)
      await testDb.kysely
        .insertInto("csv_export_snapshots")
        .values({
          game: "poe1",
          scope: "all-time",
          card_name: "Rain of Chaos",
          count: 3,
          total_count: 8,
          exported_at: "2025-06-02T14:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
        })
        .execute();

      const result = await repository.getSnapshotMeta("poe1", "all-time");

      expect(result).not.toBeNull();
      expect(result!.totalCount).toBe(8);
      // Should return the MAX exported_at
      expect(result!.exportedAt).toBe("2025-06-02T14:00:00.000Z");
    });
  });

  // ─── saveSnapshot ─────────────────────────────────────────────────────────

  describe("saveSnapshot", () => {
    it("should insert new snapshot rows", async () => {
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 5 },
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      const rows = await repository.getSnapshot("poe1", "all-time");

      expect(rows).toHaveLength(2);
      expect(rows).toContainEqual(
        expect.objectContaining({
          cardName: "The Doctor",
          count: 5,
          totalCount: 15,
        })
      );
      expect(rows).toContainEqual(
        expect.objectContaining({
          cardName: "Rain of Chaos",
          count: 10,
          totalCount: 15,
        })
      );
    });

    it("should set exported_at on all rows", async () => {
      const before = new Date().toISOString();

      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 1 },
      ]);

      const after = new Date().toISOString();

      const rows = await repository.getSnapshot("poe1", "all-time");
      expect(rows).toHaveLength(1);
      expect(rows[0].exportedAt >= before).toBe(true);
      expect(rows[0].exportedAt <= after).toBe(true);
    });

    it("should upsert (overwrite) existing rows on conflict", async () => {
      // Insert initial snapshot
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 3 },
        { cardName: "Rain of Chaos", count: 7 },
      ]);

      // Overwrite with updated counts
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 8 },
        { cardName: "Rain of Chaos", count: 12 },
        { cardName: "The Nurse", count: 2 },
      ]);

      const rows = await repository.getSnapshot("poe1", "all-time");

      expect(rows).toHaveLength(3);
      expect(rows).toContainEqual(
        expect.objectContaining({
          cardName: "The Doctor",
          count: 8,
          totalCount: 22, // 8 + 12 + 2
        })
      );
      expect(rows).toContainEqual(
        expect.objectContaining({
          cardName: "Rain of Chaos",
          count: 12,
          totalCount: 22,
        })
      );
      expect(rows).toContainEqual(
        expect.objectContaining({
          cardName: "The Nurse",
          count: 2,
          totalCount: 22,
        })
      );
    });

    it("should persist integrity status and details", async () => {
      await repository.saveSnapshot(
        "poe1",
        "all-time",
        [{ cardName: "The Doctor", count: 5 }],
        CsvIntegrityStatus.Pass,
        '{"allTimeVsGlobal":"ok","allTimeVsLeagues":"ok"}'
      );

      const rows = await repository.getSnapshot("poe1", "all-time");

      expect(rows).toHaveLength(1);
      expect(rows[0].integrityStatus).toBe(CsvIntegrityStatus.Pass);
      expect(rows[0].integrityDetails).toBe(
        '{"allTimeVsGlobal":"ok","allTimeVsLeagues":"ok"}'
      );
    });

    it("should update integrity fields on upsert", async () => {
      // Initial save with no integrity data
      await repository.saveSnapshot(
        "poe1",
        "all-time",
        [{ cardName: "The Doctor", count: 5 }],
        null,
        null
      );

      // Update with integrity data
      await repository.saveSnapshot(
        "poe1",
        "all-time",
        [{ cardName: "The Doctor", count: 8 }],
        CsvIntegrityStatus.Warn,
        '{"processedIdsMismatch":true}'
      );

      const rows = await repository.getSnapshot("poe1", "all-time");

      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(8);
      expect(rows[0].integrityStatus).toBe(CsvIntegrityStatus.Warn);
      expect(rows[0].integrityDetails).toBe('{"processedIdsMismatch":true}');
    });

    it("should do nothing when entries array is empty", async () => {
      await repository.saveSnapshot("poe1", "all-time", []);

      const rows = await repository.getSnapshot("poe1", "all-time");

      expect(rows).toEqual([]);
    });

    it("should keep snapshots for different scopes separate", async () => {
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 10 },
      ]);
      await repository.saveSnapshot("poe1", "Settlers", [
        { cardName: "The Doctor", count: 3 },
      ]);

      const allTime = await repository.getSnapshot("poe1", "all-time");
      const settlers = await repository.getSnapshot("poe1", "Settlers");

      expect(allTime).toHaveLength(1);
      expect(allTime[0].count).toBe(10);
      expect(allTime[0].totalCount).toBe(10);

      expect(settlers).toHaveLength(1);
      expect(settlers[0].count).toBe(3);
      expect(settlers[0].totalCount).toBe(3);
    });

    it("should keep snapshots for different games separate", async () => {
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 10 },
      ]);
      await repository.saveSnapshot("poe2", "all-time", [
        { cardName: "The Doctor", count: 2 },
      ]);

      const poe1 = await repository.getSnapshot("poe1", "all-time");
      const poe2 = await repository.getSnapshot("poe2", "all-time");

      expect(poe1).toHaveLength(1);
      expect(poe1[0].count).toBe(10);

      expect(poe2).toHaveLength(1);
      expect(poe2[0].count).toBe(2);
    });
  });

  // ─── deleteSnapshotsByScope ───────────────────────────────────────────────

  describe("deleteSnapshotsByScope", () => {
    it("should delete all snapshot rows for the given scope", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 5,
          totalCount: 8,
        },
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "Rain of Chaos",
          count: 3,
          totalCount: 8,
        },
      ]);

      await repository.deleteSnapshotsByScope("Settlers");

      const result = await repository.getSnapshot("poe1", "Settlers");
      expect(result).toEqual([]);
    });

    it("should not affect snapshots for other scopes", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 10,
          totalCount: 10,
        },
      ]);

      await repository.deleteSnapshotsByScope("Settlers");

      const settlers = await repository.getSnapshot("poe1", "Settlers");
      const allTime = await repository.getSnapshot("poe1", "all-time");

      expect(settlers).toEqual([]);
      expect(allTime).toHaveLength(1);
      expect(allTime[0].count).toBe(10);
    });

    it("should delete across all games for the given scope", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
        {
          game: "poe2",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 3,
          totalCount: 3,
        },
      ]);

      await repository.deleteSnapshotsByScope("Settlers");

      const poe1 = await repository.getSnapshot("poe1", "Settlers");
      const poe2 = await repository.getSnapshot("poe2", "Settlers");

      expect(poe1).toEqual([]);
      expect(poe2).toEqual([]);
    });

    it("should be a no-op when no matching rows exist", async () => {
      // Should not throw
      await repository.deleteSnapshotsByScope("NonExistent");

      const result = await repository.getSnapshot("poe1", "NonExistent");
      expect(result).toEqual([]);
    });
  });

  // ─── deleteSnapshotsByGameAndScope ────────────────────────────────────────

  describe("deleteSnapshotsByGameAndScope", () => {
    it("should delete snapshot rows for the specific game and scope", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
        {
          game: "poe2",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 3,
          totalCount: 3,
        },
      ]);

      await repository.deleteSnapshotsByGameAndScope("poe1", "Settlers");

      const poe1 = await repository.getSnapshot("poe1", "Settlers");
      const poe2 = await repository.getSnapshot("poe2", "Settlers");

      expect(poe1).toEqual([]);
      // poe2 should not be affected
      expect(poe2).toHaveLength(1);
      expect(poe2[0].count).toBe(3);
    });

    it("should not affect other scopes for the same game", async () => {
      await seedCsvExportSnapshot(testDb.kysely, [
        {
          game: "poe1",
          scope: "Settlers",
          cardName: "The Doctor",
          count: 5,
          totalCount: 5,
        },
        {
          game: "poe1",
          scope: "all-time",
          cardName: "The Doctor",
          count: 10,
          totalCount: 10,
        },
      ]);

      await repository.deleteSnapshotsByGameAndScope("poe1", "Settlers");

      const settlers = await repository.getSnapshot("poe1", "Settlers");
      const allTime = await repository.getSnapshot("poe1", "all-time");

      expect(settlers).toEqual([]);
      expect(allTime).toHaveLength(1);
      expect(allTime[0].count).toBe(10);
    });

    it("should be a no-op when no matching rows exist", async () => {
      await repository.deleteSnapshotsByGameAndScope("poe1", "NonExistent");

      const result = await repository.getSnapshot("poe1", "NonExistent");
      expect(result).toEqual([]);
    });
  });

  // ─── Multi-scope / Multi-game Isolation ───────────────────────────────────

  describe("multi-scope and multi-game isolation", () => {
    it("should maintain independent snapshots across games and scopes", async () => {
      // Save snapshots for different game+scope combinations
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 10 },
        { cardName: "Rain of Chaos", count: 20 },
      ]);
      await repository.saveSnapshot("poe1", "Settlers", [
        { cardName: "The Doctor", count: 3 },
      ]);
      await repository.saveSnapshot("poe2", "all-time", [
        { cardName: "The Doctor", count: 1 },
      ]);

      // Verify each game+scope has its own snapshot
      const poe1AllTime = await repository.getSnapshot("poe1", "all-time");
      const poe1Settlers = await repository.getSnapshot("poe1", "Settlers");
      const poe2AllTime = await repository.getSnapshot("poe2", "all-time");
      const poe2Settlers = await repository.getSnapshot("poe2", "Settlers");

      expect(poe1AllTime).toHaveLength(2);
      expect(poe1Settlers).toHaveLength(1);
      expect(poe2AllTime).toHaveLength(1);
      expect(poe2Settlers).toHaveLength(0);

      // Verify counts are independent
      const poe1Doctor = poe1AllTime.find((r) => r.cardName === "The Doctor");
      expect(poe1Doctor!.count).toBe(10);
      expect(poe1Doctor!.totalCount).toBe(30);

      expect(poe1Settlers[0].count).toBe(3);
      expect(poe1Settlers[0].totalCount).toBe(3);

      expect(poe2AllTime[0].count).toBe(1);
      expect(poe2AllTime[0].totalCount).toBe(1);
    });

    it("should correctly reflect metadata per game+scope", async () => {
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 10 },
        { cardName: "Rain of Chaos", count: 20 },
      ]);
      await repository.saveSnapshot("poe1", "Settlers", [
        { cardName: "The Doctor", count: 3 },
      ]);

      const allTimeMeta = await repository.getSnapshotMeta("poe1", "all-time");
      const settlersMeta = await repository.getSnapshotMeta("poe1", "Settlers");
      const nonExistent = await repository.getSnapshotMeta(
        "poe1",
        "Necropolis"
      );

      expect(allTimeMeta).not.toBeNull();
      expect(allTimeMeta!.totalCount).toBe(30);

      expect(settlersMeta).not.toBeNull();
      expect(settlersMeta!.totalCount).toBe(3);

      expect(nonExistent).toBeNull();
    });
  });

  // ─── Snapshot Overwrite Workflow ───────────────────────────────────────────

  describe("snapshot overwrite workflow", () => {
    it("should correctly overwrite a snapshot with updated counts (simulating export flow)", async () => {
      // First export: user has 5 Doctors and 10 Rain of Chaos
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 5 },
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      let meta = await repository.getSnapshotMeta("poe1", "all-time");
      expect(meta!.totalCount).toBe(15);

      // User opens more decks — now has 8 Doctors and 12 Rain of Chaos plus 2 Nurses
      // Second export overwrites the snapshot with new totals
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 8 },
        { cardName: "Rain of Chaos", count: 12 },
        { cardName: "The Nurse", count: 2 },
      ]);

      meta = await repository.getSnapshotMeta("poe1", "all-time");
      expect(meta!.totalCount).toBe(22);

      // Verify individual counts
      const rows = await repository.getSnapshot("poe1", "all-time");
      expect(rows).toHaveLength(3);

      const doctor = rows.find((r) => r.cardName === "The Doctor");
      expect(doctor!.count).toBe(8);

      const rain = rows.find((r) => r.cardName === "Rain of Chaos");
      expect(rain!.count).toBe(12);

      const nurse = rows.find((r) => r.cardName === "The Nurse");
      expect(nurse!.count).toBe(2);
    });

    it("should leave old card rows when they are not in the new snapshot", async () => {
      // First export includes "The Doctor" and "Rain of Chaos"
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 5 },
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      // Second export only updates "The Doctor" (e.g., a partial re-export)
      // Note: in practice, our service always sends all current cards,
      // but the repository should handle partial updates gracefully
      await repository.saveSnapshot("poe1", "all-time", [
        { cardName: "The Doctor", count: 8 },
      ]);

      const rows = await repository.getSnapshot("poe1", "all-time");

      // Both rows should still exist — "Rain of Chaos" retains its old count
      expect(rows).toHaveLength(2);

      const doctor = rows.find((r) => r.cardName === "The Doctor");
      expect(doctor!.count).toBe(8);
      // totalCount from the latest save is 8 (only Doctor was in the entries)
      expect(doctor!.totalCount).toBe(8);

      const rain = rows.find((r) => r.cardName === "Rain of Chaos");
      expect(rain!.count).toBe(10);
      // This row still has the old totalCount from the first save
      expect(rain!.totalCount).toBe(15);
    });
  });
});
