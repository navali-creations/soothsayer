import type { DivinationCardDTO } from "~/main/modules/divination-cards/DivinationCards.dto";
import type { GameType, KnownRarity, Rarity } from "~/types/data-stores";

/**
 * A single data point in the price history timeline.
 * Each point represents a daily snapshot from poe.ninja.
 */
export interface CardPriceHistoryPointDTO {
  /** ISO date string (e.g. "2026-03-04T00:00:00Z") */
  timestamp: string;
  /** Price in divine orbs */
  rate: number;
  /** Trade volume (volumePrimaryValue from poe.ninja) */
  volume: number;
}

/**
 * Price change percentages over various lookback periods.
 * A field is `undefined` if the history doesn't go back far enough.
 */
export interface PriceChangeSummary {
  /** Percentage change over the last 24 hours */
  change24h?: number;
  /** Percentage change over the last 7 days */
  change7d?: number;
  /** Percentage change over the last 30 days */
  change30d?: number;
}

/**
 * Full price history response for a divination card.
 * Returned by the `card-details:get-price-history` IPC channel.
 */
export interface CardPriceHistoryDTO {
  /** The card's display name (e.g. "House of Mirrors") */
  cardName: string;
  /** The poe.ninja details slug (e.g. "house-of-mirrors") */
  detailsId: string;
  /** The game type this data belongs to */
  game: GameType;
  /** The league name (e.g. "Settlers") */
  league: string;
  /** Current price in divine orbs, or null if unavailable */
  currentDivineRate: number | null;
  /** Current trade volume, or null if unavailable */
  currentVolume: number | null;
  /** Chaos-to-divine exchange ratio (e.g. 0.001235 means ~810 chaos per divine) */
  chaosToDivineRatio: number;
  /** Daily price history data points */
  priceHistory: CardPriceHistoryPointDTO[];
  /** Price change summary over 24h/7d/30d lookback periods */
  priceChanges: PriceChangeSummary;
  /** ISO timestamp of when poe.ninja data was originally fetched */
  fetchedAt: string;
  /** Whether this response came from the local SQLite cache */
  isFromCache: boolean;
}

// ─── Personal Analytics DTOs ─────────────────────────────────────────────────

/**
 * A prepared data point in the user's personal drop timeline.
 * Real points are daily aggregates across all deck-opening sessions; synthetic
 * gap and boundary points are inserted by the main process for charting.
 */
export interface CardDropTimelinePointDTO {
  /** Unix timestamp in ms - the X axis value */
  time: number;
  /** ISO date string of the first session represented by this point */
  sessionStartedAt: string;
  /** Session ID, or comma-joined IDs when multiple sessions are aggregated */
  sessionId: string;
  /** Number of this card dropped in this daily bucket */
  count: number;
  /** Cumulative total drops up to and including this point */
  cumulativeCount: number;
  /** Total decks opened in this daily bucket */
  totalDecksOpened: number;
  /** League name this session belongs to */
  league: string;
  /** Number of sessions aggregated into this point */
  sessionCount: number;
  /** If true this is a synthetic gap marker, not a real session bucket */
  isGap?: boolean;
  /** If true this is an invisible boundary sentinel at the timeline edge */
  isBoundary?: boolean;
}

/**
 * League date range info for timeline charting.
 * Used to draw league start/end markers and position the brush.
 */
export interface LeagueDateRangeDTO {
  /** League display name (e.g. "Keepers") */
  name: string;
  /** ISO date string of league start, or null if unknown */
  startDate: string | null;
  /** ISO date string of league end, or null if still active / unknown */
  endDate: string | null;
}

// ─── Related Cards DTOs ──────────────────────────────────────────────────────

/**
 * A related card that shares a similar reward with the current card.
 * Used in the "Related Cards" section of the card details page.
 */
