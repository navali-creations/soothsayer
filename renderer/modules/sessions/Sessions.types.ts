export interface SessionsSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  league: string;
  isActive: boolean;
  durationMinutes: number | null;
  totalDecksOpened: number;
  totalExchangeValue: number | null;
  exchangeChaosToDivine: number | null;
  totalStashValue: number | null;
  stashChaosToDivine: number | null;
}
