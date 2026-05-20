import type {
  Confidence,
  SessionPriceSnapshot,
} from "../../../types/data-stores";

/**
 * Data Transfer Objects for Snapshot module
 */

export interface SnapshotDTO {
  id: string;
  leagueId: string;
  fetchedAt: string;
  /** When this snapshot was stored locally (ISO timestamp). */
  createdAt: string;
  chaosToDivineRatio: number;
  stackedDeckChaosCost: number;
  /** Bulk exchange rate (decks/divine) from poe.ninja maxVolumeRate. NULL for older snapshots. */
  stackedDeckMaxVolumeRate: number | null;
}

export interface SnapshotCardPriceDTO {
  cardName: string;
  chaosValue: number;
  divineValue: number;
  confidence: Confidence;
}

export interface LeagueDTO {
  id: string;
  game: string;
  name: string;
  startDate: string | null;
}

export interface CreateSnapshotDTO {
  id: string;
  leagueId: string;
  snapshotData: SessionPriceSnapshot;
}

export interface CreateLeagueDTO {
  id: string;
  game: string;
  name: string;
  startDate?: string;
}
