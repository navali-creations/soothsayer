export interface SessionsSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  league: string;
  isActive: boolean;
  durationMinutes: number | null;
  totalDecksOpened: number;
  totalExchangeValue: number | null;
  totalStashValue: number | null;
  totalExchangeNetProfit: number | null;
  totalStashNetProfit: number | null;
  exchangeChaosToDivine: number | null;
  stashChaosToDivine: number | null;
  stackedDeckChaosCost: number | null;
}
