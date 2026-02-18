// Game type
export type GameType = "poe1" | "poe2";

// Price source type
export type PriceSource = "exchange" | "stash";

/** poe.ninja price confidence: 1 = high/reliable, 2 = medium/thin sample, 3 = low/unreliable */
export type Confidence = 1 | 2 | 3;

/** Divination card rarity: 0=unknown, 1=extremely rare, 2=rare, 3=less common, 4=common */
export type Rarity = 0 | 1 | 2 | 3 | 4;

/** Known rarity (excludes unknown). Used for filter-derived rarities where every card has an explicit tier. */
export type KnownRarity = 1 | 2 | 3 | 4;

// Calculated price info for a card
export interface CardPriceInfo {
  chaosValue: number;
  divineValue: number;
  totalValue: number; // chaosValue * count
  hidePrice?: boolean; // Flag to exclude from calculations
}

// Divination card metadata from static data
export interface DivinationCardMetadata {
  id?: string | null;
  stackSize?: number | null;
  description?: string | null;
  rewardHtml?: string | null;
  artSrc?: string | null;
  flavourHtml?: string | null;
  rarity?: Rarity;
  filterRarity?: KnownRarity | null;
}

// Card entry for UI display (already flattened with both prices)
export interface CardEntry {
  name: string;
  count: number;
  ratio?: number; // Percentage of total cards (optional, calculated at display time)
  processedIds?: string[];
  stashPrice?: CardPriceInfo;
  exchangePrice?: CardPriceInfo;
  divinationCard?: DivinationCardMetadata; // Joined from divination_cards table
}

// Price snapshot for a specific card (from poe.ninja API)
export interface CardPriceSnapshot {
  chaosValue: number;
  divineValue: number;
  hidePrice?: boolean;
  confidence?: Confidence;
}

// Session price snapshot (captured at session start)
export interface SessionPriceSnapshot {
  timestamp: string;
  stackedDeckChaosCost: number;
  exchange: {
    chaosToDivineRatio: number;
    cardPrices: Record<string, CardPriceSnapshot>;
  };
  stash: {
    chaosToDivineRatio: number;
    cardPrices: Record<string, CardPriceSnapshot>;
  };
}

// Aggregate totals for quick access
export interface SessionTotals {
  stash: {
    totalValue: number;
    netProfit: number;
    chaosToDivineRatio: number;
  };
  exchange: {
    totalValue: number;
    netProfit: number;
    chaosToDivineRatio: number;
  };
  stackedDeckChaosCost: number;
  totalDeckCost: number;
}

export interface RecentDrop {
  cardName: string;
  rarity?: Rarity;
  exchangePrice: {
    chaosValue: number;
    divineValue: number;
  };
  stashPrice: {
    chaosValue: number;
    divineValue: number;
  };
}

export interface DetailedDivinationCardStats {
  totalCount: number;
  cards: CardEntry[];
  recentDrops?: RecentDrop[];
  startedAt?: string;
  endedAt?: string | null;
  league?: string;
  lastUpdated?: string;
  snapshotId?: string | null;
  priceSnapshot?: SessionPriceSnapshot;
  totals?: SessionTotals;
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
