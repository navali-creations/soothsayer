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

// Price snapshot for a specific card
export interface CardPriceSnapshot {
  chaosValue: number;
  divineValue: number;
  stackSize?: number;
  hidePrice?: boolean; // Flag to exclude this price from calculations due to anomalies
}

// Session price snapshot (captured at session start)
export interface SessionPriceSnapshot {
  timestamp: string;
  exchange: {
    chaosToDivineRatio: number;
    cardPrices: Record<string, CardPriceSnapshot>;
  };
  stash: {
    chaosToDivineRatio: number;
    cardPrices: Record<string, CardPriceSnapshot>;
  };
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
  // Price snapshot captured at session start
  priceSnapshot?: SessionPriceSnapshot;
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
