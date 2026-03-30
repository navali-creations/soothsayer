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
  totalExchangeNetProfit: number | null;
  totalStashNetProfit: number | null;
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
  stackedDeckChaosCost: number;
  isActive: boolean;
  /** Number of this specific card found in the session (only set by searchByCard) */
  cardCount?: number;
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

export interface SessionHighlightDTO {
  sessionId: string;
  date: string;
  league: string;
}

export interface MostProfitableSessionDTO extends SessionHighlightDTO {
  profit: number;
  chaosPerDivine: number;
}

export interface LongestSessionDTO extends SessionHighlightDTO {
  durationMinutes: number;
}

export interface MostDecksOpenedDTO extends SessionHighlightDTO {
  totalDecksOpened: number;
}

export interface BiggestLetdownSessionDTO extends SessionHighlightDTO {
  totalDecksOpened: number;
  profit: number;
  chaosPerDivine: number;
}

export interface LuckyBreakSessionDTO extends SessionHighlightDTO {
  totalDecksOpened: number;
  profit: number;
  chaosPerDivine: number;
}

export interface SessionAveragesDTO {
  avgProfit: number;
  avgDecksOpened: number;
  avgDurationMinutes: number;
  avgChaosPerDivine: number;
  sessionCount: number;
}

/** Lightweight per-session data point for the Statistics page charts. */
export interface SessionChartDataPointDTO {
  sessionIndex: number;
  sessionDate: string;
  league: string;
  durationMinutes: number;
  totalDecksOpened: number;
  exchangeNetProfit: number;
  chaosPerDivine: number;
}
