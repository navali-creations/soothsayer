import type { CardEntry as BaseCardEntry } from "~/types/data-stores";

export type CardEntry = BaseCardEntry & {
  ratio: number;
};

/** Highlight data for the most profitable session */
export interface MostProfitableSessionHighlight {
  sessionId: string;
  date: string;
  profit: number;
  league: string;
  chaosPerDivine: number;
}

/** Highlight data for the longest session */
export interface LongestSessionHighlight {
  sessionId: string;
  date: string;
  durationMinutes: number;
}

/** Highlight data for the session with the most decks opened */
export interface MostDecksOpenedHighlight {
  sessionId: string;
  date: string;
  totalDecksOpened: number;
}

/** Highlight data for the session with the most decks opened but worst profit */
export interface BiggestLetdownHighlight {
  sessionId: string;
  date: string;
  totalDecksOpened: number;
  profit: number;
  league: string;
  chaosPerDivine: number;
}

/** Highlight data for the session with the least decks opened but highest profit */
export interface LuckyBreakHighlight {
  sessionId: string;
  date: string;
  totalDecksOpened: number;
  profit: number;
  league: string;
  chaosPerDivine: number;
}

/** Average values across all sessions (scoped by game/league) */
export interface SessionAverages {
  avgProfit: number;
  avgDecksOpened: number;
  avgDurationMinutes: number;
  avgChaosPerDivine: number;
  sessionCount: number;
}

/** Aggregated session highlights for stat cards */
export interface SessionHighlights {
  mostProfitable: MostProfitableSessionHighlight | null;
  longestSession: LongestSessionHighlight | null;
  mostDecksOpened: MostDecksOpenedHighlight | null;
  biggestLetdown: BiggestLetdownHighlight | null;
  luckyBreak: LuckyBreakHighlight | null;
  totalDecksOpened: number;
  averages: SessionAverages | null;
}
