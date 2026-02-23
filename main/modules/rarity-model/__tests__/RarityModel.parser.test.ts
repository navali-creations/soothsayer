import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { RarityModelParser, type TierBlock } from "../RarityModel.parser";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

/**
 * Minimal valid filter content with a divination cards section.
 * Contains TOC + section header + tier blocks with BaseType lines.
 */
function makeValidFilterContent(options?: {
  sectionId?: string;
  tiers?: Array<{ tier: string; cards: string[] }>;
  extraSectionsAfter?: boolean;
}): string {
  const sectionId = options?.sectionId ?? "4200";
  const tiers = options?.tiers ?? [
    { tier: "t1", cards: ["The Doctor", "House of Mirrors"] },
    { tier: "t2", cards: ["The Nurse", "The Fiend"] },
    { tier: "t3", cards: ["The Cartographer", "The Wretched"] },
    { tier: "t4c", cards: ["Rain of Chaos"] },
    { tier: "t5", cards: ["The Carrion Crow", "The Hermit"] },
  ];

  const tocLines = [
    "# ==========================================",
    "# NeverSink's LOOT FILTER",
    "# ==========================================",
    "",
    "# WELCOME] TABLE OF CONTENTS",
    "#",
    `# [[${sectionId}]] Divination Cards`,
    "# [[4300]] Unique Maps",
    "# [[4400]] Currency",
    "",
  ];

  const sectionHeader = [`# [[${sectionId}]] Divination Cards`, ""];

  const tierLines: string[] = [];
  for (const tier of tiers) {
    const quotedCards = tier.cards.map((c) => `"${c}"`).join(" ");
    tierLines.push(`Show # $type->divination $tier->${tier.tier}`);
    tierLines.push(`    BaseType == ${quotedCards}`);
    tierLines.push("    SetFontSize 45");
    tierLines.push("    SetBorderColor 255 0 0");
    tierLines.push("");
  }

  const afterSection = options?.extraSectionsAfter
    ? [
        "# [[4300]] Unique Maps",
        "Show # some other block",
        '    BaseType == "Maze of the Minotaur"',
        "",
      ]
    : [];

  return [...tocLines, ...sectionHeader, ...tierLines, ...afterSection].join(
    "\n",
  );
}

/**
 * Filter content with NO divination cards section in the TOC.
 */
function makeFilterWithoutDivination(): string {
  return [
    "# ==========================================",
    "# NeverSink's LOOT FILTER",
    "# ==========================================",
    "",
    "# WELCOME] TABLE OF CONTENTS",
    "#",
    "# [[4300]] Unique Maps",
    "# [[4400]] Currency",
    "",
    "# [[4300]] Unique Maps",
    "Show # some block",
    '    BaseType == "Maze of the Minotaur"',
    "",
  ].join("\n");
}

/**
 * Filter content where the TOC references a section that doesn't exist in the body.
 */
