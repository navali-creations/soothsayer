import { describe, expect, it } from "vitest";

import type { RelatedCardDTO } from "~/main/modules/card-details/CardDetails.dto";
import {
  getCardImage,
  getDisplayRarity,
  toCardEntry,
} from "~/renderer/modules/card-details/CardDetails.components/CardDetailsRelatedCards/helpers";
import type { Rarity } from "~/types/data-stores";

// ─── getCardImage ──────────────────────────────────────────────────────────

describe("getCardImage", () => {
  it("returns empty string for an art filename that doesn't match any imported image", () => {
    const result = getCardImage("nonexistent-card.png");
    expect(result).toBe("");
  });

  it("returns empty string for an empty artSrc", () => {
    const result = getCardImage("");
    expect(result).toBe("");
  });
});

// ─── getDisplayRarity ──────────────────────────────────────────────────────

describe("getDisplayRarity", () => {
  it("returns prohibitedLibraryRarity when it is present", () => {
    const dto = {
      rarity: 3 as Rarity,
      prohibitedLibraryRarity: 1 as Rarity,
    } as RelatedCardDTO;

    expect(getDisplayRarity(dto)).toBe(1);
  });

  it("falls back to ninja rarity when prohibitedLibraryRarity is null", () => {
    const dto = {
      rarity: 2 as Rarity,
      prohibitedLibraryRarity: null,
    } as RelatedCardDTO;

    expect(getDisplayRarity(dto)).toBe(2);
  });

  it("returns 0 (unknown) when prohibitedLibraryRarity is 0", () => {
    const dto = {
      rarity: 3 as Rarity,
      prohibitedLibraryRarity: 0 as Rarity,
    } as RelatedCardDTO;

    // 0 is falsy but ?? only checks null/undefined, so 0 should be returned
    expect(getDisplayRarity(dto)).toBe(0);
  });

  it("handles all rarity tiers correctly", () => {
    for (const tier of [0, 1, 2, 3, 4] as Rarity[]) {
      const dto = {
        rarity: 0 as Rarity,
        prohibitedLibraryRarity: tier,
      } as RelatedCardDTO;
      expect(getDisplayRarity(dto)).toBe(tier);
    }
  });
});

// ─── toCardEntry ───────────────────────────────────────────────────────────

describe("toCardEntry", () => {
  function makeRelatedCardDTO(
    overrides: Partial<RelatedCardDTO> = {},
  ): RelatedCardDTO {
    return {
      name: "The Doctor",
      artSrc: "the-doctor.png",
      stackSize: 8,
      description: "A powerful card",
      rewardHtml: "<span>Headhunter</span>",
      flavourHtml: "<em>Some flavour text</em>",
      rarity: 1 as Rarity,
      filterRarity: 1,
      prohibitedLibraryRarity: null,
      fromBoss: false,
      relationship: "similar" as const,
      ...overrides,
    };
  }

  it("converts a RelatedCardDTO to a CardEntry shape", () => {
    const dto = makeRelatedCardDTO();
    const entry = toCardEntry(dto);

    expect(entry.name).toBe("The Doctor");
    expect(entry.count).toBe(0);
    expect(entry.divinationCard).toBeDefined();
  });

  it("maps divinationCard fields correctly", () => {
    const dto = makeRelatedCardDTO({
      stackSize: 5,
      description: "Test description",
      rewardHtml: "<b>reward</b>",
      artSrc: "test-art.png",
      flavourHtml: "<i>flavour</i>",
      filterRarity: 2,
      fromBoss: true,
    });

    const entry = toCardEntry(dto);
    const dc = entry.divinationCard!;

    expect(dc.stackSize).toBe(5);
    expect(dc.description).toBe("Test description");
    expect(dc.rewardHtml).toBe("<b>reward</b>");
    expect(dc.artSrc).toBe("test-art.png");
    expect(dc.flavourHtml).toBe("<i>flavour</i>");
    expect(dc.filterRarity).toBe(2);
    expect(dc.fromBoss).toBe(true);
  });

  it("uses getDisplayRarity for the rarity field (prefers PL rarity)", () => {
    const dto = makeRelatedCardDTO({
      rarity: 4 as Rarity,
      prohibitedLibraryRarity: 1 as Rarity,
    });

    const entry = toCardEntry(dto);
    // getDisplayRarity should pick prohibitedLibraryRarity (1) over rarity (4)
    expect(entry.divinationCard!.rarity).toBe(1);
  });

  it("uses ninja rarity when prohibitedLibraryRarity is null", () => {
    const dto = makeRelatedCardDTO({
      rarity: 3 as Rarity,
      prohibitedLibraryRarity: null,
    });

    const entry = toCardEntry(dto);
    expect(entry.divinationCard!.rarity).toBe(3);
  });

  it("always sets count to 0", () => {
    const dto = makeRelatedCardDTO();
    const entry = toCardEntry(dto);
    expect(entry.count).toBe(0);
  });

  it("preserves the card name exactly", () => {
    const dto = makeRelatedCardDTO({ name: "The Nurse" });
    const entry = toCardEntry(dto);
    expect(entry.name).toBe("The Nurse");
  });

  it("handles cards with special characters in name", () => {
    const dto = makeRelatedCardDTO({ name: "The King's Heart" });
    const entry = toCardEntry(dto);
    expect(entry.name).toBe("The King's Heart");
  });
});
