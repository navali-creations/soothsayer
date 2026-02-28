import type { Rarity } from "~/types/data-stores";

/**
 * Data Transfer Objects for the Prohibited Library module.
 *
 * The Prohibited Library (Path of Exile Science & Data Discord community)
 * maintains empirical stacked-deck opening results. This module bundles
 * that data as a CSV asset and converts raw drop-weights into the app's
 * 1–4 rarity scale.
 */

/**
 * Represents a single card's weight data from the Prohibited Library,
 * ready for consumption by the UI or other services.
 */
export interface ProhibitedLibraryCardWeightDTO {
  cardName: string;
  game: "poe1" | "poe2";
  league: string; // Canonical league name, e.g. "Keepers"
  weight: number; // Raw integer weight from spreadsheet
  rarity: Rarity; // Derived 0–4 rarity (0=unknown, 1=extremely rare, 2=rare, 3=less common, 4=common)
  fromBoss: boolean; // true if card is boss-exclusive in stacked deck context
  loadedAt: string; // ISO timestamp of when this data was last loaded from asset
}

/**
 * Status snapshot of the Prohibited Library data in the local database.
 * Used by the Settings UI and frontend slice to show current state.
 */
export interface ProhibitedLibraryStatusDTO {
  hasData: boolean;
  lastLoadedAt: string | null;
  cardCount: number;
  league: string | null; // Canonical league name this data belongs to
  appVersion: string | null; // App version that produced the current DB data
}

/**
 * Result of a load/reload operation — returned after parsing the bundled
 * CSV asset and persisting to the database.
 */
export interface ProhibitedLibraryLoadResultDTO {
  success: boolean;
  cardCount: number;
  league: string;
  loadedAt: string;
  error?: string;
}

/**
 * A single raw row parsed from the bundled CSV before any rarity
 * conversion or database mapping.
 *
 * Column mapping (from the Google Spreadsheet "Weights" tab):
 *   A = card name (header: "patch")
 *   B = bucket (community-defined weight tier group — unrelated to our rarity system)
 *   C = Faustus model tier (coarse rarity bucket — NOT used for probability math)
 *   D = from_boss indicator (header: "Ritual"); only the literal text
 *       "Boss" is meaningful — all other values in this column are irrelevant
 *   Last data column before "All samples" = current-league weight
 *
 * A weight of 0 means the card has no stacked deck drop data for the
 * current league — rarity is set to 0 (unknown) regardless of whether
 * the card is boss-exclusive or not.
 */
export interface ProhibitedLibraryRawRow {
  cardName: string;
  bucket: number; // Column B — community-defined weight tier group (unrelated to our rarity system)
  weight: number; // Last data column before "All samples" — current-league weight (0 = not in Stacked Decks)
  rawLeagueLabel: string; // Header label as-is from the asset CSV — always a canonical league name (e.g. "Keepers")
  fromBoss: boolean; // Derived from Ritual column: true only when the literal text "Boss" appears
}
