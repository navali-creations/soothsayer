/**
 * Data Transfer Objects for the Profit Forecast module.
 *
 * The Profit Forecast page combines Prohibited Library card weights with
 * poe.ninja snapshot prices to project returns from bulk stacked deck openings.
 * This DTO bundles both data sources into a single IPC payload so the renderer
 * can compute all derived values (EV, sliding cost model, P&L) client-side.
 */

/**
 * A single card's price data from the most recent snapshot.
 * Exchange prices are preferred; stash fills gaps for cards missing from exchange.
 */
export interface ProfitForecastCardPriceDTO {
  chaosValue: number;
  divineValue: number;
  source: "exchange" | "stash";
  /** poe.ninja confidence tier: 1 = high, 2 = medium, 3 = low */
  confidence: 1 | 2 | 3;
}

/**
 * Snapshot subset relevant to profit forecasting.
 * Contains exchange rates, stacked deck cost, and merged card prices.
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
 */
export interface ProfitForecastWeightDTO {
  cardName: string;
  weight: number;
  fromBoss: boolean;
}

/**
 * Combined payload returned by the `profit-forecast:get-data` IPC channel.
 *
 * - `snapshot` is `null` when no snapshot exists in the user's local SQLite
 *   for this league. The UI will prompt the user to click "Refresh poe.ninja".
 * - `weights` is always returned (even without a snapshot) so the UI can show
 *   the card list with PL weights even when prices are unavailable.
 */
export interface ProfitForecastDataDTO {
  snapshot: ProfitForecastSnapshotDTO | null;
  weights: ProfitForecastWeightDTO[];
}
