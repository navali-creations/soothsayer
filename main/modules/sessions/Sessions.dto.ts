/**
 * Data Transfer Objects for Sessions module
 */

export interface SessionSummaryDTO {
  sessionId: string;
  game: string;
  league: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalDecksOpened: number;
  totalExchangeValue: number;
  totalStashValue: number;
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
  isActive: boolean;
}

export interface SessionsPageDTO {
  sessions: SessionSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SessionDetailsDTO {
  id: string;
  game: string;
  leagueId: string;
  league: string;
  snapshotId: string | null;
  startedAt: string;
  endedAt: string | null;
  totalCount: number;
  isActive: boolean;
}

export interface SessionCardDetailsDTO {
  cardName: string;
  count: number;
  hidePriceExchange: boolean;
  hidePriceStash: boolean;
  divinationCard?: {
    id: string;
    stackSize?: number | null;
    description?: string | null;
    rewardHtml?: string | null;
    artSrc?: string | null;
    flavourHtml?: string | null;
    rarity?: number;
  };
}
