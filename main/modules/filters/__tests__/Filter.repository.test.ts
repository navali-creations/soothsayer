import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import type { KnownRarity } from "~/types/data-stores";

import { FilterRepository } from "../Filter.repository";

describe("FilterRepository", () => {
  let testDb: TestDatabase;
  let repository: FilterRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new FilterRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  async function insertFilter(
    opts: {
      id?: string;
      filterType?: "local" | "online";
      filePath?: string;
      filterName?: string;
      lastUpdate?: string | null;
      isFullyParsed?: boolean;
      parsedAt?: string | null;
    } = {},
  ) {
    const data = {
      id: opts.id ?? "filter-1",
      filterType: opts.filterType ?? ("online" as const),
      filePath:
        opts.filePath ??
        "C:\\Users\\user\\Documents\\My Games\\Path of Exile\\NeverSink.filter",
      filterName: opts.filterName ?? "NeverSink",
      lastUpdate:
        opts.lastUpdate !== undefined
          ? opts.lastUpdate
          : "2025-01-15T10:00:00.000Z",
      isFullyParsed: opts.isFullyParsed ?? false,
      parsedAt: opts.parsedAt ?? null,
    };
    await repository.upsert(data);
    return data;
  }

  async function insertCardRarities(
    filterId: string,
    rarities: Array<{ cardName: string; rarity: KnownRarity }>,
  ) {
    await repository.replaceCardRarities(filterId, rarities);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Filter Metadata Operations
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── getAll ──────────────────────────────────────────────────────────────

  describe("getAll", () => {
    it("should return an empty array when no filters exist", async () => {
      const filters = await repository.getAll();
      expect(filters).toEqual([]);
    });

    it("should return all filters sorted by name ascending", async () => {
      await insertFilter({ id: "f-z", filterName: "Zypher's Filter" });
      await insertFilter({
        id: "f-a",
        filePath: "C:\\other\\Alpha.filter",
        filterName: "Alpha Filter",
      });
      await insertFilter({
        id: "f-m",
        filePath: "C:\\other\\Mid.filter",
        filterName: "Mid Filter",
      });

      const filters = await repository.getAll();

      expect(filters).toHaveLength(3);
      expect(filters[0].filterName).toBe("Alpha Filter");
      expect(filters[1].filterName).toBe("Mid Filter");
      expect(filters[2].filterName).toBe("Zypher's Filter");
    });

    it("should return correctly mapped DTOs", async () => {
      await insertFilter({
        id: "test-id",
        filterType: "online",
        filePath: "C:\\filters\\test.filter",
        filterName: "Test Filter",
        lastUpdate: "2025-02-01T12:00:00.000Z",
        isFullyParsed: true,
        parsedAt: "2025-02-01T13:00:00.000Z",
      });

      const filters = await repository.getAll();

      expect(filters).toHaveLength(1);
      const filter = filters[0];
      expect(filter.id).toBe("test-id");
      expect(filter.filterType).toBe("online");
      expect(filter.filePath).toBe("C:\\filters\\test.filter");
      expect(filter.filterName).toBe("Test Filter");
      expect(filter.lastUpdate).toBe("2025-02-01T12:00:00.000Z");
      expect(filter.isFullyParsed).toBe(true);
      expect(filter.parsedAt).toBe("2025-02-01T13:00:00.000Z");
      expect(filter.createdAt).toBeDefined();
      expect(filter.updatedAt).toBeDefined();
    });
  });

  // ─── getAllByType ────────────────────────────────────────────────────────

  describe("getAllByType", () => {
    it("should return only filters of the specified type", async () => {
      await insertFilter({
        id: "online-1",
        filterType: "online",
        filePath: "C:\\online\\A.filter",
        filterName: "Online A",
      });
      await insertFilter({
        id: "local-1",
        filterType: "local",
        filePath: "C:\\local\\B.filter",
        filterName: "Local B",
      });
      await insertFilter({
        id: "online-2",
        filterType: "online",
        filePath: "C:\\online\\C.filter",
        filterName: "Online C",
      });

      const onlineFilters = await repository.getAllByType("online");
      expect(onlineFilters).toHaveLength(2);
      expect(onlineFilters.every((f) => f.filterType === "online")).toBe(true);

      const localFilters = await repository.getAllByType("local");
      expect(localFilters).toHaveLength(1);
      expect(localFilters[0].filterType).toBe("local");
      expect(localFilters[0].filterName).toBe("Local B");
    });

    it("should return empty array when no filters match the type", async () => {
      await insertFilter({ filterType: "online" });

      const localFilters = await repository.getAllByType("local");
      expect(localFilters).toEqual([]);
    });

    it("should return results sorted by name ascending", async () => {
      await insertFilter({
        id: "l-2",
        filterType: "local",
        filePath: "C:\\local\\Zeta.filter",
        filterName: "Zeta",
      });
      await insertFilter({
        id: "l-1",
        filterType: "local",
        filePath: "C:\\local\\Alpha.filter",
        filterName: "Alpha",
      });

      const filters = await repository.getAllByType("local");
      expect(filters[0].filterName).toBe("Alpha");
      expect(filters[1].filterName).toBe("Zeta");
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("should return a filter by its ID", async () => {
      await insertFilter({ id: "my-filter" });

      const filter = await repository.getById("my-filter");
      expect(filter).not.toBeNull();
      expect(filter!.id).toBe("my-filter");
      expect(filter!.filterName).toBe("NeverSink");
    });

    it("should return null for a non-existent ID", async () => {
      const filter = await repository.getById("does-not-exist");
      expect(filter).toBeNull();
    });

    it("should return the correct filter when multiple exist", async () => {
      await insertFilter({ id: "filter-a", filterName: "Filter A" });
      await insertFilter({
        id: "filter-b",
        filePath: "C:\\other.filter",
        filterName: "Filter B",
      });

      const filter = await repository.getById("filter-b");
      expect(filter).not.toBeNull();
      expect(filter!.filterName).toBe("Filter B");
    });
  });

  // ─── getByFilePath ───────────────────────────────────────────────────────

  describe("getByFilePath", () => {
    it("should return a filter by its file path", async () => {
      const filePath = "C:\\PoE\\Filters\\MyFilter.filter";
      await insertFilter({ id: "fp-test", filePath, filterName: "MyFilter" });

      const filter = await repository.getByFilePath(filePath);
      expect(filter).not.toBeNull();
      expect(filter!.id).toBe("fp-test");
      expect(filter!.filePath).toBe(filePath);
    });

    it("should return null for a non-existent file path", async () => {
      const filter = await repository.getByFilePath("C:\\nonexistent.filter");
      expect(filter).toBeNull();
    });

    it("should be case-sensitive for file paths", async () => {
      await insertFilter({
        id: "case-test",
        filePath: "C:\\Filters\\Test.filter",
      });

      const result = await repository.getByFilePath("C:\\filters\\test.filter");
      // SQLite is case-sensitive for = comparisons by default on TEXT
      expect(result).toBeNull();
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────

  describe("upsert", () => {
    it("should insert a new filter", async () => {
      await insertFilter({ id: "new-filter", filterName: "Brand New" });

      const filter = await repository.getById("new-filter");
      expect(filter).not.toBeNull();
      expect(filter!.filterName).toBe("Brand New");
      expect(filter!.isFullyParsed).toBe(false);
    });

    it("should update an existing filter on file_path conflict", async () => {
      const filePath = "C:\\shared\\path.filter";

      await insertFilter({
        id: "original-id",
        filePath,
        filterName: "Original Name",
        lastUpdate: "2025-01-01T00:00:00.000Z",
      });

      // Upsert with same file path but different data
      await repository.upsert({
        id: "new-id-ignored",
        filterType: "online",
        filePath,
        filterName: "Updated Name",
        lastUpdate: "2025-02-01T00:00:00.000Z",
        isFullyParsed: true,
        parsedAt: "2025-02-01T01:00:00.000Z",
      });

      // Should still have only one record
      const all = await repository.getAll();
      expect(all).toHaveLength(1);

      // The original ID is preserved (ON CONFLICT updates, doesn't replace the PK)
      const filter = await repository.getById("original-id");
      expect(filter).not.toBeNull();
      expect(filter!.filterName).toBe("Updated Name");
      expect(filter!.lastUpdate).toBe("2025-02-01T00:00:00.000Z");
      expect(filter!.isFullyParsed).toBe(true);
      expect(filter!.parsedAt).toBe("2025-02-01T01:00:00.000Z");
    });

    it("should set created_at and updated_at automatically", async () => {
      await insertFilter({ id: "timestamps-test" });

      const filter = await repository.getById("timestamps-test");
      expect(filter).not.toBeNull();
      expect(filter!.createdAt).toBeDefined();
      expect(filter!.updatedAt).toBeDefined();
    });

    it("should update updated_at on upsert conflict", async () => {
      const filePath = "C:\\timestamp\\test.filter";
      await insertFilter({ id: "ts-1", filePath });

      const before = await repository.getById("ts-1");

      // Small delay to get a different timestamp
      await new Promise((resolve) => setTimeout(resolve, 50));

      await repository.upsert({
        id: "ts-1-new",
        filterType: "online",
        filePath,
        filterName: "Updated",
        lastUpdate: null,
        isFullyParsed: false,
        parsedAt: null,
      });

      const after = await repository.getById("ts-1");
      expect(after).not.toBeNull();
      // updated_at should be >= the original (datetime('now') is called on update)
      expect(new Date(after!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before!.updatedAt).getTime(),
      );
    });

    it("should store null lastUpdate", async () => {
      await insertFilter({ id: "null-update", lastUpdate: null });

      const filter = await repository.getById("null-update");
      expect(filter).not.toBeNull();
      expect(filter!.lastUpdate).toBeNull();
    });

    it("should store isFullyParsed as boolean in DTO", async () => {
      await insertFilter({ id: "parsed-true", isFullyParsed: true });
      await insertFilter({
        id: "parsed-false",
        filePath: "C:\\other.filter",
        isFullyParsed: false,
      });

      const parsedTrue = await repository.getById("parsed-true");
      const parsedFalse = await repository.getById("parsed-false");

      expect(parsedTrue!.isFullyParsed).toBe(true);
      expect(typeof parsedTrue!.isFullyParsed).toBe("boolean");
      expect(parsedFalse!.isFullyParsed).toBe(false);
      expect(typeof parsedFalse!.isFullyParsed).toBe("boolean");
    });
  });

  // ─── upsertMany ─────────────────────────────────────────────────────────

  describe("upsertMany", () => {
    it("should insert multiple filters in a single transaction", async () => {
      await repository.upsertMany([
        {
          id: "batch-1",
          filterType: "online",
          filePath: "C:\\batch\\a.filter",
          filterName: "Batch A",
          lastUpdate: null,
          isFullyParsed: false,
          parsedAt: null,
        },
        {
          id: "batch-2",
          filterType: "local",
          filePath: "C:\\batch\\b.filter",
          filterName: "Batch B",
          lastUpdate: "2025-01-01T00:00:00.000Z",
          isFullyParsed: true,
          parsedAt: "2025-01-01T01:00:00.000Z",
        },
        {
          id: "batch-3",
          filterType: "online",
          filePath: "C:\\batch\\c.filter",
          filterName: "Batch C",
          lastUpdate: null,
          isFullyParsed: false,
          parsedAt: null,
        },
      ]);

      const all = await repository.getAll();
      expect(all).toHaveLength(3);
    });

    it("should handle empty array without error", async () => {
      await repository.upsertMany([]);

      const all = await repository.getAll();
      expect(all).toEqual([]);
    });

    it("should upsert on file_path conflict within batch", async () => {
      // Insert an existing filter first
      await insertFilter({
        id: "existing",
        filePath: "C:\\shared.filter",
        filterName: "Old Name",
      });

      await repository.upsertMany([
        {
          id: "existing-new",
          filterType: "online",
          filePath: "C:\\shared.filter",
          filterName: "New Name",
          lastUpdate: null,
          isFullyParsed: false,
          parsedAt: null,
        },
        {
          id: "brand-new",
          filterType: "local",
          filePath: "C:\\brand-new.filter",
          filterName: "Brand New",
          lastUpdate: null,
          isFullyParsed: false,
          parsedAt: null,
        },
      ]);

      const all = await repository.getAll();
      expect(all).toHaveLength(2);

      const existing = await repository.getById("existing");
      expect(existing).not.toBeNull();
      expect(existing!.filterName).toBe("New Name");
    });
  });

  // ─── markAsParsed ────────────────────────────────────────────────────────

  describe("markAsParsed", () => {
    it("should mark a filter as fully parsed", async () => {
      await insertFilter({
        id: "to-parse",
        isFullyParsed: false,
        parsedAt: null,
      });

      await repository.markAsParsed("to-parse");

      const filter = await repository.getById("to-parse");
      expect(filter).not.toBeNull();
      expect(filter!.isFullyParsed).toBe(true);
      expect(filter!.parsedAt).toBeDefined();
      expect(filter!.parsedAt).not.toBeNull();
    });

    it("should set parsedAt to an ISO timestamp", async () => {
      await insertFilter({ id: "parse-ts" });

      await repository.markAsParsed("parse-ts");

      const filter = await repository.getById("parse-ts");
      // parsedAt should be a valid ISO date string
      const parsed = new Date(filter!.parsedAt!);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it("should update updated_at timestamp", async () => {
      await insertFilter({ id: "parse-update" });
      const before = await repository.getById("parse-update");

      await new Promise((resolve) => setTimeout(resolve, 50));
      await repository.markAsParsed("parse-update");

      const after = await repository.getById("parse-update");
      expect(new Date(after!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before!.updatedAt).getTime(),
      );
    });

    it("should not affect other filters", async () => {
      await insertFilter({ id: "parse-target", filterName: "Target" });
      await insertFilter({
        id: "parse-other",
        filePath: "C:\\other.filter",
        filterName: "Other",
      });

      await repository.markAsParsed("parse-target");

      const other = await repository.getById("parse-other");
      expect(other!.isFullyParsed).toBe(false);
      expect(other!.parsedAt).toBeNull();
    });
  });

  // ─── deleteById ──────────────────────────────────────────────────────────

  describe("deleteById", () => {
    it("should delete a filter by ID", async () => {
      await insertFilter({ id: "to-delete" });

      await repository.deleteById("to-delete");

      const filter = await repository.getById("to-delete");
      expect(filter).toBeNull();
    });

    it("should not throw when deleting a non-existent ID", async () => {
      await expect(repository.deleteById("nonexistent")).resolves.not.toThrow();
    });

    it("should not affect other filters", async () => {
      await insertFilter({ id: "keep", filterName: "Keep Me" });
      await insertFilter({
        id: "remove",
        filePath: "C:\\remove.filter",
        filterName: "Remove Me",
      });

      await repository.deleteById("remove");

      const remaining = await repository.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].filterName).toBe("Keep Me");
    });

    it("should cascade delete associated card rarities", async () => {
      await insertFilter({ id: "cascade-test" });
      await insertCardRarities("cascade-test", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      // Verify rarities exist before deletion
      const beforeDelete = await repository.getCardRarities("cascade-test");
      expect(beforeDelete).toHaveLength(2);

      await repository.deleteById("cascade-test");

      // Rarities should be gone too
      const afterDelete = await repository.getCardRarities("cascade-test");
      expect(afterDelete).toEqual([]);
    });
  });

  // ─── deleteNotInFilePaths ────────────────────────────────────────────────

  describe("deleteNotInFilePaths", () => {
    it("should delete filters whose paths are not in the provided list", async () => {
      await insertFilter({
        id: "keep-1",
        filePath: "C:\\keep\\a.filter",
        filterName: "Keep A",
      });
      await insertFilter({
        id: "keep-2",
        filePath: "C:\\keep\\b.filter",
        filterName: "Keep B",
      });
      await insertFilter({
        id: "remove-1",
        filePath: "C:\\remove\\c.filter",
        filterName: "Remove C",
      });

      const deletedCount = await repository.deleteNotInFilePaths([
        "C:\\keep\\a.filter",
        "C:\\keep\\b.filter",
      ]);

      expect(deletedCount).toBe(1);
      const remaining = await repository.getAll();
      expect(remaining).toHaveLength(2);
      expect(remaining.map((f) => f.filterName).sort()).toEqual([
        "Keep A",
        "Keep B",
      ]);
    });

    it("should delete all filters when given an empty array", async () => {
      await insertFilter({
        id: "del-1",
        filePath: "C:\\a.filter",
      });
      await insertFilter({
        id: "del-2",
        filePath: "C:\\b.filter",
      });

      const deletedCount = await repository.deleteNotInFilePaths([]);

      expect(deletedCount).toBe(2);
      const remaining = await repository.getAll();
      expect(remaining).toEqual([]);
    });

    it("should return 0 when no filters are deleted", async () => {
      await insertFilter({
        id: "safe",
        filePath: "C:\\safe.filter",
      });

      const deletedCount = await repository.deleteNotInFilePaths([
        "C:\\safe.filter",
      ]);

      expect(deletedCount).toBe(0);
      const remaining = await repository.getAll();
      expect(remaining).toHaveLength(1);
    });

    it("should return 0 when no filters exist", async () => {
      const deletedCount = await repository.deleteNotInFilePaths([
        "C:\\any.filter",
      ]);
      expect(deletedCount).toBe(0);
    });

    it("should cascade delete associated card rarities for removed filters", async () => {
      await insertFilter({ id: "stale", filePath: "C:\\stale.filter" });
      await insertCardRarities("stale", [
        { cardName: "The Doctor", rarity: 1 },
      ]);

      await insertFilter({
        id: "current",
        filePath: "C:\\current.filter",
      });
      await insertCardRarities("current", [
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      await repository.deleteNotInFilePaths(["C:\\current.filter"]);

      // Stale filter's rarities should be gone
      const staleRarities = await repository.getCardRarities("stale");
      expect(staleRarities).toEqual([]);

      // Current filter's rarities should remain
      const currentRarities = await repository.getCardRarities("current");
      expect(currentRarities).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Filter Card Rarities Operations
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── getCardRarities ─────────────────────────────────────────────────────

  describe("getCardRarities", () => {
    it("should return all card rarities for a filter", async () => {
      await insertFilter({ id: "rarity-filter" });
      await insertCardRarities("rarity-filter", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Fiend", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      const rarities = await repository.getCardRarities("rarity-filter");

      expect(rarities).toHaveLength(3);
      expect(rarities.every((r) => r.filterId === "rarity-filter")).toBe(true);
    });

    it("should return results sorted by card_name ascending", async () => {
      await insertFilter({ id: "sorted-filter" });
      await insertCardRarities("sorted-filter", [
        { cardName: "The Wretched", rarity: 3 },
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      const rarities = await repository.getCardRarities("sorted-filter");

      expect(rarities[0].cardName).toBe("Rain of Chaos");
      expect(rarities[1].cardName).toBe("The Doctor");
      expect(rarities[2].cardName).toBe("The Wretched");
    });

    it("should return empty array for a filter with no rarities", async () => {
      await insertFilter({ id: "empty-filter" });

      const rarities = await repository.getCardRarities("empty-filter");
      expect(rarities).toEqual([]);
    });

    it("should return empty array for a non-existent filter", async () => {
      const rarities = await repository.getCardRarities("nonexistent");
      expect(rarities).toEqual([]);
    });

    it("should return correctly mapped DTOs", async () => {
      await insertFilter({ id: "dto-filter" });
      await insertCardRarities("dto-filter", [
        { cardName: "The Doctor", rarity: 1 },
      ]);

      const rarities = await repository.getCardRarities("dto-filter");

      expect(rarities).toHaveLength(1);
      const rarity = rarities[0];
      expect(rarity.filterId).toBe("dto-filter");
      expect(rarity.cardName).toBe("The Doctor");
      expect(rarity.rarity).toBe(1);
    });

    it("should not return rarities from other filters", async () => {
      await insertFilter({
        id: "filter-a",
        filePath: "C:\\a.filter",
      });
      await insertFilter({
        id: "filter-b",
        filePath: "C:\\b.filter",
      });

      await insertCardRarities("filter-a", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);
      await insertCardRarities("filter-b", [
        { cardName: "The Doctor", rarity: 2 },
        { cardName: "The Fiend", rarity: 1 },
      ]);

      const raritiesA = await repository.getCardRarities("filter-a");
      expect(raritiesA).toHaveLength(2);
      expect(raritiesA.every((r) => r.filterId === "filter-a")).toBe(true);

      const raritiesB = await repository.getCardRarities("filter-b");
      expect(raritiesB).toHaveLength(2);
      expect(raritiesB.every((r) => r.filterId === "filter-b")).toBe(true);
    });
  });

  // ─── getCardRarity ───────────────────────────────────────────────────────

  describe("getCardRarity", () => {
    it("should return the rarity for a specific card in a filter", async () => {
      await insertFilter({ id: "single-rarity" });
      await insertCardRarities("single-rarity", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      const rarity = await repository.getCardRarity(
        "single-rarity",
        "The Doctor",
      );

      expect(rarity).not.toBeNull();
      expect(rarity!.cardName).toBe("The Doctor");
      expect(rarity!.rarity).toBe(1);
      expect(rarity!.filterId).toBe("single-rarity");
    });

    it("should return null for a card not in the filter", async () => {
      await insertFilter({ id: "no-card-filter" });
      await insertCardRarities("no-card-filter", [
        { cardName: "The Doctor", rarity: 1 },
      ]);

      const rarity = await repository.getCardRarity(
        "no-card-filter",
        "Nonexistent Card",
      );

      expect(rarity).toBeNull();
    });

    it("should return null for a non-existent filter", async () => {
      const rarity = await repository.getCardRarity(
        "nonexistent-filter",
        "The Doctor",
      );
      expect(rarity).toBeNull();
    });

    it("should be case-sensitive for card names", async () => {
      await insertFilter({ id: "case-filter" });
      await insertCardRarities("case-filter", [
        { cardName: "The Doctor", rarity: 1 },
      ]);

      const result = await repository.getCardRarity(
        "case-filter",
        "the doctor",
      );
      expect(result).toBeNull();
    });
  });

  // ─── replaceCardRarities ─────────────────────────────────────────────────

  describe("replaceCardRarities", () => {
    it("should insert card rarities for a filter", async () => {
      await insertFilter({ id: "replace-filter" });

      await repository.replaceCardRarities("replace-filter", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Fiend", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      const rarities = await repository.getCardRarities("replace-filter");
      expect(rarities).toHaveLength(3);
    });

    it("should replace existing rarities completely", async () => {
      await insertFilter({ id: "full-replace" });

      // First set of rarities
      await repository.replaceCardRarities("full-replace", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Fiend", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      // Replace with different set
      await repository.replaceCardRarities("full-replace", [
        { cardName: "The Wretched", rarity: 3 },
        { cardName: "The Nurse", rarity: 2 },
      ]);

      const rarities = await repository.getCardRarities("full-replace");
      expect(rarities).toHaveLength(2);

      const cardNames = rarities.map((r) => r.cardName).sort();
      expect(cardNames).toEqual(["The Nurse", "The Wretched"]);
    });

    it("should handle empty rarities array by deleting all existing", async () => {
      await insertFilter({ id: "clear-filter" });

      await repository.replaceCardRarities("clear-filter", [
        { cardName: "The Doctor", rarity: 1 },
      ]);

      // Replace with empty array
      await repository.replaceCardRarities("clear-filter", []);

      const rarities = await repository.getCardRarities("clear-filter");
      expect(rarities).toEqual([]);
    });

    it("should not affect other filters' rarities", async () => {
      await insertFilter({
        id: "isolated-a",
        filePath: "C:\\a.filter",
      });
      await insertFilter({
        id: "isolated-b",
        filePath: "C:\\b.filter",
      });

      await repository.replaceCardRarities("isolated-a", [
        { cardName: "The Doctor", rarity: 1 },
      ]);
      await repository.replaceCardRarities("isolated-b", [
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      // Replace A's rarities
      await repository.replaceCardRarities("isolated-a", [
        { cardName: "The Nurse", rarity: 2 },
      ]);

      // B should be untouched
      const raritiesB = await repository.getCardRarities("isolated-b");
      expect(raritiesB).toHaveLength(1);
      expect(raritiesB[0].cardName).toBe("Rain of Chaos");
    });

    it("should handle all valid rarity values (1-4)", async () => {
      await insertFilter({ id: "all-rarities" });

      await repository.replaceCardRarities("all-rarities", [
        { cardName: "Tier 1 Card", rarity: 1 },
        { cardName: "Tier 2 Card", rarity: 2 },
        { cardName: "Tier 3 Card", rarity: 3 },
        { cardName: "Tier 4 Card", rarity: 4 },
      ]);

      const rarities = await repository.getCardRarities("all-rarities");
      expect(rarities).toHaveLength(4);

      const rarityMap = new Map(rarities.map((r) => [r.cardName, r.rarity]));
      expect(rarityMap.get("Tier 1 Card")).toBe(1);
      expect(rarityMap.get("Tier 2 Card")).toBe(2);
      expect(rarityMap.get("Tier 3 Card")).toBe(3);
      expect(rarityMap.get("Tier 4 Card")).toBe(4);
    });

    it("should handle large batches of cards", async () => {
      await insertFilter({ id: "large-batch" });

      // Create 600 card rarities to test batching logic (BATCH_SIZE = 500)
      const rarities = Array.from({ length: 600 }, (_, i) => ({
        cardName: `Card ${String(i).padStart(4, "0")}`,
        rarity: ((i % 4) + 1) as KnownRarity,
      }));

      await repository.replaceCardRarities("large-batch", rarities);

      const count = await repository.getCardRarityCount("large-batch");
      expect(count).toBe(600);
    });

    it("should handle cards with special characters in names", async () => {
      await insertFilter({ id: "special-chars" });

      await repository.replaceCardRarities("special-chars", [
        { cardName: "The King's Blade", rarity: 2 },
        { cardName: "A Mother's Parting Gift", rarity: 3 },
        { cardName: "The Bargain", rarity: 4 },
      ]);

      const rarity = await repository.getCardRarity(
        "special-chars",
        "The King's Blade",
      );
      expect(rarity).not.toBeNull();
      expect(rarity!.rarity).toBe(2);
    });
  });

  // ─── deleteCardRarities ──────────────────────────────────────────────────

  describe("deleteCardRarities", () => {
    it("should delete all card rarities for a filter", async () => {
      await insertFilter({ id: "del-rarity-filter" });
      await insertCardRarities("del-rarity-filter", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      await repository.deleteCardRarities("del-rarity-filter");

      const rarities = await repository.getCardRarities("del-rarity-filter");
      expect(rarities).toEqual([]);
    });

    it("should not throw when filter has no rarities", async () => {
      await insertFilter({ id: "no-rarities" });

      await expect(
        repository.deleteCardRarities("no-rarities"),
      ).resolves.not.toThrow();
    });

    it("should not throw for a non-existent filter", async () => {
      await expect(
        repository.deleteCardRarities("nonexistent"),
      ).resolves.not.toThrow();
    });

    it("should not affect the filter metadata", async () => {
      await insertFilter({ id: "keep-meta" });
      await insertCardRarities("keep-meta", [
        { cardName: "The Doctor", rarity: 1 },
      ]);

      await repository.deleteCardRarities("keep-meta");

      const filter = await repository.getById("keep-meta");
      expect(filter).not.toBeNull();
      expect(filter!.filterName).toBe("NeverSink");
    });

    it("should not affect other filters' rarities", async () => {
      await insertFilter({
        id: "del-target",
        filePath: "C:\\target.filter",
      });
      await insertFilter({
        id: "del-keep",
        filePath: "C:\\keep.filter",
      });

      await insertCardRarities("del-target", [
        { cardName: "The Doctor", rarity: 1 },
      ]);
      await insertCardRarities("del-keep", [
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      await repository.deleteCardRarities("del-target");

      const kept = await repository.getCardRarities("del-keep");
      expect(kept).toHaveLength(1);
      expect(kept[0].cardName).toBe("Rain of Chaos");
    });
  });

  // ─── getCardRarityCount ──────────────────────────────────────────────────

  describe("getCardRarityCount", () => {
    it("should return 0 for a filter with no rarities", async () => {
      await insertFilter({ id: "empty-count" });

      const count = await repository.getCardRarityCount("empty-count");
      expect(count).toBe(0);
    });

    it("should return the correct count", async () => {
      await insertFilter({ id: "count-filter" });
      await insertCardRarities("count-filter", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Fiend", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      const count = await repository.getCardRarityCount("count-filter");
      expect(count).toBe(3);
    });

    it("should return 0 for a non-existent filter", async () => {
      const count = await repository.getCardRarityCount("nonexistent");
      expect(count).toBe(0);
    });

    it("should return correct count after replacement", async () => {
      await insertFilter({ id: "replace-count" });

      await insertCardRarities("replace-count", [
        { cardName: "Card A", rarity: 1 },
        { cardName: "Card B", rarity: 2 },
        { cardName: "Card C", rarity: 3 },
      ]);
      expect(await repository.getCardRarityCount("replace-count")).toBe(3);

      await repository.replaceCardRarities("replace-count", [
        { cardName: "Card X", rarity: 4 },
      ]);
      expect(await repository.getCardRarityCount("replace-count")).toBe(1);
    });

    it("should count only the specified filter's rarities", async () => {
      await insertFilter({
        id: "count-a",
        filePath: "C:\\a.filter",
      });
      await insertFilter({
        id: "count-b",
        filePath: "C:\\b.filter",
      });

      await insertCardRarities("count-a", [
        { cardName: "Card 1", rarity: 1 },
        { cardName: "Card 2", rarity: 2 },
      ]);
      await insertCardRarities("count-b", [
        { cardName: "Card 3", rarity: 3 },
        { cardName: "Card 4", rarity: 4 },
        { cardName: "Card 5", rarity: 1 },
      ]);

      expect(await repository.getCardRarityCount("count-a")).toBe(2);
      expect(await repository.getCardRarityCount("count-b")).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Table / Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  describe("upsert on re-scan (no historical data)", () => {
    it("should represent only current state after re-scan", async () => {
      // Simulate initial scan: 3 filters discovered
      await repository.upsertMany([
        {
          id: "scan-1",
          filterType: "online",
          filePath: "C:\\filters\\neversink.filter",
          filterName: "NeverSink",
          lastUpdate: "2025-01-01T00:00:00.000Z",
          isFullyParsed: false,
          parsedAt: null,
        },
        {
          id: "scan-2",
          filterType: "online",
          filePath: "C:\\filters\\strict.filter",
          filterName: "NeverSink Strict",
          lastUpdate: "2025-01-01T00:00:00.000Z",
          isFullyParsed: false,
          parsedAt: null,
        },
        {
          id: "scan-3",
          filterType: "local",
          filePath: "C:\\filters\\custom.filter",
          filterName: "Custom",
          lastUpdate: "2024-12-01T00:00:00.000Z",
          isFullyParsed: false,
          parsedAt: null,
        },
      ]);

      // Parse one filter and add rarities
      await repository.markAsParsed("scan-1");
      await repository.replaceCardRarities("scan-1", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      // Verify intermediate state
      expect(await repository.getCardRarityCount("scan-1")).toBe(2);

      // Simulate re-scan: custom.filter was deleted, neversink updated
      const currentPaths = [
        "C:\\filters\\neversink.filter",
        "C:\\filters\\strict.filter",
      ];

      // Upsert the still-existing filters (with updated metadata)
      await repository.upsertMany([
        {
          id: "scan-1",
          filterType: "online",
          filePath: "C:\\filters\\neversink.filter",
          filterName: "NeverSink",
          lastUpdate: "2025-02-01T00:00:00.000Z", // Updated
          isFullyParsed: false, // Reset because filter content changed
          parsedAt: null,
        },
        {
          id: "scan-2",
          filterType: "online",
          filePath: "C:\\filters\\strict.filter",
          filterName: "NeverSink Strict",
          lastUpdate: "2025-01-01T00:00:00.000Z",
          isFullyParsed: false,
          parsedAt: null,
        },
      ]);

      // Clean up stale entries
      const deleted = await repository.deleteNotInFilePaths(currentPaths);
      expect(deleted).toBe(1); // custom.filter removed

      // Only current filters remain
      const all = await repository.getAll();
      expect(all).toHaveLength(2);

      // The updated filter reflects new state
      const neversink = await repository.getById("scan-1");
      expect(neversink!.lastUpdate).toBe("2025-02-01T00:00:00.000Z");
      expect(neversink!.isFullyParsed).toBe(false);

      // Custom filter and its rarities are gone
      const custom = await repository.getById("scan-3");
      expect(custom).toBeNull();
    });
  });

  describe("full lifecycle", () => {
    it("should support discover → parse → query → re-parse flow", async () => {
      // Step 1: Discover filter
      await repository.upsert({
        id: "lifecycle-filter",
        filterType: "online",
        filePath: "C:\\PoE\\NeverSink.filter",
        filterName: "NeverSink's Loot Filter",
        lastUpdate: "2025-01-15T10:00:00.000Z",
        isFullyParsed: false,
        parsedAt: null,
      });

      let filter = await repository.getById("lifecycle-filter");
      expect(filter!.isFullyParsed).toBe(false);
      expect(filter!.parsedAt).toBeNull();

      // Step 2: Parse filter and store rarities
      await repository.replaceCardRarities("lifecycle-filter", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Fiend", rarity: 1 },
        { cardName: "The Nurse", rarity: 2 },
        { cardName: "Rain of Chaos", rarity: 4 },
        { cardName: "The Wretched", rarity: 3 },
      ]);
      await repository.markAsParsed("lifecycle-filter");

      filter = await repository.getById("lifecycle-filter");
      expect(filter!.isFullyParsed).toBe(true);
      expect(filter!.parsedAt).not.toBeNull();

      // Step 3: Query rarities
      const count = await repository.getCardRarityCount("lifecycle-filter");
      expect(count).toBe(5);

      const doctorRarity = await repository.getCardRarity(
        "lifecycle-filter",
        "The Doctor",
      );
      expect(doctorRarity!.rarity).toBe(1);

      const allRarities = await repository.getCardRarities("lifecycle-filter");
      expect(allRarities).toHaveLength(5);
      // Sorted by card_name asc
      expect(allRarities[0].cardName).toBe("Rain of Chaos");
      expect(allRarities[0].rarity).toBe(4);

      // Step 4: Re-parse with updated rarities (e.g., filter author changed tiers)
      await repository.replaceCardRarities("lifecycle-filter", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Fiend", rarity: 2 }, // Changed from 1 to 2
        { cardName: "The Nurse", rarity: 2 },
        { cardName: "Rain of Chaos", rarity: 4 },
        { cardName: "The Wretched", rarity: 4 }, // Changed from 3 to 4
        { cardName: "New Card Added", rarity: 3 }, // New card
      ]);

      const updatedRarities =
        await repository.getCardRarities("lifecycle-filter");
      expect(updatedRarities).toHaveLength(6);

      const fiendRarity = await repository.getCardRarity(
        "lifecycle-filter",
        "The Fiend",
      );
      expect(fiendRarity!.rarity).toBe(2);

      const newCardRarity = await repository.getCardRarity(
        "lifecycle-filter",
        "New Card Added",
      );
      expect(newCardRarity).not.toBeNull();
      expect(newCardRarity!.rarity).toBe(3);
    });

    it("should support multi-filter comparison scenario", async () => {
      // Set up two filters
      await repository.upsert({
        id: "neversink",
        filterType: "online",
        filePath: "C:\\filters\\neversink.filter",
        filterName: "NeverSink",
        lastUpdate: "2025-02-01T00:00:00.000Z",
        isFullyParsed: true,
        parsedAt: "2025-02-01T00:01:00.000Z",
      });

      await repository.upsert({
        id: "custom",
        filterType: "local",
        filePath: "C:\\filters\\custom.filter",
        filterName: "My Custom Filter",
        lastUpdate: "2025-01-20T00:00:00.000Z",
        isFullyParsed: true,
        parsedAt: "2025-01-20T00:05:00.000Z",
      });

      // Each filter has different rarity assessments for the same cards
      await repository.replaceCardRarities("neversink", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Nurse", rarity: 2 },
        { cardName: "Rain of Chaos", rarity: 4 },
      ]);

      await repository.replaceCardRarities("custom", [
        { cardName: "The Doctor", rarity: 1 },
        { cardName: "The Nurse", rarity: 1 }, // Custom values The Nurse higher
        { cardName: "Rain of Chaos", rarity: 3 }, // Custom doesn't fully hide Rain
      ]);

      // Compare Doctor across filters
      const doctorNS = await repository.getCardRarity(
        "neversink",
        "The Doctor",
      );
      const doctorCustom = await repository.getCardRarity(
        "custom",
        "The Doctor",
      );
      expect(doctorNS!.rarity).toBe(doctorCustom!.rarity); // Both agree: tier 1

      // Compare Nurse across filters
      const nurseNS = await repository.getCardRarity("neversink", "The Nurse");
      const nurseCustom = await repository.getCardRarity("custom", "The Nurse");
      expect(nurseNS!.rarity).toBe(2);
      expect(nurseCustom!.rarity).toBe(1); // Different assessment

      // Compare counts
      expect(await repository.getCardRarityCount("neversink")).toBe(3);
      expect(await repository.getCardRarityCount("custom")).toBe(3);

      // Query by type
      const onlineFilters = await repository.getAllByType("online");
      const localFilters = await repository.getAllByType("local");
      expect(onlineFilters).toHaveLength(1);
      expect(onlineFilters[0].filterName).toBe("NeverSink");
      expect(localFilters).toHaveLength(1);
      expect(localFilters[0].filterName).toBe("My Custom Filter");
    });
  });
});
