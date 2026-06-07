/**
 * Pure computation functions for the Profit Forecast module.
 *
 * These functions are used by the main-process IPC handler to perform heavy
 * cost-model and P&L calculations off the renderer thread. They are stateless
 * and side-effect-free, making them easy to test and cache.
 *
 * The renderer previously ran these inline — now they live here so both the
 * main-process handler and unit tests can import them directly.
 */

import type {
  ConfidenceIntervalDTO,
  PnLCurvePointDTO,
  ProfitForecastComputeRequest,
  ProfitForecastComputeResponse,
} from "./ProfitForecast.dto";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Hard minimum for the sliding exchange rate model.
 * At league start/end, rates can dip well below typical mid-league values,
 * so 20 provides a safe floor without clipping legitimate low-rate scenarios.
 */
export const RATE_FLOOR = 20;

/**
 * Hard upper bound for renderer-provided custom spend.
 * This is intentionally generous for very large batches while preventing
 * unbounded finite values from entering IPC responses and UI math.
 */
export const MAX_CUSTOM_TOTAL_COST_CHAOS = 1_000_000_000;

/**
 * Batch sizes used for the P&L curve chart.
 */
const PNL_CURVE_BATCH_SIZES = [
  200, 400, 600, 800, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000,
  50000, 75000, 100000, 250000, 500000, 1000000,
] as const;

/**
 * Maximum number of loop iterations in cost computations.
 * Acts as a safety net against infinite loops from degenerate inputs.
 */
const MAX_COST_ITERATIONS = 10_000;

// ── Effective Cost Params ──────────────────────────────────────────────────────

/**
 * When a custom base rate or fixed spend is active the user has locked in a
 * fixed price, so the sliding-rate model must NOT degrade the rate across
 * sub-batches. We achieve this by setting stepDrop=0 (no degradation) and
 * subBatchSize=selectedBatch (single batch — no splitting).
 */
export function getEffectiveCostParams(
  customBaseRate: number | null,
  stepDrop: number,
  subBatchSize: number,
  selectedBatch: number,
  customTotalCost: number | null = null,
): { effectiveStepDrop: number; effectiveSubBatchSize: number } {
  if (
    customBaseRate !== null ||
    (customTotalCost !== null && customTotalCost > 0)
  ) {
    return { effectiveStepDrop: 0, effectiveSubBatchSize: selectedBatch };
  }
  return { effectiveStepDrop: stepDrop, effectiveSubBatchSize: subBatchSize };
}

/**
 * Resolve the effective decks-per-divine rate used by the cost model.
 *
 * User-entered spend is an aggregate batch cost. It does not rewrite the
 * base-rate model used for row-level costs.
 */
export function getEffectiveCostRate(
  baseRate: number,
  customBaseRate: number | null,
): number {
  return customBaseRate ?? baseRate;
}

export function getCostFromTotalCostBasis(
  batchSize: number,
  selectedBatch: number,
  totalCost: number | null,
): number | null {
  if (
    totalCost === null ||
    totalCost <= 0 ||
    selectedBatch <= 0 ||
    batchSize <= 0
  ) {
    return null;
  }

  return (totalCost / selectedBatch) * batchSize;
}

// ── Rate Model ─────────────────────────────────────────────────────────────────

/**
 * Compute the sliding exchange rate for a given sub-batch index.
 */
export function computeRateForBatch(
  baseRate: number,
  batchIndex: number,
  stepDrop: number,
): number {
  const dynamicFloor = Math.ceil(baseRate * 0.8);
  return Math.max(RATE_FLOOR, dynamicFloor, baseRate - batchIndex * stepDrop);
}

/**
 * Compute the total chaos cost of opening `deckCount` decks using the sliding
 * exchange-rate model.
 */
export function computeTotalChaosCost(
  deckCount: number,
  baseRate: number,
  stepDrop: number,
  subBatchSize: number,
  chaosToDivineRatio: number,
): number {
  if (
    deckCount <= 0 ||
    chaosToDivineRatio <= 0 ||
    baseRate <= 0 ||
    subBatchSize <= 0
  ) {
    return 0;
  }

  let totalCost = 0;
  let remaining = deckCount;
  let batchIndex = 0;

  while (remaining > 0 && batchIndex < MAX_COST_ITERATIONS) {
    const rate = computeRateForBatch(baseRate, batchIndex, stepDrop);
    const actualSubBatchSize = Math.min(remaining, subBatchSize);
    const costPerDeck = chaosToDivineRatio / rate;
    totalCost += actualSubBatchSize * costPerDeck;
    remaining -= actualSubBatchSize;
    batchIndex++;
  }

  return totalCost;
}

// ── Confidence Interval ────────────────────────────────────────────────────────

/**
 * Compute estimated / optimistic revenue for a batch using
 * sigma-based (Poisson-style) scaling around the estimated value.
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
): ConfidenceIntervalDTO {
  let estimated = 0;
  let optimistic = 0;

  for (const row of rows) {
    if (!row.hasPrice || row.excludeFromEv) continue;

    const calibratedRevenue = row.evContribution * batchSize;
    estimated += calibratedRevenue;

    const expectedCount = row.probability * batchSize;
    const sigma = Math.sqrt(expectedCount);

    const calibrationRatio =
      row.chaosValue > 0
        ? row.evContribution / (row.probability * row.chaosValue)
        : 1;
    optimistic +=
      calibratedRevenue + 0.25 * sigma * row.chaosValue * calibrationRatio;
  }

  return { estimated, optimistic };
}

// ── PnL Curve ──────────────────────────────────────────────────────────────────

/**
 * Build the data series for a breakeven / P&L chart.
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
  fixedSpendBasis?: {
    selectedBatch: number;
    totalCost: number | null;
  },
): PnLCurvePointDTO[] {
  return batchSizes.map((batchSize) => {
    const { estimated, optimistic } = computeConfidenceInterval(
      rows,
      batchSize,
    );
    const fixedSpendCost = fixedSpendBasis
      ? getCostFromTotalCostBasis(
          batchSize,
          fixedSpendBasis.selectedBatch,
          fixedSpendBasis.totalCost,
        )
      : null;
    const cost =
      fixedSpendCost ??
      computeTotalChaosCost(
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

// ── Dynamic Row Fields ─────────────────────────────────────────────────────────

/**
 * Compute dynamic fields for each row. Returns a map of cardName → computed fields.
 */
