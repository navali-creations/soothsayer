// Game type
export type GameType = "poe1" | "poe2";

// Price source type
export type PriceSource = "exchange" | "stash";

/**
 * Rarity source determines which dataset drives card rarity tiers.
 * - `poe.ninja`: Price-based rarity from poe.ninja market data
 * - `filter`: Rarity tiers from a parsed loot filter
 * - `prohibited-library`: Weight-based rarity from community-collected drop data
 */
export type RaritySource = "poe.ninja" | "filter" | "prohibited-library";

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
  id: string;
  rarity: Rarity;
  fromBoss: boolean;
  isDisabled?: boolean;
  stackSize?: number | null;
  description?: string | null;
  rewardHtml?: string | null;
  artSrc?: string | null;
  flavourHtml?: string | null;
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
  /** Bulk exchange rate (decks/divine) from poe.ninja maxVolumeRate. Undefined for older snapshots. */
  stackedDeckMaxVolumeRate?: number;
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

// Simple card entry (for league and all-time aggregate stats)
export interface SimpleCardEntry {
  count: number;
  divinationCard?: DivinationCardMetadata;
}

// Simple divination card stats (keyed by card name, no per-card prices)
export interface SimpleDivinationCardStats {
  totalCount: number;
  cards: Record<string, SimpleCardEntry>;
  lastUpdated?: string;
}

// Timeline bucket for profit-over-time chart (1-minute aggregation)
export interface TimelineBucket {
  timestamp: string;
  dropCount: number;
  cumulativeChaosValue: number;
  cumulativeDivineValue: number;
  topCard: string | null;
  topCardChaosValue: number;
}

// Live edge point showing recent individual drops
export interface TimelineLiveEdgePoint {
  id: number;
  sessionId: string;
  cardName: string;
  chaosValue: number | null;
  divineValue: number | null;
  droppedAt: string;
}

// Notable drop for timeline chart — individual rarity 1/2/3 card drops shown as bars
export interface NotableDrop {
  /** Cumulative drop index at which this card dropped (X position on chart) */
  cumulativeDropIndex: number;
  cardName: string;
  /** Chaos value of this individual drop */
  chaosValue: number;
  /** Card rarity: 1 = extremely rare, 2 = rare, 3 = less common */
  rarity: 1 | 2 | 3;
}

// Aggregated timeline data for chart rendering
export interface AggregatedTimeline {
  buckets: TimelineBucket[];
  liveEdge: TimelineLiveEdgePoint[];
  totalChaosValue: number;
  totalDivineValue: number;
  totalDrops: number;
  notableDrops: NotableDrop[];
}

/** Incremental timeline update sent from main → renderer on each card drop. */
export interface TimelineDelta {
  /** The bucket that was updated or newly created. */
  bucket: TimelineBucket;
  /** If this drop was a notable drop, includes it here. */
  notableDrop: NotableDrop | null;
  /** Updated totals. */
  totalChaosValue: number;
  totalDivineValue: number;
  totalDrops: number;
}

/** Incremental session update sent from main → renderer on each card drop.
 *  Replaces the full session broadcast to avoid expensive structured clones. */
export interface SessionCardDelta {
  /** The card that was just dropped. */
  cardName: string;
  /** Updated count for this card (after increment). */
  newCount: number;
  /** Updated session-wide total count. */
  totalCount: number;
  /** Exchange price info for this card (null if no snapshot). */
  exchangePrice: { chaosValue: number; divineValue: number } | null;
  /** Stash price info for this card (null if no snapshot). */
  stashPrice: { chaosValue: number; divineValue: number } | null;
  /** Updated session totals (recalculated incrementally). */
  updatedTotals: SessionTotals;
  /** The new recent drop entry to prepend to recentDrops. */
  recentDrop: RecentDrop;
  /** Divination card metadata (for new cards not yet in the cards array). */
  divinationCard?: DivinationCardMetadata;
  /** Whether exchange price is hidden for this card. */
  hidePriceExchange?: boolean;
  /** Whether stash price is hidden for this card. */
  hidePriceStash?: boolean;
}

export interface DetailedDivinationCardStats {
  id?: string;
  totalCount: number;
  cards: CardEntry[];
  recentDrops?: RecentDrop[];
  startedAt?: string;
  endedAt?: string | null;
  duration?: string;
  league?: string;
  lastUpdated?: string;
  snapshotId?: string | null;
  priceSnapshot?: SessionPriceSnapshot;
  totals?: SessionTotals;
  timeline?: AggregatedTimeline;
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
