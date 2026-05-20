export interface SessionsSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  league: string;
  isActive: boolean;
  durationMinutes: number | null;
  totalDecksOpened: number;
  totalValue: number | null;
  netProfit: number | null;
  chaosToDivineRatio: number | null;
  stackedDeckChaosCost: number | null;
}
