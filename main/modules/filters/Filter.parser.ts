import fs from "node:fs/promises";

import type { KnownRarity } from "~/types/data-stores";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of parsing a filter file's divination card section.
 */
export interface FilterParseResult {
  /** Map of card name → rarity (1-4) */
  cardRarities: Map<string, KnownRarity>;
  /** Whether a divination card section was found in the filter */
  hasDivinationSection: boolean;
  /** Total number of unique cards found */
  totalCards: number;
}

/**
 * A parsed tier block from the filter's divination card section.
 */
export interface TierBlock {
  /** The raw tier name from the filter (e.g., "t1", "t2", "exstack") */
  tierName: string;
  /** The mapped app rarity (1-4), or null if the tier should be ignored */
  rarity: KnownRarity | null;
  /** Card names found in this tier block's BaseType line(s) */
  cardNames: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Mapping of filter tier names to app rarity values.
 *
 * | Filter Tier           | App Rarity | Rarity Name      |
 * |-----------------------|-----------|------------------|
 * | excustomstack         | (ignore)  | Multiple stacks  |
 * | exstack               | (ignore)  | Multiple stacks  |
 * | t1                    | 1         | Extremely Rare   |
 * | t2                    | 2         | Rare             |
 * | t3                    | 2         | Rare             |
 * | tnew                  | 2         | Rare             |
 * | t4c                   | 3         | Less Common      |
 * | t5c                   | 4         | Common           |
 * | t4                    | 4         | Common           |
 * | t5                    | 4         | Common           |
 * | restex                | 4         | Common           |
 */
const TIER_TO_RARITY: Record<string, KnownRarity | null> = {
  excustomstack: null, // ignore — multiple stacks only
  exstack: null, // ignore — multiple stacks only
  t1: 1, // Extremely Rare
  t2: 2, // Rare
  t3: 2, // Rare
  tnew: 2, // Rare (new/unknown cards)
  t4c: 3, // Less Common
  t5c: 4, // Common
  t4: 4, // Common
  t5: 4, // Common
  restex: 4, // Common (remainder)
};

/**
 * Regex to match the TOC entry for the Divination Cards section.
 * Captures the section ID inside double brackets.
 *
 * Example: `# [[4200]] Divination Cards`
 */
const TOC_DIVINATION_REGEX = /^#\s*\[\[(\d+)\]\]\s*Divination\s+Cards\s*$/i;

/**
 * Creates a regex to match the section header for a given section ID.
 *
 * Example: `# [[4200]] Divination Cards`
 */
function makeSectionHeaderRegex(sectionId: string): RegExp {
  return new RegExp(
    `^#\\s*\\[\\[${escapeRegex(sectionId)}\\]\\]\\s*Divination\\s+Cards\\s*$`,
    "i",
  );
}

/**
 * Regex to match tier block headers within the divination card section.
 * Captures the tier name from `$tier->{name}`.
 *
 * Example: `Show # $type->divination $tier->t1`
 */
const TIER_BLOCK_HEADER_REGEX =
  /^Show\s+#\s+\$type->divination\s+\$tier->(\S+)\s*$/i;

/**
 * Regex to match the start of a BaseType line.
 * The `==` operator is optional in some filter formats.
 *
 * Examples:
 * - `BaseType == "Card Name 1" "Card Name 2"`
 * - `BaseType "Card Name 1" "Card Name 2"`
 */
const BASETYPE_LINE_REGEX = /^\s*BaseType\s*(?:==)?\s*/i;

/**
 * Regex to extract quoted strings from a BaseType line.
 * Matches both double-quoted and single-quoted card names.
 */
const QUOTED_STRING_REGEX = /"([^"]+)"/g;

/**
 * Regex to detect the start of a new section header (any section, not just divination).
 * Used to know when the divination card section ends.
 *
 * Example: `# [[4300]] Unique Maps`
 */
const SECTION_HEADER_REGEX = /^#\s*\[\[\d+\]\]/;

/**
 * Regex to detect a new Show/Hide block (marks the end of the current block).
 */
const SHOW_HIDE_BLOCK_REGEX = /^(Show|Hide)\s/i;

/**
 * Marker for the start of the Table of Contents area.
 */
