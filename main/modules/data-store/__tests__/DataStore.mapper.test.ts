import { describe, expect, it } from "vitest";

import type { GlobalStatsTable } from "~/main/modules/database";

import { DataStoreMapper } from "../DataStore.mapper";

describe("DataStoreMapper", () => {
  // ─── toCardDTO ─────────────────────────────────────────────────────────────

  describe("toCardDTO", () => {
    it("should map a CardsTable row to CardDTO", () => {
      const row = {
        id: 1,
        game: "poe1",
        scope: "all-time",
        card_name: "The Doctor",
        count: 5,
        last_updated: "2025-01-15T10:30:00Z",
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      expect(result).toEqual({
        cardName: "The Doctor",
        count: 5,
        lastUpdated: "2025-01-15T10:30:00Z",
      });
    });

    it("should handle null last_updated", () => {
      const row = {
        id: 2,
        game: "poe2",
        scope: "Settlers",
        card_name: "The Surgeon",
        count: 12,
        last_updated: null,
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      expect(result).toEqual({
        cardName: "The Surgeon",
        count: 12,
        lastUpdated: null,
      });
    });

    it("should map card_name to cardName (snake_case to camelCase)", () => {
      const row = {
        id: 3,
        game: "poe1",
        scope: "all-time",
        card_name: "A Chilling Wind",
        count: 1,
        last_updated: "2025-06-01T00:00:00Z",
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      expect(result.cardName).toBe("A Chilling Wind");
      expect(result).not.toHaveProperty("card_name");
    });

    it("should only include cardName, count, and lastUpdated in the DTO", () => {
      const row = {
        id: 99,
        game: "poe1",
        scope: "league-specific",
        card_name: "The Fiend",
        count: 3,
        last_updated: "2025-03-01T00:00:00Z",
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      const keys = Object.keys(result);
      expect(keys).toHaveLength(3);
      expect(keys).toContain("cardName");
      expect(keys).toContain("count");
      expect(keys).toContain("lastUpdated");
    });

    it("should handle zero count", () => {
      const row = {
        id: 4,
        game: "poe1",
        scope: "all-time",
        card_name: "Rain of Chaos",
        count: 0,
        last_updated: null,
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      expect(result.count).toBe(0);
    });

    it("should handle large count values", () => {
      const row = {
        id: 5,
        game: "poe1",
        scope: "all-time",
        card_name: "Emperor's Luck",
        count: 999999,
        last_updated: "2025-12-31T23:59:59Z",
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      expect(result.count).toBe(999999);
    });

    it("should handle card names with special characters", () => {
      const row = {
        id: 6,
        game: "poe1",
        scope: "all-time",
        card_name: "The King's Blade",
        count: 2,
        last_updated: "2025-01-01T00:00:00Z",
      };

      const result = DataStoreMapper.toCardDTO(row as any);

      expect(result.cardName).toBe("The King's Blade");
    });
  });

  // ─── toGlobalStatDTO ───────────────────────────────────────────────────────

  describe("toGlobalStatDTO", () => {
    it("should map a GlobalStatsTable row to GlobalStatDTO", () => {
      const row: GlobalStatsTable = {
        key: "totalStackedDecksOpened",
        value: 1500,
      };

      const result = DataStoreMapper.toGlobalStatDTO(row);

      expect(result).toEqual({
        key: "totalStackedDecksOpened",
        value: 1500,
      });
    });

    it("should handle zero value", () => {
      const row: GlobalStatsTable = {
        key: "totalStackedDecksOpened",
        value: 0,
      };

      const result = DataStoreMapper.toGlobalStatDTO(row);

      expect(result.value).toBe(0);
    });

    it("should handle large values", () => {
      const row: GlobalStatsTable = {
        key: "totalStackedDecksOpened",
        value: 1_000_000,
      };

      const result = DataStoreMapper.toGlobalStatDTO(row);

      expect(result.value).toBe(1_000_000);
    });

    it("should only include key and value in the DTO", () => {
      const row: GlobalStatsTable = {
        key: "totalStackedDecksOpened",
        value: 42,
      };

      const result = DataStoreMapper.toGlobalStatDTO(row);

      const keys = Object.keys(result);
      expect(keys).toHaveLength(2);
      expect(keys).toContain("key");
      expect(keys).toContain("value");
    });

    it("should preserve the key string exactly", () => {
      const row: GlobalStatsTable = {
        key: "someArbitraryKey",
        value: 7,
      };

      const result = DataStoreMapper.toGlobalStatDTO(row);

      expect(result.key).toBe("someArbitraryKey");
    });
  });
});
