import { join } from "node:path";

import type { ProhibitedLibraryRawRow } from "./ProhibitedLibrary.dto";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of parsing the Prohibited Library CSV asset.
 * Contains the parsed data rows and the raw league label from the header.
 */
export interface ParseResult {
  rows: ProhibitedLibraryRawRow[];
  rawLeagueLabel: string; // Header value at the current-league column, unresolved
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Sentinel column header that marks the aggregate column (never used as a rarity source). */
const ALL_SAMPLES_HEADER = "All samples";

/** Aggregate row label to skip (row index 1 in the CSV). */
const SAMPLE_SIZE_LABEL = "Sample Size";

/** Regex to detect patch version headers like "3.18", "3.26", etc. */
const PATCH_VERSION_REGEX = /^\d+\.\d+$/;

/** CSV filename for the Prohibited Library weights asset. */
const CSV_FILENAME = "prohibited-library-weights.csv";

// ─── CSV Helpers ─────────────────────────────────────────────────────────────

/**
 * Split a single CSV line into fields, respecting RFC 4180-style quoted fields.
 *
 * A field wrapped in double quotes may contain commas and escaped quotes (`""`).
 * Surrounding quotes are stripped and inner `""` pairs are collapsed to `"`.
 *
 * Falls back to a simple comma-split when no quotes are present (fast path).
 */
export function splitCsvLine(line: string): string[] {
  // Fast path — no quotes at all
  if (!line.includes('"')) {
    return line.split(",").map((f) => f.trim());
  }

  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }

  // Push the last field
  fields.push(current.trim());
  return fields;
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────

/**
 * Parse the Prohibited Library CSV content into structured rows.
 *
 * This is a **pure function** — no DB access, no file I/O.
 *
 * Column mapping (0-based):
 *   0 = card name (header: "patch")
 *   1 = bucket (community-defined weight tier — unrelated to our rarity system)
 *   2 = Faustus model tier (header: "Faustus") — coarse rarity bucket, NOT
 *       used for probability math (skipped during parsing)
 *   3 = from_boss indicator (header: "Ritual"); only the literal text "Boss"
 *       is meaningful — all other values in this column are irrelevant
 *   `allSamplesIndex - 1` = current-league weight (0 = not in Stacked Decks)
 *
 * @param csvContent Raw CSV string from the bundled asset
 * @returns Parsed rows and the raw league label
 * @throws {Error} If the CSV structure is invalid (missing "All samples" column or patch version header detected)
 */
export function parseProhibitedLibraryCsv(csvContent: string): ParseResult {
  // Split on \r\n or \n to handle both line ending styles
  const lines = csvContent.split(/\r?\n/);

  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
    throw new Error(
      "Prohibited Library CSV is too short — expected at least a header row and data rows",
    );
  }

  // ── Parse header row ──────────────────────────────────────────────────
  const headerRow = lines[0];
  const headers = splitCsvLine(headerRow);

  const allSamplesIndex = headers.indexOf(ALL_SAMPLES_HEADER);
  if (allSamplesIndex === -1) {
    throw new Error(
      `Prohibited Library CSV header row does not contain "${ALL_SAMPLES_HEADER}" column`,
    );
  }

  if (allSamplesIndex < 1) {
    throw new Error(
      `"${ALL_SAMPLES_HEADER}" column is at index ${allSamplesIndex} — ` +
        `there is no preceding column to use as the current-league weight`,
    );
  }

  const currentLeagueIndex = allSamplesIndex - 1;
  const rawLeagueLabel = headers[currentLeagueIndex];

  // Validate that the current-league header is NOT a patch version number
  if (isPatchVersionHeader(rawLeagueLabel)) {
    throw new Error(
      `Current-league column header "${rawLeagueLabel}" looks like a patch version number ` +
        `(matches ${PATCH_VERSION_REGEX}). Expected a canonical league name (e.g. "Keepers"). ` +
        `The CSV structure may have changed unexpectedly.`,
    );
  }

  // ── Parse data rows ───────────────────────────────────────────────────
  const rows: ProhibitedLibraryRawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line || line.trim().length === 0) {
      continue;
    }

    const columns = splitCsvLine(line);
    const cardName = columns[0];

    // Skip the "Sample Size" aggregate row
    if (cardName === SAMPLE_SIZE_LABEL) {
      continue;
    }

    // Skip rows where card name is empty
    if (!cardName) {
      continue;
    }

    // Extract bucket (column 1)
    const bucketRaw = columns[1];
    const bucket = bucketRaw ? parseInt(bucketRaw, 10) : 0;

    // Column 2 ("Faustus") is a coarse rarity tier — intentionally skipped.

    // Extract from_boss from column 3 ("Ritual" header).
    // Only the literal text "Boss" matters; all other values are irrelevant.
    const ritualRaw = columns[3];
    const fromBoss = deriveFromBoss(ritualRaw);

    // Extract weight from current-league column
    const weightRaw = columns[currentLeagueIndex];
    const weight = weightRaw ? parseInt(weightRaw, 10) : 0;

    rows.push({
      cardName,
      bucket,
      weight,
      rawLeagueLabel,
      fromBoss,
    });
  }

  return { rows, rawLeagueLabel };
}

