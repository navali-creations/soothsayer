// Game type
export type GameType = "poe1" | "poe2";

// Simple card entry (for league and all-time stats)
export interface SimpleCardEntry {
  count: number;
}

// Detailed card entry (for session data with processedIds)
export interface DetailedCardEntry {
  count: number;
  processedIds: string[];
}

// Simple divination card stats (no processedIds)
export interface SimpleDivinationCardStats {
  totalCount: number;
  cards: Record<string, SimpleCardEntry>;
  lastUpdated?: string;
}

// Detailed divination card stats (with processedIds for sessions)
export interface DetailedDivinationCardStats {
  totalCount: number;
  cards: Record<string, DetailedCardEntry>;
  startedAt?: string;
  endedAt?: string | null;
  league?: string;
  lastUpdated?: string;
}

// Global stats across all games
export interface GlobalStats {
  totalStackedDecksOpened: number;
}

// New card data when detected from logs
export interface NewCardData {
  cardName: string;
  processedId: string;
  game: GameType;
  league: string;
}
