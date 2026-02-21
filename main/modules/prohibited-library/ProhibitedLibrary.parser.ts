import { join } from "node:path";

import type { KnownRarity, Rarity } from "~/types/data-stores";

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

// ─── CSV Parser ──────────────────────────────────────────────────────────────

/**
 * Parse the Prohibited Library CSV content into structured rows.
 *
 * This is a **pure function** — no DB access, no file I/O.
 *
 * Column mapping (0-based):
 *   0 = card name (header: "patch")
 *   1 = bucket
 *   3 = from_boss indicator (header: "Ritual"); 5 = regular, 4 = boss-specific
 *   `allSamplesIndex - 1` = current-league weight
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
  const headers = headerRow.split(",").map((h) => h.trim());

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

    const columns = line.split(",").map((c) => c.trim());
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

    // Extract ritualValue (column 3 — "Ritual" header, encodes from_boss status)
    const ritualRaw = columns[3];
    const ritualValue = ritualRaw ? parseInt(ritualRaw, 10) : 0;

    // Validate ritualValue and derive fromBoss
    let fromBoss: boolean;
    if (ritualValue === 4) {
      fromBoss = true;
    } else if (ritualValue === 5) {
      fromBoss = false;
    } else {
      // Unexpected value — default to false and log a warning
      // Use console.warn since this is a pure function without LoggerService dependency
      console.warn(
        `[ProhibitedLibrary.parser] Unexpected ritualValue ${ritualValue} for card "${cardName}" ` +
          `(row ${
            i + 1
          }). Expected 4 (boss) or 5 (regular). Defaulting to fromBoss = false.`,
      );
      fromBoss = false;
    }

    // Extract weight from current-league column
    const weightRaw = columns[currentLeagueIndex];
    const weight = weightRaw ? parseInt(weightRaw, 10) : 0;

    rows.push({
      cardName,
      bucket,
      ritualValue,
      weight,
      rawLeagueLabel,
      fromBoss,
    });
  }

  return { rows, rawLeagueLabel };
}

// ─── Weight-to-Rarity Conversion ─────────────────────────────────────────────

/**
 * Convert a raw drop weight to a 0–4 rarity value.
 *
 * Weight and rarity are inversely related to price: a high drop weight means
 * the card is common (cheap), a low weight means it is rare (expensive).
 *
 * The thresholds mirror the existing price-based logic in
 * `DivinationCards.service.ts` (`updateRaritiesFromPrices`), but inverted:
 *
 * | weightPct (weight/maxWeight * 100) | Rarity | Label            |
 * |------------------------------------|--------|------------------|
 * | (maxWeight <= 0)                   | 0      | Unknown          |
 * | >= 70                              | 4      | Common           |
 * | >= 35                              | 3      | Less common      |
 * | >= 5                               | 2      | Rare             |
 * | < 5                                | 1      | Extremely rare   |
 *
 * @param weight    Raw integer weight from the CSV current-league column
 * @param maxWeight The highest weight across all rows (normalisation ceiling)
 * @returns Rarity (0–4) — 0 when maxWeight is zero/negative (no valid data to normalise against)
 */
export function weightToRarity(weight: number, maxWeight: number): Rarity {
  if (maxWeight <= 0) {
    return 0; // No valid weight data to normalise against — rarity is unknown
  }

  const pct = (weight / maxWeight) * 100;
  if (pct >= 70) return 4;
  if (pct >= 35) return 3;
  if (pct >= 5) return 2;
  return 1;
}

// ─── Bucket Fallback ─────────────────────────────────────────────────────────

/**
 * Map a bucket value to a fallback rarity when the weight cell is empty or zero
 * for the current-league column.
 *
 * | Bucket range | Fallback rarity           |
 * |-------------|---------------------------|
 * | 1–5         | 4 (common)                |
 * | 6–12        | 3 (uncommon / less common) |
 * | 13–17       | 2 (rare)                  |
 * | 18+         | 1 (very rare)             |
 *
 * A bucket of 0 or negative (i.e. missing bucket data) defaults to rarity 1
 * (extremely rare) as a conservative fallback.
 *
 * @param bucket Community-defined weight tier group from column B
 * @returns KnownRarity (1–4)
 */
export function bucketToFallbackRarity(bucket: number): KnownRarity {
  if (bucket >= 1 && bucket <= 5) return 4;
  if (bucket >= 6 && bucket <= 12) return 3;
  if (bucket >= 13 && bucket <= 17) return 2;
  if (bucket >= 18) return 1;
  // bucket <= 0 or NaN — conservative fallback
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
