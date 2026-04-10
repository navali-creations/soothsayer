import { describe, expect, it } from "vitest";

import type { GlobalStatsTable } from "~/main/modules/database";

import type { CardWithMetadataRow } from "../DataStore.mapper";
import { DataStoreMapper } from "../DataStore.mapper";

describe("DataStoreMapper", () => {
  // ─── toCardDTO ─────────────────────────────────────────────────────────────

  describe("toCardDTO", () => {
    it("should map a row with no divination card metadata to CardDTO without divinationCard", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Doctor",
        count: 5,
        last_updated: "2025-01-15T10:30:00Z",
        dc_id: null,
        dc_stack_size: null,
        dc_description: null,
        dc_reward_html: null,
        dc_art_src: null,
        dc_flavour_html: null,
        dc_from_boss: null,
        dc_is_disabled: null,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result).toEqual({
        cardName: "The Doctor",
        count: 5,
        lastUpdated: "2025-01-15T10:30:00Z",
      });
      expect(result.divinationCard).toBeUndefined();
    });

    it("should map a row with divination card metadata to CardDTO with divinationCard", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Doctor",
        count: 5,
        last_updated: "2025-01-15T10:30:00Z",
        dc_id: "poe1_the-doctor",
        dc_stack_size: 8,
        dc_description: "A powerful card",
        dc_reward_html: "<p>Headhunter</p>",
        dc_art_src: "https://example.com/doctor.png",
        dc_flavour_html: "<p>Some flavour text</p>",
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: 1,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result).toEqual({
        cardName: "The Doctor",
        count: 5,
        lastUpdated: "2025-01-15T10:30:00Z",
        divinationCard: {
          id: "poe1_the-doctor",
          stackSize: 8,
          description: "A powerful card",
          rewardHtml: "<p>Headhunter</p>",
          artSrc: "https://example.com/doctor.png",
          flavourHtml: "<p>Some flavour text</p>",
          rarity: 1,
          fromBoss: false,
          isDisabled: false,
        },
      });
    });

    it("should handle null last_updated", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Surgeon",
        count: 12,
        last_updated: null,
        dc_id: null,
        dc_stack_size: null,
        dc_description: null,
        dc_reward_html: null,
        dc_art_src: null,
        dc_flavour_html: null,
        dc_from_boss: null,
        dc_is_disabled: null,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result).toEqual({
        cardName: "The Surgeon",
        count: 12,
        lastUpdated: null,
      });
    });

    it("should map card_name to cardName (snake_case to camelCase)", () => {
      const row: CardWithMetadataRow = {
        card_name: "A Chilling Wind",
        count: 1,
        last_updated: "2025-06-01T00:00:00Z",
        dc_id: null,
        dc_stack_size: null,
        dc_description: null,
        dc_reward_html: null,
        dc_art_src: null,
        dc_flavour_html: null,
        dc_from_boss: null,
        dc_is_disabled: null,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.cardName).toBe("A Chilling Wind");
      expect(result).not.toHaveProperty("card_name");
    });

    it("should handle zero count", () => {
      const row: CardWithMetadataRow = {
        card_name: "Rain of Chaos",
        count: 0,
        last_updated: null,
        dc_id: null,
        dc_stack_size: null,
        dc_description: null,
        dc_reward_html: null,
        dc_art_src: null,
        dc_flavour_html: null,
        dc_from_boss: null,
        dc_is_disabled: null,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.count).toBe(0);
    });

    it("should handle large count values", () => {
      const row: CardWithMetadataRow = {
        card_name: "Emperor's Luck",
        count: 999999,
        last_updated: "2025-12-31T23:59:59Z",
        dc_id: null,
        dc_stack_size: null,
        dc_description: null,
        dc_reward_html: null,
        dc_art_src: null,
        dc_flavour_html: null,
        dc_from_boss: null,
        dc_is_disabled: null,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.count).toBe(999999);
    });

    it("should handle card names with special characters", () => {
      const row: CardWithMetadataRow = {
        card_name: "The King's Blade",
        count: 2,
        last_updated: "2025-01-01T00:00:00Z",
        dc_id: null,
        dc_stack_size: null,
        dc_description: null,
        dc_reward_html: null,
        dc_art_src: null,
        dc_flavour_html: null,
        dc_from_boss: null,
        dc_is_disabled: null,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.cardName).toBe("The King's Blade");
    });

    // ─── Divination card metadata mapping ──────────────────────────────────

    it("should map fromBoss correctly when dc_from_boss is 1", () => {
      const row: CardWithMetadataRow = {
        card_name: "House of Mirrors",
        count: 1,
        last_updated: "2025-03-01T00:00:00Z",
        dc_id: "poe1_house-of-mirrors",
        dc_stack_size: 2,
        dc_description: "A mirror card",
        dc_reward_html: "<p>Mirror of Kalandra</p>",
        dc_art_src: "https://example.com/hom.png",
        dc_flavour_html: null,
        dc_from_boss: 1,
        dc_is_disabled: 0,
        dc_rarity: 1,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard?.fromBoss).toBe(true);
    });

    it("should map fromBoss correctly when dc_from_boss is 0", () => {
      const row: CardWithMetadataRow = {
        card_name: "Rain of Chaos",
        count: 50,
        last_updated: "2025-03-01T00:00:00Z",
        dc_id: "poe1_rain-of-chaos",
        dc_stack_size: 8,
        dc_description: "Common card",
        dc_reward_html: "<p>Chaos Orb</p>",
        dc_art_src: "https://example.com/roc.png",
        dc_flavour_html: "<p>Flavour</p>",
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: 4,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard?.fromBoss).toBe(false);
    });

    it("should default rarity to 4 when dc_rarity is null", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Fiend",
        count: 1,
        last_updated: "2025-03-01T00:00:00Z",
        dc_id: "poe1_the-fiend",
        dc_stack_size: 11,
        dc_description: "A fiendish card",
        dc_reward_html: "<p>Headhunter</p>",
        dc_art_src: "https://example.com/fiend.png",
        dc_flavour_html: null,
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: null,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard?.rarity).toBe(4);
    });

    it("should handle null flavourHtml in divination card metadata", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Wretched",
        count: 3,
        last_updated: "2025-03-01T00:00:00Z",
        dc_id: "poe1_the-wretched",
        dc_stack_size: 6,
        dc_description: "A wretched card",
        dc_reward_html: "<p>Belt</p>",
        dc_art_src: "https://example.com/wretched.png",
        dc_flavour_html: null,
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: 3,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard).toBeDefined();
      // Mapper uses ?? "" fallback for null flavour_html
      expect(result.divinationCard?.flavourHtml).toBe("");
    });

    it("should clean wiki markup in rewardHtml and flavourHtml", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Doctor",
        count: 1,
        last_updated: "2025-03-01T00:00:00Z",
        dc_id: "poe1_the-doctor",
        dc_stack_size: 8,
        dc_description: "A powerful card",
        dc_reward_html: '<span class="tc -unique">Headhunter</span>',
        dc_art_src: "https://example.com/doctor.png",
        dc_flavour_html: "<i>A taste of power</i>",
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: 1,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard).toBeDefined();
      // cleanWikiMarkup passes through plain HTML unchanged (no wiki markup to strip)
      expect(result.divinationCard?.rewardHtml).toBe(
        '<span class="tc -unique">Headhunter</span>',
      );
      expect(result.divinationCard?.flavourHtml).toBe(
        "<i>A taste of power</i>",
      );
    });

    it("should preserve all rarity values (0-4)", () => {
      const rarities = [0, 1, 2, 3, 4] as const;

      for (const rarity of rarities) {
        const row: CardWithMetadataRow = {
          card_name: `Card Rarity ${rarity}`,
          count: 1,
          last_updated: "2025-03-01T00:00:00Z",
          dc_id: `poe1_card-rarity-${rarity}`,
          dc_stack_size: 1,
          dc_description: "Test",
          dc_reward_html: "<p>Test</p>",
          dc_art_src: "art.png",
          dc_flavour_html: null,
          dc_from_boss: 0,
          dc_is_disabled: 0,
          dc_rarity: rarity,
        };

        const result = DataStoreMapper.toCardDTO(row);

        expect(result.divinationCard?.rarity).toBe(rarity);
      }
    });

    it("should not include divinationCard when dc_id is null even if other dc_ fields have values", () => {
      // This simulates a scenario where LEFT JOIN returns partial data
      // (shouldn't happen in practice, but testing defensive behavior)
      const row: CardWithMetadataRow = {
        card_name: "Ghost Card",
        count: 1,
        last_updated: "2025-03-01T00:00:00Z",
        dc_id: null,
        dc_stack_size: 5,
        dc_description: "Orphaned data",
        dc_reward_html: "<p>Something</p>",
        dc_art_src: "art.png",
        dc_flavour_html: null,
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: 2,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard).toBeUndefined();
    });

    it("should include all expected keys when divinationCard is present", () => {
      const row: CardWithMetadataRow = {
        card_name: "The Doctor",
        count: 1,
        last_updated: "2025-01-01T00:00:00Z",
        dc_id: "poe1_the-doctor",
        dc_stack_size: 8,
        dc_description: "desc",
        dc_reward_html: "<p>reward</p>",
        dc_art_src: "art.png",
        dc_flavour_html: "<p>flavour</p>",
        dc_from_boss: 0,
        dc_is_disabled: 0,
        dc_rarity: 1,
      };

      const result = DataStoreMapper.toCardDTO(row);

      expect(result.divinationCard).toBeDefined();
      const dcKeys = Object.keys(result.divinationCard!);
      expect(dcKeys).toContain("id");
      expect(dcKeys).toContain("stackSize");
      expect(dcKeys).toContain("description");
      expect(dcKeys).toContain("rewardHtml");
      expect(dcKeys).toContain("artSrc");
      expect(dcKeys).toContain("flavourHtml");
      expect(dcKeys).toContain("rarity");
      expect(dcKeys).toContain("fromBoss");
      expect(dcKeys).toContain("isDisabled");
      expect(dcKeys).toHaveLength(9);
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