// ─── From-Boss Derivation ────────────────────────────────────────────────────

/**
 * Derive the `fromBoss` flag from the raw Ritual column value.
 *
 * Only the literal text "Boss" (case-insensitive) means boss-exclusive.
 * All other values in this column (numeric tiers, empty, etc.) are
 * completely irrelevant to our purposes and simply mean "not boss".
 *
 * @param ritualRaw  The raw string value from column D
 * @returns `true` if the card is boss-exclusive
 */
export function deriveFromBoss(ritualRaw: string | undefined): boolean {
  if (!ritualRaw) {
    return false;
  }

  return ritualRaw.toLowerCase() === "boss";
}

// ─── Weight-to-Rarity Conversion (Absolute Thresholds) ──────────────────────

/**
 * Map a raw drop weight to a KnownRarity (1–4) using **absolute weight
 * thresholds** derived from the real Prohibited Library CSV data.
 *
 * The CSV weights are normalised drop-rate indicators on a stable scale
 * (e.g. Rain of Chaos ≈ 121 400 across all leagues). Because they do NOT
 * scale with sample size, fixed thresholds produce consistent results
 * regardless of which league column is used.
 *
 * Threshold rationale (validated against the Keepers-league column):
 *
 * | Weight range | Rarity | Label           | ≈ card count | Examples                        |
 * |-------------|--------|-----------------|-------------|---------------------------------|
 * | > 5 000      | 4      | Common          | ~87          | Rain of Chaos, Lucky Connections |
 * | 1 001–5 000  | 3      | Less common     | ~92          | The Nurse, Man With Bear         |
 * | 31–1 000     | 2      | Rare            | ~147         | A Mother's Parting Gift          |
 * | ≤ 30         | 1      | Extremely rare  | ~43          | The Apothecary, The Doctor       |
 *
 * Cards with weight 0 get rarity 0 (unknown) in `convertWeights` — the
 * weight relates to stacked deck drops, so no weight means no data,
 * regardless of whether the card is boss-exclusive or not.
 *
 * @param weight  Non-zero weight from the CSV current-league column
 * @returns KnownRarity (1–4)
 */
export function weightToDropRarity(weight: number): 1 | 2 | 3 | 4 {
  if (weight > 5000) return 4;
  if (weight > 1000) return 3;
  if (weight > 30) return 2;
  return 1;
}

// ─── Patch Version Validation ────────────────────────────────────────────────

/**
 * Check whether a column header looks like a patch version number (e.g. "3.18", "3.26").
 *
 * The current-league column header should be a canonical league name (e.g. "Keepers"),
 * not a patch version. If this returns `true`, parsing should be aborted because the
 * CSV structure has likely changed unexpectedly.
 *
 * @param header The header label to check
 * @returns `true` if it matches the `^\d+\.\d+$` pattern
 */
export function isPatchVersionHeader(header: string): boolean {
  return PATCH_VERSION_REGEX.test(header);
}

// ─── Path Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the filesystem path to the bundled Prohibited Library CSV asset.
 *
 * Follows the same pattern as `DivinationCardsService` path resolution:
 * - **Packaged:** `extraResource` copies `renderer/assets/poe1/` to `<resources>/poe1/`
 * - **Dev:** read from the project tree at `<appPath>/renderer/assets/poe1/`
 *
 * Returns `null` for games that don't have a bundled CSV yet (currently only PoE1 is supported).
 *
 * ⚠️ In packaged mode, the path must NOT contain `renderer/assets/` — that prefix
 * is stripped by Electron's `extraResource` mechanism.
 *
 * @param game         The game identifier ("poe1" or "poe2")
 * @param isPackaged   Whether the app is running in packaged mode (`app.isPackaged`)
 * @param resourcesPath The packaged resources path (`process.resourcesPath`)
 * @param appPath      The app root path (`app.getAppPath()`)
 * @returns Absolute path to the CSV, or `null` if the game has no bundled asset
 */
export function resolveCsvPath(
  game: "poe1" | "poe2",
  isPackaged: boolean,
  resourcesPath: string,
  appPath: string,
): string | null {
  // PoE2 support is reserved for a future release
  if (game !== "poe1") {
    return null;
  }

  if (isPackaged) {
    return join(resourcesPath, "poe1", CSV_FILENAME);
  }

  return join(appPath, "renderer", "assets", "poe1", CSV_FILENAME);
}