export interface RelatedCardDTO {
  /** The card's display name */
  name: string;
  /** The card's art image URL */
  artSrc: string;
  /** Stack size required to complete the set */
  stackSize: number;
  /** Card description text */
  description: string;
  /** Reward HTML (cleaned of wiki markup) for card preview */
  rewardHtml: string;
  /** Flavour HTML for card preview */
  flavourHtml: string;
  /** Rarity tier (0–4) — poe.ninja price-derived */
  rarity: Rarity;
  /** Loot filter rarity (1–4), or null */
  filterRarity: KnownRarity | null;
  /** Prohibited Library weight-based rarity (0–4), or null if no PL data */
  prohibitedLibraryRarity: Rarity | null;
  /** Whether the card is boss-exclusive */
  fromBoss: boolean;
  /**
   * The relationship type between this card and the current card:
   * - "similar": shares the same terminal reward item (e.g. both reward Headhunter)
   * - "chain": part of the same divination card reward chain
   *   (e.g. The Patient → The Nurse → The Doctor for Headhunter)
   */
  relationship: "similar" | "chain";
}

/**
 * Pre-split related cards result returned by the service.
 *
 * Cards are already deduplicated, categorized, and sorted by rarity
 * (rarest first, then alphabetically) — the renderer can consume
 * these arrays directly without further processing.
 */
export interface RelatedCardsResultDTO {
  /** Cards that share the same terminal reward item (e.g. all cards that reward Headhunter). */
  similarCards: RelatedCardDTO[];
  /** Cards that are part of the same divination card reward chain (e.g. The Patient → The Nurse → The Doctor). */
  chainCards: RelatedCardDTO[];
}

/**
 * Unified response for the card details page initialization.
 *
 * Returned by the `card-details:resolve-card-by-slug` IPC channel.
 * Bundles the resolved card, personal analytics, and related cards
 * into a single response so the renderer only needs one IPC round-trip
 * to populate the page (instead of three separate calls).
 */
export interface CardDetailsInitDTO {
  /** The resolved divination card (matched by URL slug). */
  card: DivinationCardDTO;
  /** Personal analytics (drops, timeline, PL data, etc.), or null if unavailable. */
  personalAnalytics: CardPersonalAnalyticsDTO | null;
  /** Pre-split related cards (similar + chain), or null if lookup failed. */
  relatedCards: RelatedCardsResultDTO | null;
}

/**
 * Personal analytics response for a divination card.
 * Returned by the `card-details:get-personal-analytics` IPC channel.
 */
export interface CardPersonalAnalyticsDTO {
  /** The card's display name */
  cardName: string;
  /** Total drops across all sessions (SUM of count) */
  totalLifetimeDrops: number;
  /** ISO timestamp of when this card was first seen (MIN first_seen_at) */
  firstDiscoveredAt: string | null;
  /** ISO timestamp of when this card was last seen (MAX last_seen_at) */
  lastSeenAt: string | null;
  /** Number of distinct sessions containing this card */
  sessionCount: number;
  /** Average drops per session (totalLifetimeDrops / sessionCount) */
  averageDropsPerSession: number;
  /** Whether this card only drops from bosses (from divination_card_availability.from_boss) */
  fromBoss: boolean;
  /** Per-card weight from divination_card_availability (null if no data) */
  weight: number | null;
  /** Total decks opened across ALL user sessions (for luck calculation) */
  totalDecksOpenedAllSessions: number;
  /** Per-session drop timeline for charting */
  dropTimeline: CardDropTimelinePointDTO[];
  /** League date ranges the user has data in (for timeline markers) */
  leagueDateRanges: LeagueDateRangeDTO[];
  /**
   * ISO timestamp of the user's very first session start date (across ALL
   * sessions, not just this card). Used as the timeline X-axis start bound
   * so the chart shows the full history of user activity.
   */
  firstSessionStartedAt: string | null;
  /**
   * ISO timestamp for the timeline X-axis end bound.
   * This is the end date of the most recent league the user has data in,
   * or an inferred end bound when end metadata is missing:
   * min("now", start + 4 months).
   * Falls back to "now" if no league info is available.
   */
  timelineEndDate: string;
}
