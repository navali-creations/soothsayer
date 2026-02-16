import { describe, expect, it } from "vitest";

import type {
  FilterCardRaritiesRow,
  FilterMetadataRow,
} from "~/main/modules/database";

import { RarityModelMapper } from "../RarityModel.mapper";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilterMetadataRow(
  overrides: Partial<FilterMetadataRow> = {},
): FilterMetadataRow {
  return {
    id: "filter_abc12345",
    filter_type: "local",
    file_path:
      "C:\\Users\\Test\\Documents\\My Games\\Path of Exile\\NeverSink.filter",
    filter_name: "NeverSink",
    last_update: "2025-07-01T10:00:00Z",
    is_fully_parsed: 0,
    parsed_at: null,
    created_at: "2025-06-01T00:00:00Z",
    updated_at: "2025-07-01T10:00:00Z",
    ...overrides,
  };
}

function makeFilterCardRaritiesRow(
  overrides: Partial<FilterCardRaritiesRow> = {},
): FilterCardRaritiesRow {
  return {
    filter_id: "filter_abc12345",
    card_name: "The Doctor",
    rarity: 1,
    created_at: "2025-07-01T10:00:00Z",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RarityModelMapper", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // toRarityModelMetadataDTO
  // ═══════════════════════════════════════════════════════════════════════════

  describe("toRarityModelMetadataDTO", () => {
    it("should convert a database row to a RarityModelMetadataDTO", () => {
      const row = makeFilterMetadataRow();

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result).toEqual({
        id: "filter_abc12345",
        filterType: "local",
        filePath:
          "C:\\Users\\Test\\Documents\\My Games\\Path of Exile\\NeverSink.filter",
        filterName: "NeverSink",
        lastUpdate: "2025-07-01T10:00:00Z",
        isFullyParsed: false,
        parsedAt: null,
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2025-07-01T10:00:00Z",
      });
    });

    it("should convert is_fully_parsed = 1 to isFullyParsed = true", () => {
      const row = makeFilterMetadataRow({
        is_fully_parsed: 1,
        parsed_at: "2025-07-02T12:00:00Z",
      });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.isFullyParsed).toBe(true);
      expect(result.parsedAt).toBe("2025-07-02T12:00:00Z");
    });

    it("should convert is_fully_parsed = 0 to isFullyParsed = false", () => {
      const row = makeFilterMetadataRow({ is_fully_parsed: 0 });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.isFullyParsed).toBe(false);
    });

    it("should handle null last_update", () => {
      const row = makeFilterMetadataRow({ last_update: null });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.lastUpdate).toBeNull();
    });

    it("should handle null parsed_at", () => {
      const row = makeFilterMetadataRow({ parsed_at: null });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.parsedAt).toBeNull();
    });

    it("should correctly map filter_type 'online'", () => {
      const row = makeFilterMetadataRow({
        filter_type: "online",
        file_path: "C:\\path\\OnlineFilters\\abc123",
      });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.filterType).toBe("online");
    });

    it("should correctly map filter_type 'local'", () => {
      const row = makeFilterMetadataRow({ filter_type: "local" });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.filterType).toBe("local");
    });

    it("should preserve all timestamp fields", () => {
      const row = makeFilterMetadataRow({
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-06-15T12:00:00Z",
      });

      const result = RarityModelMapper.toRarityModelMetadataDTO(row);

      expect(result.createdAt).toBe("2025-01-01T00:00:00Z");
      expect(result.updatedAt).toBe("2025-06-15T12:00:00Z");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // toDiscoveredRarityModelDTO
  // ═══════════════════════════════════════════════════════════════════════════

  describe("toDiscoveredRarityModelDTO", () => {
    it("should convert RarityModelMetadataDTO to DiscoveredRarityModelDTO", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow(),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result).toEqual({
        id: "filter_abc12345",
        type: "local",
        filePath:
          "C:\\Users\\Test\\Documents\\My Games\\Path of Exile\\NeverSink.filter",
        fileName: "NeverSink.filter",
        name: "NeverSink",
        lastUpdate: "2025-07-01T10:00:00Z",
        isFullyParsed: false,
        isOutdated: false,
      });
    });

    it("should extract fileName from file path with backslashes", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          file_path: "C:\\Users\\Test\\Documents\\MyFilter.filter",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.fileName).toBe("MyFilter.filter");
    });

    it("should extract fileName from file path with forward slashes", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          file_path: "/home/user/filters/MyFilter.filter",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.fileName).toBe("MyFilter.filter");
    });

    it("should extract fileName from online filter path (no extension)", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          filter_type: "online",
          file_path: "C:\\path\\OnlineFilters\\abc123def",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.fileName).toBe("abc123def");
      expect(result.type).toBe("online");
    });

    it("should set isOutdated to false when leagueStartDate is null", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          last_update: "2020-01-01T00:00:00Z",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.isOutdated).toBe(false);
    });

    it("should set isOutdated to true when filter was updated well before league start (beyond 3-day grace)", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          last_update: "2025-01-01T00:00:00Z",
        }),
      );

      // League starts June 1 – filter updated 5 months before → outdated
      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        "2025-06-01T00:00:00Z",
      );

      expect(result.isOutdated).toBe(true);
    });

    it("should set isOutdated to false when filter was updated within 3-day grace window before league start", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          // Updated 1 day before league start
          last_update: "2025-05-31T00:00:00Z",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        "2025-06-01T00:00:00Z",
      );

      expect(result.isOutdated).toBe(false);
    });

    it("should set isOutdated to false when filter was updated after league start", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          last_update: "2025-08-01T00:00:00Z",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        "2025-06-01T00:00:00Z",
      );

      expect(result.isOutdated).toBe(false);
    });

    it("should set isOutdated to false when filter lastUpdate is null", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          last_update: null,
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        "2025-06-01T00:00:00Z",
      );

      expect(result.isOutdated).toBe(false);
    });

    it("should correctly carry isFullyParsed = true", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          is_fully_parsed: 1,
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.isFullyParsed).toBe(true);
    });

    it("should correctly carry isFullyParsed = false", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          is_fully_parsed: 0,
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.isFullyParsed).toBe(false);
    });

    it("should use filterName as the name field", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          filter_name: "My Custom Filter Name",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.name).toBe("My Custom Filter Name");
    });

    // ─── PoE2 file path tests ──────────────────────────────────────────

    it("should handle PoE2 local filter paths", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          filter_type: "local",
          file_path:
            "C:\\Users\\Test\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.filePath).toBe(
        "C:\\Users\\Test\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
      );
      expect(result.fileName).toBe("NeverSink.filter");
      expect(result.type).toBe("local");
    });

    it("should handle PoE2 online filter paths", () => {
      const metadata = RarityModelMapper.toRarityModelMetadataDTO(
        makeFilterMetadataRow({
          filter_type: "online",
          file_path:
            "C:\\Users\\Test\\Documents\\My Games\\Path of Exile 2\\OnlineFilters\\abc123",
        }),
      );

      const result = RarityModelMapper.toDiscoveredRarityModelDTO(
        metadata,
        null,
      );

      expect(result.filePath).toBe(
        "C:\\Users\\Test\\Documents\\My Games\\Path of Exile 2\\OnlineFilters\\abc123",
      );
      expect(result.fileName).toBe("abc123");
      expect(result.type).toBe("online");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // toRarityModelCardRarityDTO
  // ═══════════════════════════════════════════════════════════════════════════

  describe("toRarityModelCardRarityDTO", () => {
    it("should convert a database row to a RarityModelCardRarityDTO", () => {
      const row = makeFilterCardRaritiesRow();

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result).toEqual({
        filterId: "filter_abc12345",
        cardName: "The Doctor",
        rarity: 1,
      });
    });

    it("should handle rarity 1 (extremely rare)", () => {
      const row = makeFilterCardRaritiesRow({ rarity: 1 });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.rarity).toBe(1);
    });

    it("should handle rarity 2 (rare)", () => {
      const row = makeFilterCardRaritiesRow({ rarity: 2 });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.rarity).toBe(2);
    });

    it("should handle rarity 3 (less common)", () => {
      const row = makeFilterCardRaritiesRow({ rarity: 3 });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.rarity).toBe(3);
    });

    it("should handle rarity 4 (common)", () => {
      const row = makeFilterCardRaritiesRow({ rarity: 4 });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.rarity).toBe(4);
    });

    it("should preserve card names with special characters", () => {
      const row = makeFilterCardRaritiesRow({
        card_name: "The King's Blade",
      });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.cardName).toBe("The King's Blade");
    });

    it("should preserve card names with quotes", () => {
      const row = makeFilterCardRaritiesRow({
        card_name: 'Card "With" Quotes',
      });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.cardName).toBe('Card "With" Quotes');
    });

    it("should map filter_id to filterId", () => {
      const row = makeFilterCardRaritiesRow({
        filter_id: "filter_custom123",
      });

      const result = RarityModelMapper.toRarityModelCardRarityDTO(row);

      expect(result.filterId).toBe("filter_custom123");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isFilterOutdated (static) — includes 3-day grace buffer
  // ═══════════════════════════════════════════════════════════════════════════

  describe("isFilterOutdated", () => {
    // ─── Null / missing inputs ─────────────────────────────────────────

    it("should return false when filterLastUpdate is null", () => {
      const result = RarityModelMapper.isFilterOutdated(
        null,
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return false when leagueStartDate is null", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-07-01T00:00:00Z",
        null,
      );

      expect(result).toBe(false);
    });

    it("should return false when both are null", () => {
      const result = RarityModelMapper.isFilterOutdated(null, null);

      expect(result).toBe(false);
    });

    // ─── Core logic with 3-day grace buffer ────────────────────────────

    it("should return true when filter was updated well before the 3-day grace window", () => {
      // League: June 1.  Filter: Jan 15 — ~4.5 months before → outdated
      const result = RarityModelMapper.isFilterOutdated(
        "2025-01-15T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(true);
    });

    it("should return false when filter was updated after league start", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-08-15T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return false when filter was updated at exactly league start time", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-06-01T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    // ─── Grace window edge cases ───────────────────────────────────────

    it("should return false when filter was updated 1 day before league start (within grace)", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-31T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return false when filter was updated 2 days before league start (within grace)", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-30T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return false when filter was updated exactly 3 days before league start (boundary)", () => {
      // Exactly at the grace threshold — filterDate == leagueDate - 3 days
      // The comparison is strictly less-than, so this is NOT outdated
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-29T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return true when filter was updated 1ms more than 3 days before league start", () => {
      // 1ms beyond the grace window → outdated
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-28T23:59:59.999Z",
        "2025-06-01T00:00:00.000Z",
      );

      expect(result).toBe(true);
    });

    it("should return false when filter is 1ms after league start", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-06-01T00:00:00.001Z",
        "2025-06-01T00:00:00.000Z",
      );

      expect(result).toBe(false);
    });

    it("should return false when filter was updated 2 days and 23 hours before league start (within grace)", () => {
      // Just inside the 3-day window
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-29T01:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return true when filter was updated 4 days before league start (outside grace)", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-28T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(true);
    });

    // ─── Invalid / edge inputs ─────────────────────────────────────────

    it("should return false for invalid filter date string", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "not-a-date",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should return false for invalid league date string", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-07-01T00:00:00Z",
        "not-a-date",
      );

      expect(result).toBe(false);
    });

    it("should return false when both dates are invalid", () => {
      const result = RarityModelMapper.isFilterOutdated("invalid1", "invalid2");

      expect(result).toBe(false);
    });

    it("should handle ISO date strings with timezone offsets", () => {
      // Filter updated 4 days before league start (beyond 3-day grace)
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-27T12:00:00+00:00",
        "2025-06-01T00:00:00+00:00",
      );

      expect(result).toBe(true);
    });

    it("should not be outdated for timezone offset dates within grace window", () => {
      // Filter updated 1 hour before league start
      const result = RarityModelMapper.isFilterOutdated(
        "2025-05-31T23:00:00+00:00",
        "2025-06-01T00:00:00+00:00",
      );

      expect(result).toBe(false);
    });

    it("should handle date-only strings", () => {
      // Jan 1 vs Jun 1 → well outside 3-day window
      const result = RarityModelMapper.isFilterOutdated(
        "2025-01-01",
        "2025-06-01",
      );

      expect(result).toBe(true);
    });

    it("should handle very old filter dates", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2020-01-01T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(true);
    });

    it("should handle future dates correctly", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2030-01-01T00:00:00Z",
        "2025-06-01T00:00:00Z",
      );

      expect(result).toBe(false);
    });

    it("should handle empty string for filter date", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "",
        "2025-06-01T00:00:00Z",
      );

      // Empty string is technically not null, but Date parsing of "" gives invalid date
      expect(result).toBe(false);
    });

    it("should handle empty string for league date", () => {
      const result = RarityModelMapper.isFilterOutdated(
        "2025-07-01T00:00:00Z",
        "",
      );

      expect(result).toBe(false);
    });

    // ─── Grace period constant ─────────────────────────────────────────

    it("should expose a 3-day grace period constant", () => {
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      expect(RarityModelMapper.OUTDATED_GRACE_PERIOD_MS).toBe(threeDaysMs);
    });
  });
});