export function computeRowDynamicFields(
  rows: Array<{
    cardName: string;
    probability: number;
    chaosValue: number;
    hasPrice: boolean;
    excludeFromEv: boolean;
  }>,
  selectedBatch: number,
  baseRate: number,
  stepDrop: number,
  subBatchSize: number,
  chaosToDivineRatio: number,
  evPerDeck: number,
): Record<
  string,
  {
    chanceInBatch: number;
    expectedDecks: number;
    costToPull: number;
    plA: number;
    plB: number;
  }
> {
  const result: Record<
    string,
    {
      chanceInBatch: number;
      expectedDecks: number;
      costToPull: number;
      plA: number;
      plB: number;
    }
  > = {};

  for (const row of rows) {
    if (row.probability <= 0) {
      result[row.cardName] = {
        chanceInBatch: 0,
        expectedDecks: 0,
        costToPull: 0,
        plA: 0,
        plB: 0,
      };
      continue;
    }

    const chanceInBatch = 1 - (1 - row.probability) ** selectedBatch;
    const expectedDecks = 1 / row.probability;
    const costToPull = computeTotalChaosCost(
      expectedDecks,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
    );

    let plA = 0;
    let plB = 0;
    if (row.hasPrice) {
      plA = row.chaosValue - costToPull;
      plB = expectedDecks * evPerDeck - costToPull;
    }

    result[row.cardName] = {
      chanceInBatch,
      expectedDecks,
      costToPull,
      plA,
      plB,
    };
  }

  return result;
}

// ── Full Compute Orchestrator ──────────────────────────────────────────────────

/**
 * Perform the full suite of profit forecast computations.
 *
 * This is the main entry point called by the IPC handler. It takes the
 * request payload and returns all computed results in a single response.
 */
export function computeAll(
  request: ProfitForecastComputeRequest,
): ProfitForecastComputeResponse {
  const {
    rows: rawRows,
    userOverrides,
    selectedBatch,
    baseRate,
    stepDrop,
    subBatchSize,
    customBaseRate,
    customTotalCost,
    chaosToDivineRatio,
    evPerDeck,
  } = request;

  // Apply effective cost params (custom overrides disable sliding model)
  const effectiveRate = getEffectiveCostRate(baseRate, customBaseRate);
  const { effectiveStepDrop, effectiveSubBatchSize } = getEffectiveCostParams(
    customBaseRate,
    stepDrop,
    subBatchSize,
    selectedBatch,
    customTotalCost,
  );

  // Build rows with exclusion flags applied from user overrides
  const rows = rawRows.map((row) => {
    const userOverride = userOverrides[row.cardName] ?? false;
    const auto = row.isAnomalous;
    let excludeFromEv: boolean;
    if (!row.hasPrice) {
      excludeFromEv = true;
    } else if (userOverride) {
      excludeFromEv = !auto;
    } else {
      excludeFromEv = auto;
    }
    return { ...row, excludeFromEv };
  });

  // 1. Compute dynamic fields per row
  const rowFields = computeRowDynamicFields(
    rows,
    selectedBatch,
    effectiveRate,
    effectiveStepDrop,
    effectiveSubBatchSize,
    chaosToDivineRatio,
    evPerDeck,
  );

  // 2. Compute total cost. Custom spend is independent from base rate and
  // only overrides the aggregate selected-batch cost.
  const totalCost =
    customTotalCost !== null && customTotalCost > 0
      ? customTotalCost
      : computeTotalChaosCost(
          selectedBatch,
          effectiveRate,
          effectiveStepDrop,
          effectiveSubBatchSize,
          chaosToDivineRatio,
        );

  // 3. Compute PnL curve
  const capped = PNL_CURVE_BATCH_SIZES.filter((s) => s <= selectedBatch);
  const sizes =
    capped.length === 0 || capped[capped.length - 1] !== selectedBatch
      ? [...capped, selectedBatch]
      : [...capped];

  const pnlCurve = computePnLCurve(
    rows,
    sizes,
    effectiveRate,
    effectiveStepDrop,
    effectiveSubBatchSize,
    chaosToDivineRatio,
    { selectedBatch, totalCost: customTotalCost },
  );

  // 4. Compute confidence interval
  const confidenceInterval = computeConfidenceInterval(rows, selectedBatch);

  // 5. Compute batch PnL
  const revenue = evPerDeck * selectedBatch;
  const cost = totalCost;
  const netPnL = revenue - cost;

  const batchPnL = {
    revenue,
    cost,
    netPnL,
    confidence: {
      estimated: confidenceInterval.estimated - cost,
      optimistic: confidenceInterval.optimistic - cost,
    },
  };

  return {
    rowFields,
    totalCost,
    pnlCurve,
    confidenceInterval,
    batchPnL,
  };
}
