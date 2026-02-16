/**
 * Data Transfer Objects for Filters module
 */

import type { KnownRarity } from "~/types/data-stores";

// ─── Enums / Literal Types ───────────────────────────────────────────────────

/**
 * The type of filter file based on its origin directory.
 */
export type RarityModelFilterType = "local" | "online";

/**
 * The source used to determine divination card rarities.
 * - `poe.ninja`: Price-based rarities from poe.ninja (default)
 * - `filter`: Rarities extracted from a loot filter file
 * - `prohibited-library`: Community-driven data from Prohibited Library (future)
 */
export type RaritySource = "poe.ninja" | "filter" | "prohibited-library";

// ─── DTOs ────────────────────────────────────────────────────────────────────

/**
 * Represents stored filter metadata from the database.
 * Used when returning filter info to the renderer.
 */
export interface RarityModelMetadataDTO {
  id: string;
  filterType: RarityModelFilterType;
  filePath: string;
  filterName: string;
  lastUpdate: string | null;
  isFullyParsed: boolean;
  parsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a filter discovered during directory scanning.
 * Extends metadata with runtime-only fields like outdated detection.
 */
export interface DiscoveredRarityModelDTO {
  id: string;
  type: RarityModelFilterType;
  filePath: string;
  fileName: string;
  name: string;
  lastUpdate: string | null;
  isFullyParsed: boolean;
  isOutdated: boolean;
}

/**
 * A single card-to-rarity mapping from a parsed filter.
 */
export interface RarityModelCardRarityDTO {
  filterId: string;
  cardName: string;
  rarity: KnownRarity; // 1=extremely rare, 2=rare, 3=less common, 4=common (no unknown — filters always assign a tier)
}

/**
 * Result of a full filter parse operation.
 */
export interface RarityModelParseResultDTO {
  filterId: string;
  filterName: string;
  totalCards: number;
  rarities: RarityModelCardRarityDTO[];
  hasDivinationSection: boolean;
}

/**
 * Summary info for a scanned filter directory.
 */
export interface RarityModelScanResultDTO {
  filters: DiscoveredRarityModelDTO[];
  localCount: number;
  onlineCount: number;
}
