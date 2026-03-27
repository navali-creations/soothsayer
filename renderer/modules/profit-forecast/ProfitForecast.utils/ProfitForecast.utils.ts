import { computeTotalChaosCost } from "~/main/modules/profit-forecast/ProfitForecast.compute";

// ── Number Formatting Helpers ──────────────────────────────────────────────────

/**
 * Format a chaos value for display.
 *
 * - Values ≥ 1,000,000 are shown as e.g. "3.45M c"
 * - Values ≥ 1,000 are shown with commas e.g. "34,500 c"
 * - Otherwise shown with fixed decimals e.g. "3.45 c"
 *
 * @param value   The chaos value to format
 * @param decimals Number of decimal places (default 0 for large values, 2 for small)
 */
export function formatChaos(value: number, decimals?: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const d = decimals ?? 2;
    return `${(value / 1_000_000).toFixed(d)}M c`;
  }

  if (abs >= 1_000) {
    const d = decimals ?? 0;
    const formatted =
      d > 0
        ? value.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : Math.round(value).toLocaleString("en-US");
    return `${formatted} c`;
  }

  const d = decimals ?? 2;
  return `${value.toFixed(d)} c`;
}

/**
 * Convert a chaos value to divine equivalent and format it.
 *
 * - Values ≥ 1,000 divine are shown as e.g. "1.2k d"
 * - Otherwise shown with fixed decimals e.g. "6.9 d"
 *
 * @param chaosValue The value in chaos orbs
 * @param ratio      The chaos-to-divine ratio (chaos per divine)
 */
export function formatDivine(chaosValue: number, ratio: number): string {
  if (ratio <= 0) return "— d";

  const divineValue = chaosValue / ratio;
  const abs = Math.abs(divineValue);

  if (abs >= 1_000) {
    return `${(divineValue / 1_000).toFixed(1)}k d`;
  }

  if (abs >= 100) {
    return `${divineValue.toFixed(1)} d`;
  }

  return `${divineValue.toFixed(2)} d`;
}

/**
 * Format a probability (0–1) as a percentage string.
 *
 * - 0.00312 → "0.3120%"
 * - 0.632   → "63.20%"
 *
 * @param value    The probability value (0–1)
 * @param decimals Number of decimal places (default 2)
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a P&L value with sign prefix and comma separators.
 *
 * - Positive: "+2,273 c"
 * - Negative: "−450 c"  (uses proper minus sign U+2212)
 * - Zero:     "+0 c"
 *
 * @param value The P&L value in chaos
 */
export function formatPnL(value: number): string {
  const abs = Math.abs(value);
  let formatted: string;

  if (abs >= 1_000_000) {
    formatted = `${(abs / 1_000_000).toFixed(2)}M`;
  } else {
    formatted = Math.round(abs).toLocaleString("en-US");
  }

  if (value < 0) {
    return `\u2212${formatted} c`;
  }

  return `+${formatted} c`;
}

/**
 * Format a P&L value in divines with sign prefix.
 *
 * Converts a chaos P&L value to divines and formats with +/− sign.
 * - Positive: "+5.67 d"
 * - Negative: "−2.34 d"
 * - Zero:     "+0.00 d"
 *
 * @param chaosValue The P&L value in chaos
 * @param ratio      The chaos-to-divine ratio (chaos per divine)
 */
export function formatPnLDivine(chaosValue: number, ratio: number): string {
  if (ratio <= 0) return "— d";

  const divineValue = chaosValue / ratio;
  const abs = Math.abs(divineValue);
  let formatted: string;

  if (abs >= 1_000) {
    formatted = `${(abs / 1_000).toFixed(1)}k`;
  } else if (abs >= 100) {
    formatted = abs.toFixed(1);
  } else {
    formatted = abs.toFixed(2);
  }

  if (divineValue < 0) {
    return `\u2212${formatted} d`;
  }

  return `+${formatted} d`;
}

// ── Computation Helpers ───────────────────────────────────────────────────────

/**
 * Compute batch-level P&L (revenue, cost, net).
 *
 * - revenue = evPerDeck × batchSize
 * - cost    = total chaos cost for the batch (delegated to slice helper)
 * - netPnL  = revenue − cost
 *
 * @param evPerDeck          Expected chaos value earned per single deck
 * @param batchSize           Number of decks in the batch
 * @param baseRate            Starting divine-per-deck rate
 * @param stepDrop            Rate decrease after each sub-batch
 * @param subBatchSize        Number of decks per sub-batch before the rate drops
 * @param chaosToDivineRatio  Chaos orbs per divine orb
 */
