import type { KnownRarity } from "~/types/data-stores";

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
  rarity: KnownRarity; // Derived 1–4 rarity
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
 *   A = card name (header label: "patch")
 *   B = bucket
 *   D = from_boss indicator (header label: "Ritual"); 5 = regular, 4 = boss-specific
 *   Last data column before "All samples" = current-league weight
 */
export interface ProhibitedLibraryRawRow {
  cardName: string;
  bucket: number; // Column B — used as fallback for rarity when weight is absent
  ritualValue: number; // Column D ("Ritual") raw value: 5 = regular drop, 4 = boss-specific
  weight: number; // Last data column before "All samples" — current-league weight
  rawLeagueLabel: string; // Header label as-is from the asset CSV — always a canonical league name (e.g. "Keepers")
  fromBoss: boolean; // Derived from ritualValue: true if ritualValue === 4
}
