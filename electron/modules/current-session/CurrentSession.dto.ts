import type { GameType } from "../../../types/data-stores";

/**
 * Data Transfer Objects for CurrentSession module
 * These represent data as used by the application layer
 */

export interface SessionDTO {
  id: string;
  game: GameType;
  leagueId: string;
  snapshotId: string | null;
  startedAt: string;
  endedAt: string | null;
  totalCount: number;
  isActive: boolean;
}

export interface SessionCardDTO {
  cardName: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  hidePriceExchange: boolean;
  hidePriceStash: boolean;
}

export interface ProcessedIdDTO {
  processedId: string;
}

export interface CreateSessionDTO {
  id: string;
  game: GameType;
  leagueId: string;
  snapshotId: string;
  startedAt: string;
}

export interface UpdateSessionDTO {
  totalCount?: number;
  endedAt?: string;
  isActive?: boolean;
}

export interface UpsertSessionCardDTO {
  sessionId: string;
  cardName: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  hidePriceExchange?: boolean;
  hidePriceStash?: boolean;
}

export interface SessionSummaryDTO {
  sessionId: string;
  game: GameType;
  league: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalDecksOpened: number;
  totalExchangeValue: number;
  totalStashValue: number;
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
}
