import type { SessionPriceSnapshot } from "../../../types/data-stores";

/**
 * Data Transfer Objects for Snapshot module
 */

export interface SnapshotDTO {
  id: string;
  leagueId: string;
  fetchedAt: string;
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
}

export interface SnapshotCardPriceDTO {
  cardName: string;
  priceSource: "exchange" | "stash";
  chaosValue: number;
  divineValue: number;
  stackSize: number | null;
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