const TOC_START_MARKER = "TABLE OF CONTENTS";

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * FilterParser handles the full content parsing of Path of Exile loot filter files.
 *
 * It extracts divination card tier information using a multi-step process:
 * 1. **TOC Navigation:** Find the Table of Contents and locate the Divination Cards section ID
 * 2. **Section Navigation:** Jump to the Divination Cards section using the section ID
 * 3. **Tier Block Parsing:** Parse each tier block (Show # $type->divination $tier->...)
 * 4. **Card Name Extraction:** Extract card names from BaseType lines
 * 5. **Rarity Mapping:** Map filter tiers to app rarities (1-4)
 *
 * The parser is designed to be stateless — all methods are static for easy testing.
 * File I/O is isolated to a single method (`parseFilterFile`) so the core logic
 * can be tested with raw string content.
 */
export class FilterParser {
  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Parse a filter file from disk and extract divination card rarities.
   *
   * This reads the entire file content and delegates to `parseFilterContent`.
   *
   * @param filePath - Absolute path to the filter file
   * @returns Parse result with card rarities, or empty result if parsing fails
   */
  static async parseFilterFile(filePath: string): Promise<FilterParseResult> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return FilterParser.parseFilterContent(content);
    } catch (error) {
      console.error(
        `[FilterParser] Failed to read filter file: ${filePath}`,
        error,
      );
      return {
        cardRarities: new Map(),
        hasDivinationSection: false,
        totalCards: 0,
      };
    }
  }

  /**
   * Parse filter content string and extract divination card rarities.
   *
   * This is the main entry point for parsing. It coordinates the multi-step
   * process of TOC navigation, section finding, tier block parsing, and
   * rarity mapping.
   *
   * @param content - Raw filter file content as a string
   * @returns Parse result with card rarities
   */
  static parseFilterContent(content: string): FilterParseResult {
    const lines = content.split(/\r?\n/);

    // Step 1: Find divination cards section ID from TOC
    const sectionId = FilterParser.findDivinationSectionId(lines);

    if (sectionId === null) {
      console.log(
        "[FilterParser] No Divination Cards section found in TOC — falling back",
      );
      return {
        cardRarities: new Map(),
        hasDivinationSection: false,
        totalCards: 0,
      };
    }

    // Step 2: Navigate to divination cards section
    const sectionStartIndex = FilterParser.findSectionStart(lines, sectionId);

    if (sectionStartIndex === -1) {
      console.log(
        `[FilterParser] Divination Cards section header [[${sectionId}]] not found in body`,
      );
      return {
        cardRarities: new Map(),
        hasDivinationSection: false,
        totalCards: 0,
      };
    }

    // Step 3: Extract the divination cards section lines
    const sectionLines = FilterParser.extractSectionLines(
      lines,
      sectionStartIndex,
    );

    // Step 4: Parse tier blocks from the section
    const tierBlocks = FilterParser.parseTierBlocks(sectionLines);

    // Step 5: Build rarity map from tier blocks
    const cardRarities = FilterParser.buildRarityMap(tierBlocks);

    return {
      cardRarities,
      hasDivinationSection: true,
      totalCards: cardRarities.size,
    };
  }

  // ─── TOC Navigation ───────────────────────────────────────────────────

  /**
   * Find the Divination Cards section ID from the Table of Contents.
   *
   * Scans lines for the TOC area, then looks for a line matching:
   * `# [[NNNN]] Divination Cards`
   *
   * @param lines - All lines of the filter file
   * @returns The section ID string (e.g., "4200"), or null if not found
   */
  static findDivinationSectionId(lines: string[]): string | null {
    let inToc = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect start of TOC area
      if (!inToc) {
        if (trimmed.toUpperCase().includes(TOC_START_MARKER)) {
          inToc = true;
        }
        continue;
      }

      // We're inside the TOC — look for Divination Cards entry
      const match = trimmed.match(TOC_DIVINATION_REGEX);
      if (match) {
        return match[1];
      }

      // If we encounter a non-comment, non-empty line after TOC started,
      // we've probably left the TOC area. But TOC lines are all comments (#),
      // so keep scanning until we hit actual filter content.
      // A "Show" or "Hide" line definitively means we've left the TOC.
      if (SHOW_HIDE_BLOCK_REGEX.test(trimmed)) {
        break;
      }
    }

    return null;
  }

  // ─── Section Navigation ────────────────────────────────────────────────

  /**
   * Find the line index where the Divination Cards section starts in the filter body.
   *
   * Looks for the section header: `# [[{sectionId}]] Divination Cards`
   * This header appears both in the TOC and in the actual section body.
   * We need the one in the body (i.e., the second occurrence, or the one
   * followed by tier blocks).
   *
   * Strategy: Find ALL occurrences and return the last one, since the TOC
   * entry comes first and the actual section comes later.
   *
   * @param lines - All lines of the filter file
   * @param sectionId - The section ID to find (e.g., "4200")
   * @returns Line index of the section header, or -1 if not found
   */
  static findSectionStart(lines: string[], sectionId: string): number {
    const regex = makeSectionHeaderRegex(sectionId);
    let lastMatchIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i].trim())) {
        lastMatchIndex = i;
      }
    }

    return lastMatchIndex;
  }

  // ─── Section Extraction ────────────────────────────────────────────────

  /**
   * Extract all lines belonging to the Divination Cards section.
   *
   * The section starts at the given index and ends when:
   * - Another section header is encountered (`# [[NNNN]] ...`)
   * - The end of file is reached
   *
   * @param lines - All lines of the filter file
   * @param sectionStartIndex - The line index of the section header
   * @returns Array of lines within the section (excluding the header itself)
   */
  static extractSectionLines(
    lines: string[],
    sectionStartIndex: number,
  ): string[] {
    const sectionLines: string[] = [];

    // Start from the line after the section header
    for (let i = sectionStartIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Check if we've hit the next section
      if (SECTION_HEADER_REGEX.test(trimmed)) {
        break;
      }

      sectionLines.push(lines[i]);
    }

    return sectionLines;
  }

  // ─── Tier Block Parsing ────────────────────────────────────────────────

  /**
   * Parse tier blocks from the divination cards section lines.
   *
   * Each tier block starts with:
   * `Show # $type->divination $tier->{tierName}`
   *
   * And contains a `BaseType` line with quoted card names.
   *
   * @param sectionLines - Lines within the divination cards section
   * @returns Array of parsed tier blocks
   */
  static parseTierBlocks(sectionLines: string[]): TierBlock[] {
    const blocks: TierBlock[] = [];
    let currentBlock: TierBlock | null = null;
    let collectingBaseType = false;

    for (const line of sectionLines) {
      const trimmed = line.trim();

      // Check for a new tier block header
      const tierMatch = trimmed.match(TIER_BLOCK_HEADER_REGEX);
      if (tierMatch) {
        // Save previous block if it exists
        if (currentBlock) {
          blocks.push(currentBlock);
        }

        const tierName = tierMatch[1].toLowerCase();
        currentBlock = {
          tierName,
          rarity: FilterParser.mapTierToRarity(tierName),
          cardNames: [],
        };
        collectingBaseType = false;
        continue;
      }

      // Check if a new Show/Hide block starts that isn't a tier block
      // (this ends the current tier block)
      if (SHOW_HIDE_BLOCK_REGEX.test(trimmed) && currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
        collectingBaseType = false;
        continue;
      }

      // Skip if we're not inside a tier block
      if (!currentBlock) {
        continue;
      }

      // Check for BaseType line
      if (BASETYPE_LINE_REGEX.test(trimmed)) {
        collectingBaseType = true;
        const names = FilterParser.extractCardNames(trimmed);
        currentBlock.cardNames.push(...names);
        continue;
      }

      // Handle multi-line BaseType continuations.
      // A continuation line contains only quoted strings (possibly with whitespace).
      // It must NOT start with a known keyword.
      if (collectingBaseType && trimmed.startsWith('"')) {
        const names = FilterParser.extractCardNames(trimmed);
        currentBlock.cardNames.push(...names);
        continue;
      }

      // Any other non-empty, non-comment line ends BaseType collection
      if (collectingBaseType && trimmed !== "" && !trimmed.startsWith("#")) {
        collectingBaseType = false;
      }
    }

    // Don't forget the last block
    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  // ─── Card Name Extraction ──────────────────────────────────────────────

  /**
   * Extract card names from a BaseType line or continuation line.
   *
   * Matches all double-quoted strings in the line.
   *
   * Examples:
   * - `BaseType == "The Doctor" "The Nurse"` → ["The Doctor", "The Nurse"]
   * - `"House of Mirrors" "Mirror of Kalandra"` → ["House of Mirrors", "Mirror of Kalandra"]
   *
   * @param line - A single line (trimmed or untrimmed)
   * @returns Array of extracted card names
   */
  static extractCardNames(line: string): string[] {
    const names: string[] = [];

    // Reset regex lastIndex since we're using /g flag
    QUOTED_STRING_REGEX.lastIndex = 0;

    for (
      let match = QUOTED_STRING_REGEX.exec(line);
      match !== null;
      match = QUOTED_STRING_REGEX.exec(line)
    ) {
      const name = match[1].trim();
      if (name.length > 0) {
        names.push(name);
      }
    }

    return names;
  }

  // ─── Tier-to-Rarity Mapping ────────────────────────────────────────────

  /**
   * Map a filter tier name to an app rarity value.
   *
   * @param tierName - Lowercase tier name (e.g., "t1", "t2", "exstack")
   * @returns Rarity value (1-4), or null if the tier should be ignored
   */
  static mapTierToRarity(tierName: string): KnownRarity | null {
    const normalized = tierName.toLowerCase();
    return TIER_TO_RARITY[normalized] ?? null;
  }

  /**
   * Get a copy of the full tier-to-rarity mapping.
   * Useful for testing and debugging.
   */
  static getTierMapping(): Record<string, KnownRarity | null> {
    return { ...TIER_TO_RARITY };
  }

  // ─── Rarity Map Building ──────────────────────────────────────────────

  /**
   * Build a card name → rarity map from parsed tier blocks.
   *
   * Conflict resolution: If a card appears in multiple tiers, the most rare
   * occurrence wins (lowest rarity number). This is the conservative approach
   * that highlights valuable cards.
   *
   * Tiers with `rarity: null` (e.g., exstack, excustomstack) are skipped entirely.
   *
   * @param tierBlocks - Array of parsed tier blocks
   * @returns Map of card name to rarity (1-4)
   */
  static buildRarityMap(tierBlocks: TierBlock[]): Map<string, KnownRarity> {
    const rarityMap = new Map<string, KnownRarity>();

    for (const block of tierBlocks) {
      // Skip ignored tiers (stacks, etc.)
      if (block.rarity === null) {
        continue;
      }

      for (const cardName of block.cardNames) {
        const existing = rarityMap.get(cardName);

        // Use the most rare (lowest number) occurrence
        if (existing === undefined || block.rarity < existing) {
          rarityMap.set(cardName, block.rarity);
        }
      }
    }

    return rarityMap;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
