import type { GameType, KnownRarity, Rarity } from "../../../types/data-stores";

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
  hidePrice: boolean;
  divinationCard?: {
    id: string;
    stackSize?: number | null;
    description?: string | null;
    rewardHtml?: string | null;
    artSrc?: string | null;
    flavourHtml?: string | null;
    rarity: Rarity;
    filterRarity?: KnownRarity | null;
    prohibitedLibraryRarity?: Rarity | null;
  };
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

export interface SessionSummaryDTO {
  sessionId: string;
  game: GameType;
  league: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalDecksOpened: number;
  totalValue: number;
  netProfit: number | null;
  chaosToDivineRatio: number;
  stackedDeckChaosCost: number;
}

export interface SessionCardEventDTO {
  id: number;
  sessionId: string;
  cardName: string;
  chaosValue: number | null;
  divineValue: number | null;
  droppedAt: string;
}

export interface CardDropContextDTO {
  droppedAt: string;
  localMinute: number;
  utcOffsetMinutes: number;
  location: string | null;
}

export interface HistoricalCardEventCandidate {
  id: number;
  eventId: string;
  sessionId: string;
  cardName: string;
  league: string;
}

export interface CardEventContextUpdate {
  id: number;
  eventId: string;
  sessionId: string;
  sourceEventId: string;
  cardName: string;
  droppedAt: string;
  location: string | null;
  localMinute: number;
  utcOffsetMinutes: number;
  league: string;
}

export interface SessionCardEventSummaryDTO {
  cardName: string;
  chaosValue: number | null;
  divineValue: number | null;
  droppedAt: string;
  cumulativeChaosValue: number;
  cumulativeDivineValue: number;
}
