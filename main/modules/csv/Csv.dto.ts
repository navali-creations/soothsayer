import type { GameType } from "../../../types/data-stores";

/**
 * Data Transfer Objects for CSV module
 */

// ─── Export Enums ───────────────────────────────────────────────────────────────

export enum CsvExportType {
  All = "all",
  Incremental = "incremental",
  Session = "session",
}

// ─── Export Result DTOs ─────────────────────────────────────────────────────────

export interface CsvExportResultDTO {
  success: boolean;
  canceled?: boolean;
  error?: string;
  /** Number of cards exported (rows in CSV, excluding header) */
  exportedCount?: number;
}

// ─── Snapshot DTOs ──────────────────────────────────────────────────────────────

export interface CsvExportSnapshotDTO {
  game: string;
  scope: string;
  cardName: string;
  count: number;
  totalCount: number;
  exportedAt: string;
  integrityStatus: CsvIntegrityStatus | null;
  integrityDetails: string | null;
}

export interface CsvSnapshotMetaDTO {
  /** ISO timestamp of the last export, or null if never exported */
  lastExportedAt: string | null;
  /** Total card count at time of last snapshot */
  snapshotTotal: number;
  /** Number of distinct card names in the snapshot */
  snapshotCardCount: number;
}

/**
 * Aggregated snapshot metadata returned to the renderer.
 * Used by the mapper to summarize snapshot rows.
 */
export interface SnapshotMetaDTO {
  exists: boolean;
  exportedAt: string | null;
  snapshotTotal: number;
  cardCount: number;
}

/**
 * A single card entry to be saved in a snapshot.
 * Used by the repository's saveSnapshot method.
 */
export interface SaveSnapshotEntryDTO {
  cardName: string;
  count: number;
}

// ─── Request DTOs ───────────────────────────────────────────────────────────────

export interface ExportScopeDTO {
  game: GameType;
  scope: string;
}

export interface SaveSnapshotDTO {
  game: GameType;
  scope: string;
  cards: Record<string, number>;
  totalCount: number;
  integrityStatus?: CsvIntegrityStatus | null;
  integrityDetails?: string | null;
}

// ─── Integrity Check DTOs ───────────────────────────────────────────────────────

export enum CsvIntegrityStatus {
  Pass = "pass",
  Warn = "warn",
  Fail = "fail",
}

export type IntegrityStatus = CsvIntegrityStatus;

export enum CsvIntegrityCheck {
  AllTimeVsSessionCards = "allTimeVsSessionCards",
  AllTimeVsGlobalCounter = "allTimeVsGlobalCounter",
  AllTimeVsLeagueSum = "allTimeVsLeagueSum",
  SnapshotNonDecreasing = "snapshotNonDecreasing",
}

export interface IntegrityCheckDetail {
  check: CsvIntegrityCheck | string;
  status: IntegrityStatus;
  message: string;
  expected?: number;
  actual?: number;
}

export interface IntegrityCheckResult {
  status: IntegrityStatus;
  details: IntegrityCheckDetail[];
}
