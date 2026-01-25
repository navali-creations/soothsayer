import type { GameType } from "../../../types/data-stores";

/**
 * Data Transfer Objects for DataStore module
 */

export interface CardDTO {
  cardName: string;
  count: number;
  lastUpdated: string | null;
}

export interface GlobalStatDTO {
  key: string;
  value: number;
}

export interface CardStatsDTO {
  totalCount: number;
  cards: Record<string, { count: number }>;
  lastUpdated?: string;
}

export interface UpsertCardDTO {
  game: GameType;
  scope: string;
  cardName: string;
  timestamp: string;
}
