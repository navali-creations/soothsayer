import fs from "node:fs/promises";

import type { KnownRarity } from "~/types/data-stores";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of parsing a filter file's divination card section.
 */
export interface RarityInsightsParseResult {
  /** Map of card name → rarity (1-4) */
  cardRarities: Map<string, KnownRarity>;
  /** Map of app rarity → parsed filter colour styling */
  tierStyles: Map<KnownRarity, FilterTierStyle>;
  /** Whether a divination card section was found in the filter */
  hasDivinationSection: boolean;
  /** Total number of unique cards found */
  totalCards: number;
}

export interface FilterRgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FilterTierStyle {
  bgColor: FilterRgbaColor | null;
  textColor: FilterRgbaColor | null;
  borderColor: FilterRgbaColor | null;
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
  /** Visual style directives found in this tier block */
  style?: FilterTierStyle;
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

const TIER_STYLE_PRIORITY: Record<string, number> = {
  t1: 10,
  t2: 20,
  t3: 30,
  tnew: 40,
  t4c: 50,
  t5c: 60,
  t4: 70,
  t5: 80,
  restex: 90,
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
 * Regex to detect a filter block header.
 */
const BLOCK_HEADER_REGEX = /^(Show|Hide)\b/i;

const TIER_TOKEN_REGEX = /\$tier->([A-Za-z0-9_-]+)\b/i;
const DIVINATION_TYPE_TOKEN_REGEX = /\$type->divination\b/i;

/**
 * Regex to match the start of a BaseType line.
 * The `==` operator is optional in some filter formats.
 *
 * Examples:
 * - `BaseType == "Card Name 1" "Card Name 2"`
 * - `BaseType "Card Name 1" "Card Name 2"`
 */
const BASETYPE_LINE_REGEX = /^\s*BaseType\s*(?:==)?\s*/i;

const COLOR_DIRECTIVE_REGEX =
  /^\s*Set(Background|Text|Border)Color\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?(?:\s+#.*)?\s*$/i;

const CLASS_LINE_REGEX = /^\s*Class\s*(?:==)?\s*(.+)\s*$/i;
const DIVINATION_CLASS_REGEX = /"?Divination Cards?"?/i;
const FONT_SIZE_REGEX = /^\s*SetFontSize\s+(\d+)\b/i;
const ALERT_SOUND_REGEX =
  /^\s*PlayAlertSound(?:Positional)?\s+(\S+)(?:\s+\d+)?/i;
const MINIMAP_DISABLED_REGEX = /^\s*MinimapIcon\s+-1\b/i;
const PLAY_EFFECT_NONE_REGEX = /^\s*PlayEffect\s+None\b/i;

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
const SECTION_HEADER_REGEX = /^(?:#\s*\[\[\d+\]\]|#{2,}\s+\S)/;

const DIVINATION_SECTION_HEADER_REGEX =
  /^#+\s*(?:\[\[\d+\]\]\s*)?Divination\s+Cards\s*$/i;

/**
 * Regex to detect a new Show/Hide block (marks the end of the current block).
 */
const SHOW_HIDE_BLOCK_REGEX = /^(Show|Hide)\s/i;

/**
 * Marker for the start of the Table of Contents area.
 */
const TOC_START_MARKER = "TABLE OF CONTENTS";

interface GenericDivinationBlock {
  action: "Show" | "Hide";
  header: string;
  cardNames: string[];
  style: FilterTierStyle;
  isDivinationBlock: boolean;
  fontSize: number | null;
  alertSound: string | null;
  hasDisabledMinimap: boolean;
  hasNoPlayEffect: boolean;
  order: number;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * RarityInsightsParser handles the full content parsing of Path of Exile loot filter files.
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
export class RarityInsightsParser {
  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Parse a filter file from disk and extract divination card rarities.
   *
   * This reads the entire file content and delegates to `parseFilterContent`.
   *
   * @param filePath - Absolute path to the filter file
   * @returns Parse result with card rarities, or empty result if parsing fails
   */
  static async parseFilterFile(
    filePath: string,
  ): Promise<RarityInsightsParseResult> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return RarityInsightsParser.parseFilterContent(content);
    } catch (error) {
      console.error(
        `[RarityInsightsParser] Failed to read filter file: ${filePath}`,
        error,
      );
      return {
        cardRarities: new Map(),
        tierStyles: new Map(),
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
  static parseFilterContent(content: string): RarityInsightsParseResult {
    const lines = content.split(/\r?\n/);

    // Step 1: Find divination cards section ID from TOC
    const sectionId = RarityInsightsParser.findDivinationSectionId(lines);

    const sectionStartIndex =
      sectionId === null
        ? RarityInsightsParser.findDivinationSectionStart(lines)
        : RarityInsightsParser.findSectionStart(lines, sectionId);

    if (sectionStartIndex === -1) {
      console.log(
        sectionId === null
          ? "[RarityInsightsParser] No Divination Cards section found"
          : `[RarityInsightsParser] Divination Cards section header [[${sectionId}]] not found in body`,
      );
      return {
        cardRarities: new Map(),
        tierStyles: new Map(),
        hasDivinationSection: false,
        totalCards: 0,
      };
    }

    // Step 3: Extract the divination cards section lines
    const sectionLines = RarityInsightsParser.extractSectionLines(
      lines,
      sectionStartIndex,
    );

    // Step 4: Parse tier blocks from the section
    const tierBlocks = RarityInsightsParser.parseTierBlocks(sectionLines);

    // Step 5: Build rarity map from tier blocks
    const cardRarities = RarityInsightsParser.buildRarityMap(tierBlocks);
    const tierStyles = RarityInsightsParser.buildTierStyles(tierBlocks);

    return {
      cardRarities,
      tierStyles,
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

  static findDivinationSectionStart(lines: string[]): number {
    let lastMatchIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (DIVINATION_SECTION_HEADER_REGEX.test(lines[i].trim())) {
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
    const explicitTierBlocks = parseExplicitTierBlocks(sectionLines);
    if (explicitTierBlocks.length > 0) {
      return explicitTierBlocks;
    }

    return parseGenericDivinationBlocks(sectionLines);
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

  static parseColorDirective(line: string): {
    styleKey: keyof FilterTierStyle;
    color: FilterRgbaColor;
  } | null {
    const match = line.match(COLOR_DIRECTIVE_REGEX);
    if (!match) {
      return null;
    }

    const channelValues = [match[2], match[3], match[4], match[5] ?? "255"].map(
      (value) => Number(value),
    );

    if (channelValues.some((value) => !Number.isInteger(value))) {
      return null;
    }

    const [r, g, b, a] = channelValues;
    if (
      !isValidColorChannel(r) ||
      !isValidColorChannel(g) ||
      !isValidColorChannel(b) ||
      !isValidColorChannel(a)
    ) {
      return null;
    }

    const directive = match[1].toLowerCase();
    const styleKey =
      directive === "background"
        ? "bgColor"
        : directive === "text"
          ? "textColor"
          : "borderColor";

    return {
      styleKey,
      color: { r, g, b, a },
    };
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

  /**
   * Build a rarity → tier style map from parsed tier blocks.
   *
   * Conflict resolution follows NeverSink tier priority rather than whichever
   * duplicate rarity block happens to appear last in the file.
   */
  static buildTierStyles(
    tierBlocks: TierBlock[],
  ): Map<KnownRarity, FilterTierStyle> {
    const tierStyleMap = new Map<KnownRarity, FilterTierStyle>();
    const selectedPriority = new Map<KnownRarity, number>();

    for (const block of tierBlocks) {
      const style = block.style ?? createEmptyTierStyle();
      if (block.rarity === null || !hasTierStyle(style)) {
        continue;
      }

      const priority =
        TIER_STYLE_PRIORITY[block.tierName] ?? Number.MAX_SAFE_INTEGER;
      const existingPriority = selectedPriority.get(block.rarity);

      if (existingPriority === undefined || priority < existingPriority) {
        tierStyleMap.set(block.rarity, cloneTierStyle(style));
        selectedPriority.set(block.rarity, priority);
      }
    }

    return tierStyleMap;
  }
}

function parseExplicitTierBlocks(sectionLines: string[]): TierBlock[] {
  const blocks: TierBlock[] = [];
  let currentBlock: TierBlock | null = null;
  let collectingBaseType = false;

  for (const line of sectionLines) {
    const trimmed = line.trim();
    const tierName = parseExplicitDivinationTierName(trimmed);

    if (BLOCK_HEADER_REGEX.test(trimmed)) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      currentBlock =
        tierName === null
          ? null
          : {
              tierName,
              rarity: RarityInsightsParser.mapTierToRarity(tierName),
              cardNames: [],
              style: createEmptyTierStyle(),
            };
      collectingBaseType = false;
      continue;
    }

    if (!currentBlock) {
      continue;
    }

    const colorDirective = RarityInsightsParser.parseColorDirective(trimmed);
    if (colorDirective) {
      currentBlock.style ??= createEmptyTierStyle();
      currentBlock.style[colorDirective.styleKey] = colorDirective.color;
      collectingBaseType = false;
      continue;
    }

    if (BASETYPE_LINE_REGEX.test(trimmed)) {
      collectingBaseType = true;
      const names = RarityInsightsParser.extractCardNames(trimmed);
      currentBlock.cardNames.push(...names);
      continue;
    }

    if (collectingBaseType && trimmed.startsWith('"')) {
      const names = RarityInsightsParser.extractCardNames(trimmed);
      currentBlock.cardNames.push(...names);
      continue;
    }

    if (collectingBaseType && trimmed !== "" && !trimmed.startsWith("#")) {
      collectingBaseType = false;
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function parseGenericDivinationBlocks(sectionLines: string[]): TierBlock[] {
  const rawBlocks: GenericDivinationBlock[] = [];
  let currentBlock: GenericDivinationBlock | null = null;
  let collectingBaseType = false;
  let blockOrder = 0;

  for (const line of sectionLines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(BLOCK_HEADER_REGEX);

    if (headerMatch) {
      if (currentBlock?.isDivinationBlock) {
        rawBlocks.push(currentBlock);
      }

      currentBlock = {
        action: headerMatch[1].toLowerCase() === "hide" ? "Hide" : "Show",
        header: trimmed,
        cardNames: [],
        style: createEmptyTierStyle(),
        isDivinationBlock: hasDivinationHint(trimmed),
        fontSize: null,
        alertSound: null,
        hasDisabledMinimap: false,
        hasNoPlayEffect: false,
        order: blockOrder,
      };
      blockOrder += 1;
      collectingBaseType = false;
      continue;
    }

    if (!currentBlock) {
      continue;
    }

    const classMatch = trimmed.match(CLASS_LINE_REGEX);
    if (classMatch && DIVINATION_CLASS_REGEX.test(classMatch[1])) {
      currentBlock.isDivinationBlock = true;
      collectingBaseType = false;
      continue;
    }

    const colorDirective = RarityInsightsParser.parseColorDirective(trimmed);
    if (colorDirective) {
      currentBlock.style[colorDirective.styleKey] = colorDirective.color;
      collectingBaseType = false;
      continue;
    }

    const fontSizeMatch = trimmed.match(FONT_SIZE_REGEX);
    if (fontSizeMatch) {
      currentBlock.fontSize = Number(fontSizeMatch[1]);
      collectingBaseType = false;
      continue;
    }

    const alertSoundMatch = trimmed.match(ALERT_SOUND_REGEX);
    if (alertSoundMatch) {
      currentBlock.alertSound = alertSoundMatch[1].toLowerCase();
      collectingBaseType = false;
      continue;
    }

    if (MINIMAP_DISABLED_REGEX.test(trimmed)) {
      currentBlock.hasDisabledMinimap = true;
      collectingBaseType = false;
      continue;
    }

    if (PLAY_EFFECT_NONE_REGEX.test(trimmed)) {
      currentBlock.hasNoPlayEffect = true;
      collectingBaseType = false;
      continue;
    }

    if (BASETYPE_LINE_REGEX.test(trimmed)) {
      collectingBaseType = true;
      const names = RarityInsightsParser.extractCardNames(trimmed);
      currentBlock.cardNames.push(...names);
      continue;
    }

    if (collectingBaseType && trimmed.startsWith('"')) {
      const names = RarityInsightsParser.extractCardNames(trimmed);
      currentBlock.cardNames.push(...names);
      continue;
    }

    if (collectingBaseType && trimmed !== "" && !trimmed.startsWith("#")) {
      collectingBaseType = false;
    }
  }

  if (currentBlock?.isDivinationBlock) {
    rawBlocks.push(currentBlock);
  }

  const baseStyle = rawBlocks.find(
    (block) => block.cardNames.length === 0 && hasTierStyle(block.style),
  )?.style;
  const cardBlocks = rawBlocks.filter((block) => block.cardNames.length > 0);

  if (cardBlocks.length === 0 && baseStyle) {
    return [
      {
        tierName: "generic-common",
        rarity: 4,
        cardNames: [],
        style: cloneTierStyle(baseStyle),
      },
    ];
  }

  return cardBlocks
    .map((block) => ({
      block,
      score: scoreGenericDivinationBlock(block),
    }))
    .sort((a, b) => b.score - a.score || a.block.order - b.block.order)
    .map(({ block }, index, rankedBlocks) => {
      const rarity = inferGenericRarity(index, rankedBlocks.length);
      return {
        tierName: `generic-${index + 1}`,
        rarity,
        cardNames: block.cardNames,
        style: mergeTierStyles(baseStyle ?? null, block.style),
      };
    });
}

function parseExplicitDivinationTierName(line: string): string | null {
  if (!BLOCK_HEADER_REGEX.test(line)) {
    return null;
  }

  if (!DIVINATION_TYPE_TOKEN_REGEX.test(line)) {
    return null;
  }

  const tierMatch = line.match(TIER_TOKEN_REGEX);
  return tierMatch?.[1].toLowerCase() ?? null;
}

function hasDivinationHint(line: string): boolean {
  return (
    DIVINATION_TYPE_TOKEN_REGEX.test(line) || DIVINATION_CLASS_REGEX.test(line)
  );
}

function scoreGenericDivinationBlock(block: GenericDivinationBlock): number {
  let score = 0;
  const header = block.header.toLowerCase();

  if (
    /kidding|mirror|jackpot|top|valuable|expensive|insane|best/.test(header)
  ) {
    score += 5;
  }
  if (/absolutely|great|good/.test(header)) {
    score += 1;
  }
  if (/don't care|dont care|miss|low|cheap|bad|trash|hide/.test(header)) {
    score -= 5;
  }

  if (block.action === "Hide") {
    score -= 2;
  }

  if (block.fontSize !== null) {
    if (block.fontSize >= 45) {
      score += 4;
    } else if (block.fontSize >= 40) {
      score += 2;
    } else if (block.fontSize <= 25) {
      score -= 3;
    } else if (block.fontSize <= 30) {
      score -= 1;
    }
  }

  if (block.alertSound === "none") {
    score -= 3;
  } else if (block.alertSound !== null) {
    score += ["1", "2", "6"].includes(block.alertSound) ? 2 : 1;
  }

  if (block.hasDisabledMinimap) {
    score -= 2;
  }
  if (block.hasNoPlayEffect) {
    score -= 2;
  }

  const bgColor = block.style.bgColor;
  if (bgColor) {
    const brightness = (bgColor.r + bgColor.g + bgColor.b) / 3;
    if (brightness > 220) {
      score += 3;
    } else if (brightness > 80) {
      score += 1;
    } else if (brightness < 20) {
      score -= 1;
    }
  }

  return score;
}

function inferGenericRarity(index: number, total: number): KnownRarity {
  if (total <= 1) {
    return 4;
  }

  if (index === 0) {
    return 1;
  }

  if (index === total - 1) {
    return 4;
  }

  if (total >= 4 && index === 1) {
    return 2;
  }

  return 3;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createEmptyTierStyle(): FilterTierStyle {
  return {
    bgColor: null,
    textColor: null,
    borderColor: null,
  };
}

function cloneTierStyle(style: FilterTierStyle): FilterTierStyle {
  return {
    bgColor: style.bgColor ? { ...style.bgColor } : null,
    textColor: style.textColor ? { ...style.textColor } : null,
    borderColor: style.borderColor ? { ...style.borderColor } : null,
  };
}

function mergeTierStyles(
  baseStyle: FilterTierStyle | null,
  overrideStyle: FilterTierStyle,
): FilterTierStyle {
  return {
    bgColor: overrideStyle.bgColor
      ? { ...overrideStyle.bgColor }
      : baseStyle?.bgColor
        ? { ...baseStyle.bgColor }
        : null,
    textColor: overrideStyle.textColor
      ? { ...overrideStyle.textColor }
      : baseStyle?.textColor
        ? { ...baseStyle.textColor }
        : null,
    borderColor: overrideStyle.borderColor
      ? { ...overrideStyle.borderColor }
      : baseStyle?.borderColor
        ? { ...baseStyle.borderColor }
        : null,
  };
}

function hasTierStyle(style: FilterTierStyle): boolean {
  return (
    style.bgColor !== null ||
    style.textColor !== null ||
    style.borderColor !== null
  );
}

function isValidColorChannel(value: number): boolean {
  return value >= 0 && value <= 255;
}
