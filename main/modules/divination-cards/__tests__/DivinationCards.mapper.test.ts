import { describe, expect, it } from "vitest";

import type { DivinationCardsRow } from "~/main/modules/database";

import { DivinationCardsMapper } from "../DivinationCards.mapper";

/**
 * Row type with optional rarity (mirrors the joined type used in the mapper)
 */
interface DivinationCardWithRarityRow extends DivinationCardsRow {
  rarity?: number;
}

/**
 * Factory to create a realistic DivinationCardsRow with sensible defaults.
 * Override any field as needed per test.
 */
function createDivinationCardRow(
  overrides: Partial<DivinationCardWithRarityRow> = {},
): DivinationCardWithRarityRow {
  return {
    id: "poe1_the-doctor",
    name: "The Doctor",
    stack_size: 8,
    description: "A powerful card",
    reward_html: "Headhunter",
    art_src: "https://example.com/doctor.png",
    flavour_html: "A taste of power",
    game: "poe1",
    data_hash: "abc123",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

describe("DivinationCards.mapper", () => {
  // ─── Basic Field Mapping ─────────────────────────────────────────────

  describe("toDTO", () => {
    it("should map all basic fields correctly", () => {
      const row = createDivinationCardRow();
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.id).toBe("poe1_the-doctor");
      expect(dto.name).toBe("The Doctor");
      expect(dto.stackSize).toBe(8);
      expect(dto.description).toBe("A powerful card");
      expect(dto.artSrc).toBe("https://example.com/doctor.png");
      expect(dto.game).toBe("poe1");
      expect(dto.createdAt).toBe("2025-01-01T00:00:00Z");
      expect(dto.updatedAt).toBe("2025-01-15T00:00:00Z");
    });

    it("should map snake_case fields to camelCase", () => {
      const row = createDivinationCardRow({
        stack_size: 12,
        art_src: "https://example.com/art.png",
        created_at: "2025-06-01T00:00:00Z",
        updated_at: "2025-06-15T00:00:00Z",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.stackSize).toBe(12);
      expect(dto.artSrc).toBe("https://example.com/art.png");
      expect(dto.createdAt).toBe("2025-06-01T00:00:00Z");
      expect(dto.updatedAt).toBe("2025-06-15T00:00:00Z");
    });

    it("should handle poe2 game type", () => {
      const row = createDivinationCardRow({
        id: "poe2_the-scout",
        name: "The Scout",
        game: "poe2",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.id).toBe("poe2_the-scout");
      expect(dto.game).toBe("poe2");
    });

    it("should map different stack sizes", () => {
      for (const stackSize of [1, 3, 5, 8, 10, 16]) {
        const row = createDivinationCardRow({ stack_size: stackSize });
        const dto = DivinationCardsMapper.toDTO(row);
        expect(dto.stackSize).toBe(stackSize);
      }
    });
  });

  // ─── Rarity Handling ─────────────────────────────────────────────────

  describe("rarity", () => {
    it("should default rarity to 4 (common) when not provided", () => {
      const row = createDivinationCardRow();
      // rarity is undefined by default from factory
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(4);
    });

    it("should use provided rarity when present", () => {
      const row = createDivinationCardRow({ rarity: 1 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(1);
    });

    it("should map rarity 1 (extremely rare)", () => {
      const row = createDivinationCardRow({ rarity: 1 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(1);
    });

    it("should map rarity 2 (rare)", () => {
      const row = createDivinationCardRow({ rarity: 2 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(2);
    });

    it("should map rarity 3 (less common)", () => {
      const row = createDivinationCardRow({ rarity: 3 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(3);
    });

    it("should map rarity 4 (common)", () => {
      const row = createDivinationCardRow({ rarity: 4 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(4);
    });

    it("should default rarity to 4 when rarity is explicitly undefined", () => {
      const row = createDivinationCardRow({ rarity: undefined });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rarity).toBe(4);
    });
  });

  // ─── cleanWikiMarkup Integration ─────────────────────────────────────

  describe("cleanWikiMarkup integration", () => {
    it("should clean wiki markup from rewardHtml", () => {
      const row = createDivinationCardRow({
        reward_html: "[[Headhunter|Headhunter]]",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      // cleanWikiMarkup should strip wiki-style [[link|text]] formatting
      expect(dto.rewardHtml).not.toContain("[[");
      expect(dto.rewardHtml).not.toContain("]]");
    });

    it("should clean wiki markup from flavourHtml", () => {
      const row = createDivinationCardRow({
        flavour_html: "[[Some Link|Display Text]]",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.flavourHtml).not.toContain("[[");
      expect(dto.flavourHtml).not.toContain("]]");
    });

    it("should pass through plain text rewardHtml unchanged", () => {
      const row = createDivinationCardRow({
        reward_html: "Headhunter Leather Belt",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rewardHtml).toBe("Headhunter Leather Belt");
    });

    it("should pass through plain text flavourHtml unchanged", () => {
      const row = createDivinationCardRow({
        flavour_html: "A simple flavour text",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.flavourHtml).toBe("A simple flavour text");
    });

    it("should handle empty strings for rewardHtml", () => {
      const row = createDivinationCardRow({ reward_html: "" });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.rewardHtml).toBe("");
    });

    it("should handle null flavourHtml gracefully", () => {
      const row = createDivinationCardRow({
        flavour_html: null as unknown as string,
      });
      const dto = DivinationCardsMapper.toDTO(row);

      // Should not throw; cleanWikiMarkup should handle null/empty input
      expect(dto.flavourHtml).toBeDefined();
    });

    it("should handle rewardHtml with HTML tags", () => {
      const row = createDivinationCardRow({
        reward_html: "<span class='rare'>Headhunter</span>",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      // cleanWikiMarkup primarily strips wiki markup, HTML may pass through
      expect(dto.rewardHtml).toBeDefined();
      expect(typeof dto.rewardHtml).toBe("string");
    });

    it("should handle flavourHtml with wiki templates", () => {
      const row = createDivinationCardRow({
        flavour_html: "{{c|red|A dark omen}}",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      // cleanWikiMarkup should process template syntax
      expect(dto.flavourHtml).toBeDefined();
      expect(typeof dto.flavourHtml).toBe("string");
    });
  });

  // ─── Full DTO Shape ──────────────────────────────────────────────────

  describe("full DTO shape", () => {
    it("should produce a DTO with the correct set of keys", () => {
      const row = createDivinationCardRow({ rarity: 2 });
      const dto = DivinationCardsMapper.toDTO(row);

      const expectedKeys = [
        "id",
        "name",
        "stackSize",
        "description",
        "rewardHtml",
        "artSrc",
        "flavourHtml",
        "rarity",
        "game",
        "createdAt",
        "updatedAt",
      ];

      expect(Object.keys(dto).sort()).toEqual(expectedKeys.sort());
    });

    it("should produce a fully populated DTO from a realistic card", () => {
      const row: DivinationCardWithRarityRow = {
        id: "poe1_rain-of-chaos",
        name: "Rain of Chaos",
        stack_size: 8,
        description: "Drops in any area",
        reward_html: "Chaos Orb",
        art_src: "https://example.com/rain-of-chaos.png",
        flavour_html: "Chaos reigns",
        game: "poe1",
        data_hash: "hash456",
        created_at: "2025-03-01T12:00:00Z",
        updated_at: "2025-03-10T15:30:00Z",
        rarity: 4,
      };
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto).toEqual({
        id: "poe1_rain-of-chaos",
        name: "Rain of Chaos",
        stackSize: 8,
        description: "Drops in any area",
        rewardHtml: "Chaos Orb",
        artSrc: "https://example.com/rain-of-chaos.png",
        flavourHtml: "Chaos reigns",
        rarity: 4,
        game: "poe1",
        createdAt: "2025-03-01T12:00:00Z",
        updatedAt: "2025-03-10T15:30:00Z",
      });
    });

    it("should map a rare PoE2 card correctly", () => {
      const row: DivinationCardWithRarityRow = {
        id: "poe2_the-apothecary",
        name: "The Apothecary",
        stack_size: 5,
        description: "A rare find",
        reward_html: "Mageblood",
        art_src: "https://example.com/apothecary.png",
        flavour_html: "The cure is worse than the disease",
        game: "poe2",
        data_hash: "rare789",
        created_at: "2025-02-01T00:00:00Z",
        updated_at: "2025-02-20T00:00:00Z",
        rarity: 1,
      };
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.id).toBe("poe2_the-apothecary");
      expect(dto.name).toBe("The Apothecary");
      expect(dto.stackSize).toBe(5);
      expect(dto.game).toBe("poe2");
      expect(dto.rarity).toBe(1);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle card names with special characters", () => {
      const row = createDivinationCardRow({
        id: "poe1_the-kings-heart",
        name: "The King's Heart",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.name).toBe("The King's Heart");
    });

    it("should handle card names with 'The' prefix", () => {
      const row = createDivinationCardRow({
        id: "poe1_the-fiend",
        name: "The Fiend",
      });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.name).toBe("The Fiend");
    });

    it("should handle stack size of 1", () => {
      const row = createDivinationCardRow({ stack_size: 1 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.stackSize).toBe(1);
    });

    it("should handle large stack sizes", () => {
      const row = createDivinationCardRow({ stack_size: 20 });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.stackSize).toBe(20);
    });

    it("should handle long description text", () => {
      const longDescription =
        "This is a very long description that might appear on some divination cards with detailed lore about the Path of Exile universe.";
      const row = createDivinationCardRow({ description: longDescription });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.description).toBe(longDescription);
    });

    it("should handle empty description", () => {
      const row = createDivinationCardRow({ description: "" });
      const dto = DivinationCardsMapper.toDTO(row);

      expect(dto.description).toBe("");
    });

    it("should preserve the data_hash but not include it in DTO", () => {
      const row = createDivinationCardRow({ data_hash: "unique-hash-value" });
      const dto = DivinationCardsMapper.toDTO(row);

      // data_hash is not mapped to the DTO
      expect("dataHash" in dto).toBe(false);
      expect("data_hash" in dto).toBe(false);
    });
  });
});
