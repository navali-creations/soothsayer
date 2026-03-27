/**
 * Data Transfer Objects for the Profit Forecast module.
 *
 * The Profit Forecast page combines Prohibited Library card weights with
 * poe.ninja snapshot prices to project returns from bulk stacked deck openings.
 *
 * The main process now pre-computes rows, EV, and base rate server-side,
 * returning a ready-to-render payload via IPC. Internal types used during
 * price merging and weight loading are kept here but are NOT re-exported
 * from the barrel `index.ts`.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Internal types (used by ProfitForecastService during data assembly)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single card's price data from the most recent snapshot.
 * Exchange prices are preferred; stash fills gaps for cards missing from exchange.
 *
 * @internal Used by the service during price merging — not exported to the renderer.
 */
export interface ProfitForecastCardPriceDTO {
  chaosValue: number;
  divineValue: number;
  source: "exchange" | "stash";
  /** poe.ninja confidence tier: 1 = high, 2 = medium, 3 = low */
  confidence: 1 | 2 | 3;
  /** true when the price appears statistically inflated relative to similar-weight cards */
  isAnomalous: boolean;
}

/**
 * Snapshot subset relevant to profit forecasting.
 * Contains exchange rates, stacked deck cost, and merged card prices.
 *
 * @internal Used by the service to structure snapshot data before extracting fields — not exported to the renderer.
 */
export interface ProfitForecastSnapshotDTO {
  id: string;
  fetchedAt: string;
  chaosToDivineRatio: number;
  stackedDeckChaosCost: number;
  /** Bulk exchange rate (decks/divine) from poe.ninja maxVolumeRate. null for older snapshots. */
  stackedDeckMaxVolumeRate: number | null;
  cardPrices: Record<string, ProfitForecastCardPriceDTO>;
}

/**
 * A single card's weight entry from the Prohibited Library dataset.
 * Non-boss cards with zero league weight are assigned the minimum observed
 * weight (floor) so they appear as ultra-rare rather than being excluded.
 *
 * @internal Used by the service during weight loading — not exported to the renderer.
 */
export interface ProfitForecastWeightDTO {
  cardName: string;
  weight: number;
  fromBoss: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public types (exported via index.ts for the renderer)
// ═══════════════════════════════════════════════════════════════════════════

/** A single pre-computed row returned by the main process. */
export interface ProfitForecastRowDTO {
  cardName: string;
  weight: number;
  fromBoss: boolean;
  probability: number; // weight / totalWeight
  chaosValue: number; // 0 when no price
  divineValue: number; // 0 when no price
  evContribution: number; // probability × chaosValue (0 when no price)
  hasPrice: boolean;
  confidence: 1 | 2 | 3 | null; // null when no price
  isAnomalous: boolean;
  excludeFromEv: boolean; // auto-detection only (no userOverride — that's renderer-side)
}

/** How the base rate was determined. */
export type BaseRateSource = "maxVolumeRate" | "derived" | "none";

/** Combined payload returned by `profit-forecast:get-data`. */
export interface ProfitForecastDataDTO {
  /** Pre-built rows sorted by evContribution desc. Empty when no weights. */
  rows: ProfitForecastRowDTO[];
  totalWeight: number;
  /** EV per deck — excludes anomalous and low-confidence cards. */
  evPerDeck: number;
  /** Snapshot metadata — null when no snapshot exists. */
  snapshotFetchedAt: string | null;
  chaosToDivineRatio: number;
  stackedDeckChaosCost: number;
  baseRate: number;
  baseRateSource: BaseRateSource;
}

// ═══════════════════════════════════════════════════════════════════════════
// Compute IPC types (used by the profit-forecast:compute channel)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Request payload for the `profit-forecast:compute` IPC channel.
 *
 * The renderer sends pre-built rows (with static fields) plus all cost-model
 * parameters, and the main process returns fully recomputed dynamic fields
 * along with aggregate stats (PnL curve, confidence interval, etc.).
 */
export interface ProfitForecastComputeRequest {
  /** Card rows with at least the static fields populated. */
  rows: ProfitForecastRowDTO[];
  /** Per-row user overrides: cardName → userOverride boolean. */
  userOverrides: Record<string, boolean>;
  /** Number of decks in the batch. */
  selectedBatch: number;
  /** Base exchange rate (decks per divine). */
  baseRate: number;
  /** Rate decrease per sub-batch. */
  stepDrop: number;
  /** Number of decks per sub-batch. */
  subBatchSize: number;
  /** User-specified base rate override (null = use server rate). */
  customBaseRate: number | null;
  /** Chaos orbs per divine orb. */
  chaosToDivineRatio: number;
  /** Expected value per deck. */
  evPerDeck: number;
}

/**
 * Dynamic fields computed for each card row.
 * Keyed by cardName for efficient lookup on the renderer side.
 */
export interface ComputedRowFields {
  chanceInBatch: number;
  expectedDecks: number;
  costToPull: number;
  plA: number;
  plB: number;
}

/** A single data point on the P&L curve. */
export interface PnLCurvePointDTO {
  deckCount: number;
  estimated: number;
  optimistic: number;
}

/** Confidence interval (estimated / optimistic raw revenue). */
export interface ConfidenceIntervalDTO {
  estimated: number;
  optimistic: number;
}

/**
 * Response payload from the `profit-forecast:compute` IPC channel.
 *
 * Contains all computed dynamic fields plus aggregate stats so the renderer
 * can simply apply the results without any heavy math.
 */
export interface ProfitForecastComputeResponse {
  /** Dynamic fields keyed by card name. */
  rowFields: Record<string, ComputedRowFields>;
  /** Total chaos cost for the selected batch. */
  totalCost: number;
  /** PnL curve data points for the breakeven chart. */
  pnlCurve: PnLCurvePointDTO[];
  /** Confidence interval for the selected batch. */
  confidenceInterval: ConfidenceIntervalDTO;
  /** Batch-level P&L breakdown. */
  batchPnL: {
    revenue: number;
    cost: number;
    netPnL: number;
    confidence: ConfidenceIntervalDTO;
  };
}