export function computeBatchEv(
  evPerDeck: number,
  batchSize: number,
  baseRate: number,
  stepDrop: number,
  subBatchSize: number,
  chaosToDivineRatio: number,
): { revenue: number; cost: number; netPnL: number } {
  const revenue = evPerDeck * batchSize;
  const cost = computeTotalChaosCost(
    batchSize,
    baseRate,
    stepDrop,
    subBatchSize,
    chaosToDivineRatio,
  );
  const netPnL = revenue - cost;
  return { revenue, cost, netPnL };
}

/**
 * Compute estimated / optimistic revenue for a batch using
 * sigma-based (Poisson-style) scaling around the estimated value.
 *
 * Uses the pre-calibrated `evContribution` from each row (which already
 * includes the EV_CALIBRATION_FACTOR applied server-side) so the confidence
 * interval is consistent with the "Estimated Return" stat.
 *
 * For each non-excluded, priced card:
 *
 * - **estimated**: `evContribution × batchSize` — calibrated EV.
 * - **optimistic**: adds +0.25σ upside per card (Poisson-style),
 *   where σ ≈ √(probability × batchSize).
 *
 * @param rows      Card forecast rows (must include evContribution)
 * @param batchSize Number of decks in the batch
 */
export function computeConfidenceInterval(
  rows: Array<{
    probability: number;
    chaosValue: number;
    evContribution: number;
    hasPrice: boolean;
    excludeFromEv: boolean;
  }>,
  batchSize: number,
): { estimated: number; optimistic: number } {
  let estimated = 0;
  let optimistic = 0;

  for (const row of rows) {
    if (!row.hasPrice || row.excludeFromEv) continue;

    // Use pre-calibrated evContribution (= probability × chaosValue × calibrationFactor)
    // evContribution is per-deck, so multiply by batchSize
    const calibratedRevenue = row.evContribution * batchSize;
    estimated += calibratedRevenue;

    // Sigma based on the raw expected count (probability × batchSize)
    const expectedCount = row.probability * batchSize;
    const sigma = Math.sqrt(expectedCount);

    // Optimistic: add 0.25σ × chaosValue upside, also scaled by calibration
    // We derive the calibration ratio from evContribution to stay consistent
    const calibrationRatio =
      row.chaosValue > 0
        ? row.evContribution / (row.probability * row.chaosValue)
        : 1;
    optimistic +=
      calibratedRevenue + 0.25 * sigma * row.chaosValue * calibrationRatio;
  }

  return { estimated, optimistic };
}

/**
 * Build the data series for a breakeven / P&L chart.
 *
 * For each batch size the function returns the net P&L (revenue − cost) at the
 * estimated and optimistic revenue levels.
 *
 * @param rows                Card forecast rows
 * @param batchSizes          Array of deck-counts to evaluate
 * @param baseRate            Starting divine-per-deck rate
 * @param stepDrop            Rate decrease after each sub-batch
 * @param subBatchSize        Number of decks per sub-batch before the rate drops
 * @param chaosToDivineRatio  Chaos orbs per divine orb
 */
export function computePnLCurve(
  rows: Array<{
    probability: number;
    chaosValue: number;
    evContribution: number;
    hasPrice: boolean;
    excludeFromEv: boolean;
  }>,
  batchSizes: number[],
  baseRate: number,
  stepDrop: number,
  subBatchSize: number,
  chaosToDivineRatio: number,
): Array<{
  deckCount: number;
  estimated: number;
  optimistic: number;
}> {
  return batchSizes.map((batchSize) => {
    const { estimated, optimistic } = computeConfidenceInterval(
      rows,
      batchSize,
    );
    const cost = computeTotalChaosCost(
      batchSize,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
    );
    return {
      deckCount: batchSize,
      estimated: estimated - cost,
      optimistic: optimistic - cost,
    };
  });
}

/**
 * Probability of seeing at least one copy of a card in `batchSize` decks.
 *
 * Uses the complement rule: P(≥1) = 1 − (1 − p)^N.
 *
 * @param probability Per-deck drop probability
 * @param batchSize   Number of decks
 */
export function computeCardCertainty(
  probability: number,
  batchSize: number,
): number {
  if (probability <= 0) return 0;
  if (probability >= 1) return 1;
  return 1 - (1 - probability) ** batchSize;
}