function makeFilterWithMissingSectionBody(): string {
  return [
    "# ==========================================",
    "# WELCOME] TABLE OF CONTENTS",
    "#",
    "# [[4200]] Divination Cards",
    "# [[4300]] Unique Maps",
    "",
    "# [[4300]] Unique Maps",
    "Show # some block",
    '    BaseType == "Maze of the Minotaur"',
    "",
  ].join("\n");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RarityModelParser", () => {
  // ============================================================================
  // parseFilterContent - Integration-level tests
  // ============================================================================

  describe("parseFilterContent", () => {
    it("should parse a valid filter and extract card rarities", () => {
      const content = makeValidFilterContent();
      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(true);
      expect(result.totalCards).toBe(9);
      expect(result.cardRarities.size).toBe(9);

      // T1 → rarity 1
      expect(result.cardRarities.get("The Doctor")).toBe(1);
      expect(result.cardRarities.get("House of Mirrors")).toBe(1);

      // T2 → rarity 2
      expect(result.cardRarities.get("The Nurse")).toBe(2);
      expect(result.cardRarities.get("The Fiend")).toBe(2);

      // T3 → rarity 2
      expect(result.cardRarities.get("The Cartographer")).toBe(2);
      expect(result.cardRarities.get("The Wretched")).toBe(2);

      // T4c → rarity 3
      expect(result.cardRarities.get("Rain of Chaos")).toBe(3);

      // T5 → rarity 4
      expect(result.cardRarities.get("The Carrion Crow")).toBe(4);
      expect(result.cardRarities.get("The Hermit")).toBe(4);
    });

    it("should return hasDivinationSection=false when no divination TOC entry exists", () => {
      const content = makeFilterWithoutDivination();
      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(false);
      expect(result.totalCards).toBe(0);
      expect(result.cardRarities.size).toBe(0);
    });

    it("should return hasDivinationSection=true with 0 cards when TOC entry exists but section body has no tier blocks", () => {
      const content = makeFilterWithMissingSectionBody();
      const result = RarityModelParser.parseFilterContent(content);

      // The section header exists (even if only as the TOC entry), so
      // hasDivinationSection is true — but with 0 cards extracted.
      // The service layer handles this by defaulting all cards to rarity 4.
      expect(result.hasDivinationSection).toBe(true);
      expect(result.totalCards).toBe(0);
      expect(result.cardRarities.size).toBe(0);
    });

    it("should handle empty content", () => {
      const result = RarityModelParser.parseFilterContent("");

      expect(result.hasDivinationSection).toBe(false);
      expect(result.totalCards).toBe(0);
      expect(result.cardRarities.size).toBe(0);
    });

    it("should stop extracting cards when the next section starts", () => {
      const content = makeValidFilterContent({
        tiers: [{ tier: "t1", cards: ["The Doctor"] }],
        extraSectionsAfter: true,
      });
      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(true);
      expect(result.totalCards).toBe(1);
      expect(result.cardRarities.get("The Doctor")).toBe(1);
      // Cards from the next section should NOT be included
      expect(result.cardRarities.has("Maze of the Minotaur")).toBe(false);
    });

    it("should handle all tier types with correct rarity mapping", () => {
      const content = makeValidFilterContent({
        tiers: [
          { tier: "t1", cards: ["Card T1"] },
          { tier: "t2", cards: ["Card T2"] },
          { tier: "t3", cards: ["Card T3"] },
          { tier: "tnew", cards: ["Card TNew"] },
          { tier: "t4c", cards: ["Card T4C"] },
          { tier: "t5c", cards: ["Card T5C"] },
          { tier: "t4", cards: ["Card T4"] },
          { tier: "t5", cards: ["Card T5"] },
          { tier: "restex", cards: ["Card RestEx"] },
        ],
      });
      const result = RarityModelParser.parseFilterContent(content);

      expect(result.cardRarities.get("Card T1")).toBe(1);
      expect(result.cardRarities.get("Card T2")).toBe(2);
      expect(result.cardRarities.get("Card T3")).toBe(2);
      expect(result.cardRarities.get("Card TNew")).toBe(2);
      expect(result.cardRarities.get("Card T4C")).toBe(3);
      expect(result.cardRarities.get("Card T5C")).toBe(4);
      expect(result.cardRarities.get("Card T4")).toBe(4);
      expect(result.cardRarities.get("Card T5")).toBe(4);
      expect(result.cardRarities.get("Card RestEx")).toBe(4);
    });

    it("should skip cards in ignored tiers (exstack, excustomstack)", () => {
      const content = makeValidFilterContent({
        tiers: [
          { tier: "exstack", cards: ["Stack Card 1"] },
          { tier: "excustomstack", cards: ["Stack Card 2"] },
          { tier: "t1", cards: ["The Doctor"] },
        ],
      });
      const result = RarityModelParser.parseFilterContent(content);

      expect(result.totalCards).toBe(1);
      expect(result.cardRarities.has("Stack Card 1")).toBe(false);
      expect(result.cardRarities.has("Stack Card 2")).toBe(false);
      expect(result.cardRarities.get("The Doctor")).toBe(1);
    });

    it("should handle Windows-style line endings (CRLF)", () => {
      const content = makeValidFilterContent({
        tiers: [{ tier: "t1", cards: ["The Doctor"] }],
      }).replace(/\n/g, "\r\n");

      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(true);
      expect(result.cardRarities.get("The Doctor")).toBe(1);
    });

    it("should use section ID from a different number", () => {
      const content = makeValidFilterContent({
        sectionId: "9999",
        tiers: [{ tier: "t1", cards: ["Custom ID Card"] }],
      });
      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(true);
      expect(result.cardRarities.get("Custom ID Card")).toBe(1);
    });
  });

  // ============================================================================
  // findDivinationSectionId
  // ============================================================================

  describe("findDivinationSectionId", () => {
    it("should extract section ID from a valid TOC", () => {
      const lines = [
        "# WELCOME] TABLE OF CONTENTS",
        "#",
        "# [[4200]] Divination Cards",
        "# [[4300]] Unique Maps",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("4200");
    });

    it("should handle different section IDs", () => {
      const lines = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[1234]] Divination Cards",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("1234");
    });

    it("should be case-insensitive for TABLE OF CONTENTS marker", () => {
      const lines = [
        "# welcome] table of contents",
        "# [[4200]] Divination Cards",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("4200");
    });

    it("should be case-insensitive for Divination Cards", () => {
      const lines = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] divination cards",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("4200");
    });

    it("should return null when no TOC marker is found", () => {
      const lines = ["# Some filter header", "# [[4200]] Divination Cards"];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBeNull();
    });

    it("should return null when TOC has no Divination Cards entry", () => {
      const lines = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4300]] Unique Maps",
        "# [[4400]] Currency",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBeNull();
    });

    it("should return null for empty lines", () => {
      const result = RarityModelParser.findDivinationSectionId([]);
      expect(result).toBeNull();
    });

    it("should stop searching at Show/Hide blocks", () => {
      const lines = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4300]] Unique Maps",
        "Show # some block",
        "# [[4200]] Divination Cards", // After Show — should not match
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBeNull();
    });

    it("should skip non-TOC lines before the TOC marker", () => {
      const lines = [
        "# NeverSink's LOOT FILTER",
        "# Version 1.0",
        "",
        "# [[9999]] Divination Cards", // Before TOC — should be skipped
        "",
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("4200");
    });

    it("should handle extra whitespace in TOC entry", () => {
      const lines = [
        "# WELCOME] TABLE OF CONTENTS",
        "#   [[4200]]   Divination   Cards  ",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("4200");
    });

    it("should handle TOC marker embedded in a longer line", () => {
      const lines = [
        "# [WELCOME] TABLE OF CONTENTS - Filter Guide",
        "# [[4200]] Divination Cards",
      ];
      const result = RarityModelParser.findDivinationSectionId(lines);
      expect(result).toBe("4200");
    });
  });

  // ============================================================================
  // findSectionStart
  // ============================================================================

  describe("findSectionStart", () => {
    it("should find the section header by ID", () => {
      const lines = [
        "# [[4200]] Divination Cards", // TOC entry (index 0)
        "",
        "# [[4300]] Unique Maps",
        "",
        "# [[4200]] Divination Cards", // Section body (index 4)
        "Show # $type->divination $tier->t1",
      ];
      const result = RarityModelParser.findSectionStart(lines, "4200");
      expect(result).toBe(4); // Should return the LAST occurrence
    });

    it("should return -1 when section ID is not found", () => {
      const lines = ["# [[4300]] Unique Maps", "# [[4400]] Currency"];
      const result = RarityModelParser.findSectionStart(lines, "4200");
      expect(result).toBe(-1);
    });

    it("should return -1 for empty lines", () => {
      const result = RarityModelParser.findSectionStart([], "4200");
      expect(result).toBe(-1);
    });

    it("should return the last occurrence when section appears multiple times", () => {
      const lines = [
        "# [[4200]] Divination Cards", // index 0
        "",
        "# [[4200]] Divination Cards", // index 2
        "",
        "# [[4200]] Divination Cards", // index 4
      ];
      const result = RarityModelParser.findSectionStart(lines, "4200");
      expect(result).toBe(4);
    });

    it("should handle single occurrence", () => {
      const lines = [
        "# [[4200]] Divination Cards",
        "Show # $type->divination $tier->t1",
      ];
      const result = RarityModelParser.findSectionStart(lines, "4200");
      expect(result).toBe(0);
    });

    it("should be case-insensitive", () => {
      const lines = ["# [[4200]] divination cards"];
      const result = RarityModelParser.findSectionStart(lines, "4200");
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // extractSectionLines
  // ============================================================================

  describe("extractSectionLines", () => {
    it("should extract lines from section header to the next section", () => {
      const lines = [
        "# [[4200]] Divination Cards", // index 0 (header)
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
        "# [[4300]] Unique Maps", // index 4 (next section)
        "Show # some block",
      ];
      const result = RarityModelParser.extractSectionLines(lines, 0);
      expect(result).toEqual([
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
      ]);
    });

    it("should extract lines until end of file if no next section", () => {
      const lines = [
        "# [[4200]] Divination Cards",
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
      ];
      const result = RarityModelParser.extractSectionLines(lines, 0);
      expect(result).toEqual([
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
      ]);
    });

    it("should return empty array when section header is the last line", () => {
      const lines = ["# [[4200]] Divination Cards"];
      const result = RarityModelParser.extractSectionLines(lines, 0);
      expect(result).toEqual([]);
    });

    it("should return empty array when next section immediately follows", () => {
      const lines = ["# [[4200]] Divination Cards", "# [[4300]] Unique Maps"];
      const result = RarityModelParser.extractSectionLines(lines, 0);
      expect(result).toEqual([]);
    });

    it("should not include the section header itself in the results", () => {
      const lines = [
        "some line before",
        "# [[4200]] Divination Cards",
        "content line",
      ];
      const result = RarityModelParser.extractSectionLines(lines, 1);
      expect(result).toEqual(["content line"]);
    });
  });

  // ============================================================================
  // parseTierBlocks
  // ============================================================================

  describe("parseTierBlocks", () => {
    it("should parse a single tier block with BaseType line", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor" "House of Mirrors"',
        "    SetFontSize 45",
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].tierName).toBe("t1");
      expect(result[0].rarity).toBe(1);
      expect(result[0].cardNames).toEqual(["The Doctor", "House of Mirrors"]);
    });

    it("should parse multiple tier blocks", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "    SetFontSize 45",
        "",
        "Show # $type->divination $tier->t3",
        '    BaseType == "The Wretched"',
        "    SetFontSize 40",
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(2);
      expect(result[0].tierName).toBe("t1");
      expect(result[0].cardNames).toEqual(["The Doctor"]);
      expect(result[1].tierName).toBe("t3");
      expect(result[1].cardNames).toEqual(["The Wretched"]);
    });

    it("should handle multi-line BaseType continuation", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        '        "House of Mirrors"',
        '        "The Fiend"',
        "    SetFontSize 45",
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].cardNames).toEqual([
        "The Doctor",
        "House of Mirrors",
        "The Fiend",
      ]);
    });

    it("should handle BaseType without == operator", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType "The Doctor" "The Nurse"',
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].cardNames).toEqual(["The Doctor", "The Nurse"]);
    });

    it("should return empty array for empty input", () => {
      const result = RarityModelParser.parseTierBlocks([]);
      expect(result).toEqual([]);
    });

    it("should return empty array when no tier blocks are found", () => {
      const lines = ["# Just some comments", "", "# More comments"];
      const result = RarityModelParser.parseTierBlocks(lines);
      expect(result).toEqual([]);
    });

    it("should handle tier blocks with no BaseType line", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        "    SetFontSize 45",
        "    SetBorderColor 255 0 0",
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].tierName).toBe("t1");
      expect(result[0].cardNames).toEqual([]);
    });

    it("should end a block when a non-tier Show/Hide is encountered", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
        "Show # some other non-tier block",
        '    BaseType == "Not A Div Card"',
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].cardNames).toEqual(["The Doctor"]);
    });

    it("should handle consecutive tier blocks without empty lines", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "Show # $type->divination $tier->t2",
        '    BaseType == "The Nurse"',
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(2);
      expect(result[0].tierName).toBe("t1");
      expect(result[0].cardNames).toEqual(["The Doctor"]);
      expect(result[1].tierName).toBe("t2");
      expect(result[1].cardNames).toEqual(["The Nurse"]);
    });

    it("should stop BaseType continuation when a non-quoted line appears", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        '        "House of Mirrors"',
        "    SetFontSize 45", // This should stop continuation
        '        "Should Not Be Captured"', // This should NOT be captured
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].cardNames).toEqual(["The Doctor", "House of Mirrors"]);
      expect(result[0].cardNames).not.toContain("Should Not Be Captured");
    });

    it("should handle tier names case-insensitively", () => {
      const lines = [
        "Show # $type->divination $tier->T1",
        '    BaseType == "Case Card"',
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].tierName).toBe("t1");
      expect(result[0].rarity).toBe(1);
    });

    it("should map all known tier names correctly", () => {
      const tierCases: Array<{ tier: string; expectedRarity: number | null }> =
        [
          { tier: "excustomstack", expectedRarity: null },
          { tier: "exstack", expectedRarity: null },
          { tier: "t1", expectedRarity: 1 },
          { tier: "t2", expectedRarity: 2 },
          { tier: "t3", expectedRarity: 2 },
          { tier: "tnew", expectedRarity: 2 },
          { tier: "t4c", expectedRarity: 3 },
          { tier: "t5c", expectedRarity: 4 },
          { tier: "t4", expectedRarity: 4 },
          { tier: "t5", expectedRarity: 4 },
          { tier: "restex", expectedRarity: 4 },
        ];

      for (const { tier, expectedRarity } of tierCases) {
        const lines = [
          `Show # $type->divination $tier->${tier}`,
          `    BaseType == "Test Card ${tier}"`,
          "",
        ];
        const result = RarityModelParser.parseTierBlocks(lines);

        expect(result).toHaveLength(1);
        expect(result[0].rarity).toBe(expectedRarity);
      }
    });

    it("should handle comment lines inside tier blocks", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        "    # This is a comment inside the block",
        '    BaseType == "The Doctor"',
        "    # Another comment",
        "    SetFontSize 45",
        "",
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].cardNames).toEqual(["The Doctor"]);
    });

    it("should include the last block even without trailing newline", () => {
      const lines = [
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
      ];
      const result = RarityModelParser.parseTierBlocks(lines);

      expect(result).toHaveLength(1);
      expect(result[0].cardNames).toEqual(["The Doctor"]);
    });
  });

  // ============================================================================
  // extractCardNames
  // ============================================================================

  describe("extractCardNames", () => {
    it("should extract a single card name", () => {
      const result = RarityModelParser.extractCardNames(
        'BaseType == "The Doctor"',
      );
      expect(result).toEqual(["The Doctor"]);
    });

    it("should extract multiple card names", () => {
      const result = RarityModelParser.extractCardNames(
        'BaseType == "The Doctor" "The Nurse" "House of Mirrors"',
      );
      expect(result).toEqual(["The Doctor", "The Nurse", "House of Mirrors"]);
    });

    it("should handle continuation lines (just quoted strings)", () => {
      const result = RarityModelParser.extractCardNames(
        '    "House of Mirrors" "The Fiend"',
      );
      expect(result).toEqual(["House of Mirrors", "The Fiend"]);
    });

    it("should return empty array for line with no quotes", () => {
      const result = RarityModelParser.extractCardNames("SetFontSize 45");
      expect(result).toEqual([]);
    });

    it("should return empty array for empty string", () => {
      const result = RarityModelParser.extractCardNames("");
      expect(result).toEqual([]);
    });

    it("should handle card names with special characters", () => {
      const result = RarityModelParser.extractCardNames(
        'BaseType == "The King\'s Blade" "A Mother\'s Parting Gift"',
      );
      expect(result).toEqual(["The King's Blade", "A Mother's Parting Gift"]);
    });

    it("should handle card names with numbers", () => {
      const result = RarityModelParser.extractCardNames(
        'BaseType == "1000 Ribbons"',
      );
      expect(result).toEqual(["1000 Ribbons"]);
    });

    it("should not produce results for empty quoted strings", () => {
      // Empty quoted strings ("") never appear in real filter files.
      // The regex /"([^"]+)"/g requires at least one character between quotes,
      // so "" is simply not matched. Adjacent empty quotes can consume
      // surrounding quote characters, so this is a degenerate input.
      const result = RarityModelParser.extractCardNames(
        'BaseType == "The Doctor"',
      );
      expect(result).toEqual(["The Doctor"]);

      // Verify that isolated empty quotes don't produce matches
      const emptyResult = RarityModelParser.extractCardNames('""');
      expect(emptyResult).toEqual([]);
    });

    it("should handle card names with leading/trailing whitespace inside quotes", () => {
      const result = RarityModelParser.extractCardNames(
        'BaseType == " The Doctor "',
      );
      expect(result).toEqual(["The Doctor"]);
    });

    it("should handle BaseType without == operator", () => {
      const result = RarityModelParser.extractCardNames(
        'BaseType "The Doctor" "The Nurse"',
      );
      expect(result).toEqual(["The Doctor", "The Nurse"]);
    });

    it("should handle many card names on one line", () => {
      const cards = Array.from({ length: 20 }, (_, i) => `Card ${i + 1}`);
      const quotedCards = cards.map((c) => `"${c}"`).join(" ");
      const line = `BaseType == ${quotedCards}`;

      const result = RarityModelParser.extractCardNames(line);
      expect(result).toHaveLength(20);
      expect(result[0]).toBe("Card 1");
      expect(result[19]).toBe("Card 20");
    });

    it("should be called multiple times without regex state leaking", () => {
      // This tests that the global regex state is properly reset between calls
      const result1 = RarityModelParser.extractCardNames(
        'BaseType == "Card A"',
      );
      const result2 = RarityModelParser.extractCardNames(
        'BaseType == "Card B"',
      );
      const result3 = RarityModelParser.extractCardNames(
        'BaseType == "Card C"',
      );

      expect(result1).toEqual(["Card A"]);
      expect(result2).toEqual(["Card B"]);
      expect(result3).toEqual(["Card C"]);
    });
  });

  // ============================================================================
  // mapTierToRarity
  // ============================================================================

  describe("mapTierToRarity", () => {
    it("should map t1 to rarity 1 (Extremely Rare)", () => {
      expect(RarityModelParser.mapTierToRarity("t1")).toBe(1);
    });

    it("should map t2 to rarity 2 (Rare)", () => {
      expect(RarityModelParser.mapTierToRarity("t2")).toBe(2);
    });

    it("should map t3 to rarity 2 (Rare)", () => {
      expect(RarityModelParser.mapTierToRarity("t3")).toBe(2);
    });

    it("should map tnew to rarity 2 (Rare)", () => {
      expect(RarityModelParser.mapTierToRarity("tnew")).toBe(2);
    });

    it("should map t4c to rarity 3 (Less Common)", () => {
      expect(RarityModelParser.mapTierToRarity("t4c")).toBe(3);
    });

    it("should map t5c to rarity 4 (Common)", () => {
      expect(RarityModelParser.mapTierToRarity("t5c")).toBe(4);
    });

    it("should map t4 to rarity 4 (Common)", () => {
      expect(RarityModelParser.mapTierToRarity("t4")).toBe(4);
    });

    it("should map t5 to rarity 4 (Common)", () => {
      expect(RarityModelParser.mapTierToRarity("t5")).toBe(4);
    });

    it("should map restex to rarity 4 (Common)", () => {
      expect(RarityModelParser.mapTierToRarity("restex")).toBe(4);
    });

    it("should return null for exstack (ignored)", () => {
      expect(RarityModelParser.mapTierToRarity("exstack")).toBeNull();
    });

    it("should return null for excustomstack (ignored)", () => {
      expect(RarityModelParser.mapTierToRarity("excustomstack")).toBeNull();
    });

    it("should return null for unknown tier names", () => {
      expect(RarityModelParser.mapTierToRarity("t99")).toBeNull();
      expect(RarityModelParser.mapTierToRarity("unknown")).toBeNull();
      expect(RarityModelParser.mapTierToRarity("")).toBeNull();
    });

    it("should be case-insensitive", () => {
      expect(RarityModelParser.mapTierToRarity("T1")).toBe(1);
      expect(RarityModelParser.mapTierToRarity("TNEW")).toBe(2);
      expect(RarityModelParser.mapTierToRarity("Restex")).toBe(4);
      expect(RarityModelParser.mapTierToRarity("EXSTACK")).toBeNull();
    });
  });

  // ============================================================================
  // buildRarityMap
  // ============================================================================

  describe("buildRarityMap", () => {
    it("should build a map from tier blocks", () => {
      const blocks: TierBlock[] = [
        { tierName: "t1", rarity: 1, cardNames: ["The Doctor"] },
        { tierName: "t3", rarity: 2, cardNames: ["The Wretched"] },
        { tierName: "t5", rarity: 4, cardNames: ["The Hermit"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);

      expect(result.size).toBe(3);
      expect(result.get("The Doctor")).toBe(1);
      expect(result.get("The Wretched")).toBe(2);
      expect(result.get("The Hermit")).toBe(4);
    });

    it("should skip blocks with null rarity (ignored tiers)", () => {
      const blocks: TierBlock[] = [
        { tierName: "exstack", rarity: null, cardNames: ["Stack Card"] },
        { tierName: "t1", rarity: 1, cardNames: ["The Doctor"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);

      expect(result.size).toBe(1);
      expect(result.has("Stack Card")).toBe(false);
      expect(result.get("The Doctor")).toBe(1);
    });

    it("should use the most rare (lowest number) when a card appears in multiple tiers", () => {
      const blocks: TierBlock[] = [
        { tierName: "t5", rarity: 4, cardNames: ["Duplicate Card"] },
        { tierName: "t1", rarity: 1, cardNames: ["Duplicate Card"] },
        { tierName: "t3", rarity: 2, cardNames: ["Duplicate Card"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);

      expect(result.size).toBe(1);
      expect(result.get("Duplicate Card")).toBe(1); // Most rare wins
    });

    it("should not upgrade rarity when a less rare block comes after a more rare block", () => {
      const blocks: TierBlock[] = [
        { tierName: "t1", rarity: 1, cardNames: ["The Doctor"] },
        { tierName: "t5", rarity: 4, cardNames: ["The Doctor"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);

      expect(result.get("The Doctor")).toBe(1); // Should stay at 1
    });

    it("should return empty map for empty input", () => {
      const result = RarityModelParser.buildRarityMap([]);
      expect(result.size).toBe(0);
    });

    it("should return empty map when all blocks have null rarity", () => {
      const blocks: TierBlock[] = [
        { tierName: "exstack", rarity: null, cardNames: ["Card A"] },
        { tierName: "excustomstack", rarity: null, cardNames: ["Card B"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);
      expect(result.size).toBe(0);
    });

    it("should handle blocks with no card names", () => {
      const blocks: TierBlock[] = [
        { tierName: "t1", rarity: 1, cardNames: [] },
        { tierName: "t3", rarity: 2, cardNames: ["The Wretched"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);

      expect(result.size).toBe(1);
      expect(result.get("The Wretched")).toBe(2);
    });

    it("should handle multiple cards across multiple blocks", () => {
      const blocks: TierBlock[] = [
        { tierName: "t1", rarity: 1, cardNames: ["Card A", "Card B"] },
        { tierName: "t3", rarity: 2, cardNames: ["Card C", "Card D"] },
        { tierName: "t5", rarity: 4, cardNames: ["Card E"] },
      ];

      const result = RarityModelParser.buildRarityMap(blocks);

      expect(result.size).toBe(5);
      expect(result.get("Card A")).toBe(1);
      expect(result.get("Card B")).toBe(1);
      expect(result.get("Card C")).toBe(2);
      expect(result.get("Card D")).toBe(2);
      expect(result.get("Card E")).toBe(4);
    });
  });

  // ============================================================================
  // getTierMapping
  // ============================================================================

  describe("getTierMapping", () => {
    it("should return a copy of the tier mapping", () => {
      const mapping = RarityModelParser.getTierMapping();

      expect(mapping.t1).toBe(1);
      expect(mapping.t2).toBe(2);
      expect(mapping.t3).toBe(2);
      expect(mapping.tnew).toBe(2);
      expect(mapping.t4c).toBe(3);
      expect(mapping.t5c).toBe(4);
      expect(mapping.t4).toBe(4);
      expect(mapping.t5).toBe(4);
      expect(mapping.restex).toBe(4);
      expect(mapping.exstack).toBeNull();
      expect(mapping.excustomstack).toBeNull();
    });

    it("should return a new object each time (not the same reference)", () => {
      const mapping1 = RarityModelParser.getTierMapping();
      const mapping2 = RarityModelParser.getTierMapping();

      expect(mapping1).not.toBe(mapping2);
      expect(mapping1).toEqual(mapping2);
    });

    it("should not allow modification of internal mapping", () => {
      const mapping = RarityModelParser.getTierMapping();
      mapping.t1 = 999 as any;

      // Original should be unchanged
      const fresh = RarityModelParser.getTierMapping();
      expect(fresh.t1).toBe(1);
    });
  });

  // ============================================================================
  // parseFilterFile (file I/O)
  // ============================================================================

  describe("parseFilterFile", () => {
    const tmpFiles: string[] = [];

    afterAll(async () => {
      for (const f of tmpFiles) {
        await fs.unlink(f).catch(() => {});
      }
    });

    it("should return empty result when file does not exist", async () => {
      const result = await RarityModelParser.parseFilterFile(
        "/nonexistent/path/filter.filter",
      );

      expect(result.hasDivinationSection).toBe(false);
      expect(result.totalCards).toBe(0);
      expect(result.cardRarities.size).toBe(0);
    });

    it("should read and parse a valid filter file from disk", async () => {
      const content = makeValidFilterContent();
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rarity-parser-"));
      const tmpFile = path.join(tmpDir, "test.filter");
      await fs.writeFile(tmpFile, content, "utf-8");
      tmpFiles.push(tmpFile);

      const result = await RarityModelParser.parseFilterFile(tmpFile);

      expect(result.hasDivinationSection).toBe(true);
      expect(result.totalCards).toBeGreaterThan(0);
      expect(result.cardRarities.size).toBeGreaterThan(0);
      expect(result.cardRarities.get("The Doctor")).toBe(1);

      // Clean up the temp directory too
      await fs.rm(tmpDir, { recursive: true }).catch(() => {});
    });
  });

  // ============================================================================
  // Real-world-like filter content scenarios
  // ============================================================================

  describe("real-world scenarios", () => {
    it("should handle a NeverSink-style filter structure", () => {
      const content = [
        "# ==========================================",
        "# NeverSink's LOOT FILTER - SOFTCORE",
        "# ==========================================",
        "# Version: 8.12.5",
        "#",
        "# WELCOME] TABLE OF CONTENTS",
        "#",
        "# [[0100]] Emergency Top-Highlights",
        "# [[0200]] Currency",
        "# [[0300]] Maps",
        "# [[4200]] Divination Cards",
        "# [[4300]] Unique Items",
        "#",
        "",
        "# ==========================================",
        "# [[0100]] Emergency Top-Highlights",
        "# ==========================================",
        "",
        "Show # $type->currency $tier->exmirror",
        '    BaseType == "Mirror of Kalandra"',
        "    SetFontSize 45",
        "",
        "# ==========================================",
        "# [[4200]] Divination Cards",
        "# ==========================================",
        "",
        "Show # $type->divination $tier->excustomstack",
        '    BaseType == "The Doctor" "House of Mirrors"',
        "    HasExplicitMod == 2",
        "    SetFontSize 45",
        "",
        "Show # $type->divination $tier->exstack",
        '    BaseType == "The Doctor" "House of Mirrors"',
        "    StackSize >= 2",
        "    SetFontSize 45",
        "",
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor" "House of Mirrors" "The Apothecary"',
        "    SetFontSize 45",
        "    SetTextColor 255 0 0 255",
        "    SetBorderColor 255 0 0 255",
        "    SetBackgroundColor 255 255 255 255",
        "    PlayAlertSound 6 300",
        "    PlayEffect Red",
        "    MinimapIcon 0 Red Star",
        "",
        "Show # $type->divination $tier->t2",
        '    BaseType == "The Nurse" "The Fiend" "Unrequited Love"',
        "    SetFontSize 45",
        "    SetTextColor 255 0 0 255",
        "",
        "Show # $type->divination $tier->t3",
        '    BaseType == "The Cartographer" "The Wretched" "The Valkyrie"',
        "    SetFontSize 42",
        "",
        "Show # $type->divination $tier->tnew",
        '    BaseType == "New Unknown Card"',
        "    SetFontSize 40",
        "",
        "Show # $type->divination $tier->t4c",
        '    BaseType == "Rain of Chaos" "Emperor of Purity"',
        "    SetFontSize 36",
        "",
        "Show # $type->divination $tier->t5c",
        '    BaseType == "The Scholar" "The Gambler"',
        "    SetFontSize 32",
        "",
        "Show # $type->divination $tier->t4",
        '    BaseType == "Loyalty" "Prosperity"',
        "    SetFontSize 28",
        "",
        "Show # $type->divination $tier->t5",
        '    BaseType == "The Carrion Crow" "The Hermit" "Thunderous Skies"',
        "    SetFontSize 24",
        "",
        "Show # $type->divination $tier->restex",
        '    BaseType == "Remaining Card 1" "Remaining Card 2"',
        "    SetFontSize 18",
        "",
        "# ==========================================",
        "# [[4300]] Unique Items",
        "# ==========================================",
        "",
        "Show # $type->uniques $tier->t1",
        '    BaseType == "Headhunter"',
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(true);

      // excustomstack and exstack cards should be EXCLUDED from the rarity map
      // The same cards appear in t1 which SHOULD be included

      // T1 → 1
      expect(result.cardRarities.get("The Doctor")).toBe(1);
      expect(result.cardRarities.get("House of Mirrors")).toBe(1);
      expect(result.cardRarities.get("The Apothecary")).toBe(1);

      // T2 → 2
      expect(result.cardRarities.get("The Nurse")).toBe(2);
      expect(result.cardRarities.get("The Fiend")).toBe(2);
      expect(result.cardRarities.get("Unrequited Love")).toBe(2);

      // T3 → 2
      expect(result.cardRarities.get("The Cartographer")).toBe(2);
      expect(result.cardRarities.get("The Wretched")).toBe(2);
      expect(result.cardRarities.get("The Valkyrie")).toBe(2);

      // Tnew → 2
      expect(result.cardRarities.get("New Unknown Card")).toBe(2);

      // T4c → 3
      expect(result.cardRarities.get("Rain of Chaos")).toBe(3);
      expect(result.cardRarities.get("Emperor of Purity")).toBe(3);

      // T5c → 4
      expect(result.cardRarities.get("The Scholar")).toBe(4);
      expect(result.cardRarities.get("The Gambler")).toBe(4);

      // T4 → 4
      expect(result.cardRarities.get("Loyalty")).toBe(4);
      expect(result.cardRarities.get("Prosperity")).toBe(4);

      // T5 → 4
      expect(result.cardRarities.get("The Carrion Crow")).toBe(4);
      expect(result.cardRarities.get("The Hermit")).toBe(4);
      expect(result.cardRarities.get("Thunderous Skies")).toBe(4);

      // Restex → 4
      expect(result.cardRarities.get("Remaining Card 1")).toBe(4);
      expect(result.cardRarities.get("Remaining Card 2")).toBe(4);

      // Cards from the Unique Items section should NOT be included
      expect(result.cardRarities.has("Headhunter")).toBe(false);

      // Total unique cards (excl. exstack/excustomstack duplicates that also appear in t1)
      // The Doctor and House of Mirrors appear in excustomstack, exstack, and t1
      // Since excustomstack/exstack are ignored, they're only counted from t1
      expect(result.totalCards).toBe(21);
    });

    it("should handle cards in exstack that do NOT appear in a regular tier", () => {
      const content = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
        "",
        "# [[4200]] Divination Cards",
        "",
        "Show # $type->divination $tier->exstack",
        '    BaseType == "Stack Only Card"',
        "",
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      // Stack Only Card appears only in exstack (ignored), so it should NOT be in the map
      expect(result.cardRarities.has("Stack Only Card")).toBe(false);
      expect(result.cardRarities.get("The Doctor")).toBe(1);
      expect(result.totalCards).toBe(1);
    });

    it("should handle filter with only ignored tiers in divination section", () => {
      const content = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
        "",
        "# [[4200]] Divination Cards",
        "",
        "Show # $type->divination $tier->exstack",
        '    BaseType == "Card A"',
        "",
        "Show # $type->divination $tier->excustomstack",
        '    BaseType == "Card B"',
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      expect(result.hasDivinationSection).toBe(true);
      expect(result.totalCards).toBe(0);
      expect(result.cardRarities.size).toBe(0);
    });

    it("should handle a filter with multi-line BaseType across many lines", () => {
      const content = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
        "",
        "# [[4200]] Divination Cards",
        "",
        "Show # $type->divination $tier->t5",
        '    BaseType == "Card 1"',
        '        "Card 2"',
        '        "Card 3"',
        '        "Card 4"',
        '        "Card 5"',
        '        "Card 6"',
        '        "Card 7"',
        '        "Card 8"',
        '        "Card 9"',
        '        "Card 10"',
        "    SetFontSize 18",
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      expect(result.totalCards).toBe(10);
      for (let i = 1; i <= 10; i++) {
        expect(result.cardRarities.get(`Card ${i}`)).toBe(4);
      }
    });

    it("should handle a filter with Hide blocks in divination section", () => {
      const content = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
        "",
        "# [[4200]] Divination Cards",
        "",
        "Show # $type->divination $tier->t1",
        '    BaseType == "The Doctor"',
        "",
        "Hide # $type->divination $tier->t5",
        '    BaseType == "Hidden Card"',
        "",
        "Show # $type->divination $tier->t3",
        '    BaseType == "Another Card"',
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      // The Hide block ends the t1 block but is not itself a tier block
      // The t3 block should still be parsed
      expect(result.cardRarities.get("The Doctor")).toBe(1);
      expect(result.cardRarities.get("Another Card")).toBe(2);
    });

    it("should resolve rarity conflict in favor of more rare when same card in t1 and t5", () => {
      const content = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
        "",
        "# [[4200]] Divination Cards",
        "",
        "Show # $type->divination $tier->t5",
        '    BaseType == "Conflict Card"',
        "",
        "Show # $type->divination $tier->t1",
        '    BaseType == "Conflict Card"',
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      // Even though t5 (rarity 4) appears first, t1 (rarity 1) should win
      expect(result.cardRarities.get("Conflict Card")).toBe(1);
      expect(result.totalCards).toBe(1);
    });

    it("should handle multiple BaseType lines in the same tier block", () => {
      // Some filter generators might produce multiple BaseType lines per block
      const content = [
        "# WELCOME] TABLE OF CONTENTS",
        "# [[4200]] Divination Cards",
        "",
        "# [[4200]] Divination Cards",
        "",
        "Show # $type->divination $tier->t1",
        '    BaseType == "Card A" "Card B"',
        '    BaseType == "Card C"',
        "",
      ].join("\n");

      const result = RarityModelParser.parseFilterContent(content);

      // Both BaseType lines should be captured since they're in the same block
      // before any other keyword stops BaseType collection.
      // Actually, the second BaseType restarts collection since it matches BASETYPE_LINE_REGEX.
      expect(result.cardRarities.has("Card A")).toBe(true);
      expect(result.cardRarities.has("Card B")).toBe(true);
      expect(result.cardRarities.has("Card C")).toBe(true);
    });
  });
});
