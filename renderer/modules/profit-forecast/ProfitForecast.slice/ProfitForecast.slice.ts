import type { StateCreator } from "zustand";

import type {
  BaseRateSource,
  ProfitForecastComputeRequest,
  ProfitForecastComputeResponse,
  ProfitForecastDataDTO,
  ProfitForecastRowDTO,
} from "~/main/modules/profit-forecast/ProfitForecast.dto";
import type { BoundStore } from "~/renderer/store/store.types";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Hard minimum for the sliding exchange rate model.
 * At league start/end, rates can dip well below typical mid-league values,
 * so 20 provides a safe floor without clipping legitimate low-rate scenarios.
 */
export const RATE_FLOOR = 20;

// ── Row Shape ──────────────────────────────────────────────────────────────────

/**
 * Renderer-side row that extends the pre-computed DTO row with:
 * - `userOverride`: user-controlled toggle to flip the auto-detection decision
 * - Dynamic fields recomputed on batch/slider changes
 */
export interface CardForecastRow extends ProfitForecastRowDTO {
  // Renderer-only static
  userOverride: boolean; // true when user has flipped the auto-detection decision for this card
  belowMinPrice: boolean; // true when card is surfaced only because it matched a search query

  // Dynamic (recomputed via IPC compute on batch/stepDrop/subBatchSize change)
  chanceInBatch: number; // 1 − (1 − probability)^selectedBatch  (0–1)
  expectedDecks: number; // 1 / probability
  costToPull: number; // total_chaos_cost(expectedDecks) via sliding model
  plA: number; // chaosValue − costToPull
  plB: number; // (expectedDecks × evPerDeck) − costToPull
}

// ── Batch Literal ──────────────────────────────────────────────────────────────

export type BatchSize = 1000 | 10000 | 100000 | 1000000;

export type ForecastView = "chart" | "table";

export interface ConfidenceInterval {
  estimated: number;
  optimistic: number;
}

export interface PnLCurvePoint {
  deckCount: number;
  estimated: number;
  optimistic: number;
}

export const PNL_CURVE_BATCH_SIZES = [
  200, 400, 600, 800, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000,
  50000, 75000, 100000, 250000, 500000, 1000000,
] as const;

// Re-export so existing imports still work
export type { BaseRateSource } from "~/main/modules/profit-forecast/ProfitForecast.dto";

// ── Slice Interface ────────────────────────────────────────────────────────────

export interface ProfitForecastSlice {
  profitForecast: {
    // ── Raw data (set by fetchData) ───────────────────────────────────────
    rows: CardForecastRow[];
    totalWeight: number;
    evPerDeck: number; // Σ P(card) × price — excluding anomalous & low-confidence cards
    snapshotFetchedAt: string | null;
    chaosToDivineRatio: number;
    stackedDeckChaosCost: number;
    baseRate: number; // floor(chaosToDivineRatio / stackedDeckChaosCost) or maxVolumeRate
    baseRateSource: BaseRateSource; // "maxVolumeRate" | "derived" | "none"

    // ── Loading ───────────────────────────────────────────────────────────
    isLoading: boolean;
    isComputing: boolean; // true during debounced recomputeRows
    error: string | null;

    // ── UI controls ───────────────────────────────────────────────────────
    selectedBatch: BatchSize;
    forecastView: ForecastView;
    minPriceThreshold: number; // chaos — display filter, default 5
    stepDrop: number; // default 2, range 1–5
    subBatchSize: number; // default 5000, range 1000–10000
    customBaseRate: number | null; // user-specified base rate override (decks/div), null = use server rate

    // ── Cached compute results (from main-process IPC) ────────────────────
    cachedTotalCost: number;
    cachedPnLCurve: PnLCurvePoint[];
    cachedConfidenceInterval: ConfidenceInterval;
    cachedBatchPnL: {
      revenue: number;
      cost: number;
      netPnL: number;
      confidence: { estimated: number; optimistic: number };
    };

    // ── Actions ───────────────────────────────────────────────────────────
    fetchData: (game: string, league: string) => Promise<void>;
    recomputeRows: () => void; // calls main-process IPC compute
    toggleCardExclusion: (cardName: string) => void; // toggle user override and recompute EV
    setSelectedBatch: (batch: BatchSize) => void;
    setForecastView: (view: ForecastView) => void;
    setMinPriceThreshold: (value: number) => void;
    setStepDrop: (value: number) => void;
    setSubBatchSize: (value: number) => void;
    setCustomBaseRate: (value: number | null) => void;
    setIsComputing: (value: boolean) => void;

    // ── Getters ───────────────────────────────────────────────────────────
    getFilteredRows: () => CardForecastRow[]; // applies minPriceThreshold
    getEffectiveBaseRate: () => number;
    getConfidenceInterval: () => ConfidenceInterval;
    getPnLCurve: () => PnLCurvePoint[];
    getBatchPnL: () => {
      revenue: number;
      cost: number;
      netPnL: number;
      confidence: { estimated: number; optimistic: number };
    };
    getTotalCost: () => number; // total chaos cost for selectedBatch
    getTotalRevenue: () => number; // evPerDeck × selectedBatch
    getNetPnL: () => number; // revenue − cost
    getBreakEvenRate: () => number; // chaosToDivineRatio / evPerDeck
    getAvgCostPerDeck: () => number; // for selectedBatch with sliding model
    getRateForBatch: (batchIndex: number) => number;
    getExcludedCount: () => {
      anomalous: number;
      lowConfidence: number;
      userOverridden: number;
      total: number;
    };
    hasData: () => boolean;
  };
}

// ── Helpers (pure, exported for testing) ───────────────────────────────────────

/**
 * When a custom base rate is active the user has locked in a fixed price,
 * so the sliding-rate model must NOT degrade the rate across sub-batches.
 * We achieve this by setting stepDrop=0 (no degradation) and
 * subBatchSize=selectedBatch (single batch — no splitting).
 */
export function getEffectiveCostParams(
  customBaseRate: number | null,
  stepDrop: number,
  subBatchSize: number,
  selectedBatch: number,
): { effectiveStepDrop: number; effectiveSubBatchSize: number } {
  if (customBaseRate !== null) {
    return { effectiveStepDrop: 0, effectiveSubBatchSize: selectedBatch };
  }
  return { effectiveStepDrop: stepDrop, effectiveSubBatchSize: subBatchSize };
}

/**
 * Compute the sliding exchange rate for a given sub-batch index.
 */
export function computeRateForBatch(
  baseRate: number,
  batchIndex: number,
  stepDrop: number,
): number {
  // Use the higher of the absolute floor (RATE_FLOOR) and a dynamic floor
  // at 80% of the base rate.  This prevents the cost model from degrading
  // the rate unrealistically for large batches — in practice, buyers spread
  // purchases across time / sellers so the effective rate never drops as
  // far as the linear model would predict.
  const dynamicFloor = Math.ceil(baseRate * 0.8);
  return Math.max(RATE_FLOOR, dynamicFloor, baseRate - batchIndex * stepDrop);
}

/**
 * Compute the total chaos cost of opening `deckCount` decks using the sliding
 * exchange-rate model.
 *
 * Iterates sub-batches of `subBatchSize`, applying `getRateForBatch` for each,
 * computing the chaos cost as `actual_sub_batch_size × (chaosToDivineRatio / rate)`.
 */
export function computeTotalChaosCost(
  deckCount: number,
  baseRate: number,
  stepDrop: number,
  subBatchSize: number,
  chaosToDivineRatio: number,
): number {
  if (deckCount <= 0 || chaosToDivineRatio <= 0 || baseRate <= 0) {
    return 0;
  }

  let totalCost = 0;
  let remaining = deckCount;
  let batchIndex = 0;

  while (remaining > 0) {
    const rate = computeRateForBatch(baseRate, batchIndex, stepDrop);
    const actualSubBatchSize = Math.min(remaining, subBatchSize);
    const costPerDeck = chaosToDivineRatio / rate;
    totalCost += actualSubBatchSize * costPerDeck;
    remaining -= actualSubBatchSize;
    batchIndex++;
  }

  return totalCost;
}

// ── Exclusion Logic ────────────────────────────────────────────────────────────

/**
 * Whether auto-detection (anomalous price or low-confidence) would exclude
 * this card from EV.  Pure function — does NOT consider userOverride.
 */
export function isAutoExcluded(row: {
  hasPrice: boolean;
  isAnomalous: boolean;
  confidence: 1 | 2 | 3 | null;
}): boolean {
  return !row.hasPrice || row.isAnomalous;
}

/**
 * Derive the final `excludeFromEv` flag taking the user override into account.
 *
 * - When `userOverride` is false the auto-detection result is used as-is.
 * - When `userOverride` is true the auto-detection result is *inverted*:
 *   • An auto-excluded card (anomalous / low-confidence) becomes **included**.
 *   • A normal card becomes **excluded**.
 *
 * Cards without a price (`hasPrice === false`) are always excluded regardless
 * of the override — there is no value to include in EV.
 */
export function computeExcludeFromEv(row: {
  hasPrice: boolean;
  isAnomalous: boolean;
  confidence: 1 | 2 | 3 | null;
  userOverride: boolean;
}): boolean {
  if (!row.hasPrice) return true;

  const auto = row.isAnomalous;
  if (row.userOverride) return !auto; // flip the auto decision
  return auto;
}

/**
 * Compute EV per deck = Σ P(card) × chaosValue for all cards that
 * have a price and are NOT excluded.
 */
export function computeEvPerDeck(rows: CardForecastRow[]): number {
  return rows.reduce(
    (sum, row) =>
      row.hasPrice && !row.excludeFromEv ? sum + row.evContribution : sum,
    0,
  );
}

/**
 * Augment a pre-computed DTO row with renderer-only fields.
 * Sets `userOverride` to false and dynamic fields to 0.
 */
function augmentRow(dto: ProfitForecastRowDTO): CardForecastRow {
  return {
    ...dto,
    userOverride: false,
    belowMinPrice: false,
    chanceInBatch: 0,
    expectedDecks: 0,
    costToPull: 0,
    plA: 0,
    plB: 0,
  };
}

/**
 * Recompute the dynamic (batch-dependent) fields on every row in place.
 * Returns the mutated array for convenience.
 *
 * This is still available for the initial fetchData (where we want to fill
 * rows synchronously before the first IPC compute round-trip). For subsequent
 * recomputes, the IPC path is preferred.
 */
export function recomputeDynamicFields(
  rows: CardForecastRow[],
  selectedBatch: number,
  baseRate: number,
  stepDrop: number,
  subBatchSize: number,
  chaosToDivineRatio: number,
  evPerDeck: number,
): CardForecastRow[] {
  for (const row of rows) {
    if (row.probability <= 0) {
      row.chanceInBatch = 0;
      row.expectedDecks = 0;
      row.costToPull = 0;
      row.plA = 0;
      row.plB = 0;
      continue;
    }

    row.chanceInBatch = 1 - (1 - row.probability) ** selectedBatch;
    row.expectedDecks = 1 / row.probability;

    row.costToPull = computeTotalChaosCost(
      row.expectedDecks,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
    );

    if (row.hasPrice) {
      row.plA = row.chaosValue - row.costToPull;
      row.plB = row.expectedDecks * evPerDeck - row.costToPull;
    } else {
      row.plA = 0;
      row.plB = 0;
    }
  }

  return rows;
}

// ── IPC Compute Helper ─────────────────────────────────────────────────────────

/**
 * Build a `ProfitForecastComputeRequest` from the current slice state.
 */
function buildComputeRequest(
  pf: ProfitForecastSlice["profitForecast"],
): ProfitForecastComputeRequest {
  const userOverrides: Record<string, boolean> = {};
  const rows: ProfitForecastRowDTO[] = [];

  for (const row of pf.rows) {
    if (row.userOverride) {
      userOverrides[row.cardName] = true;
    }
    // Strip renderer-only fields to get back to the DTO shape
    rows.push({
      cardName: row.cardName,
      weight: row.weight,
      fromBoss: row.fromBoss,
      probability: row.probability,
      chaosValue: row.chaosValue,
      divineValue: row.divineValue,
      evContribution: row.evContribution,
      hasPrice: row.hasPrice,
      confidence: row.confidence,
      isAnomalous: row.isAnomalous,
      excludeFromEv: row.excludeFromEv,
    });
  }

  return {
    rows,
    userOverrides,
    selectedBatch: pf.selectedBatch,
    baseRate: pf.baseRate,
    stepDrop: pf.stepDrop,
    subBatchSize: pf.subBatchSize,
    customBaseRate: pf.customBaseRate,
    chaosToDivineRatio: pf.chaosToDivineRatio,
    evPerDeck: pf.evPerDeck,
  };
}

/**
 * Apply an IPC compute response to the current rows, returning updated rows
 * and the cached aggregate values.
 */
function applyComputeResponse(
  currentRows: CardForecastRow[],
  response: ProfitForecastComputeResponse,
): CardForecastRow[] {
  return currentRows.map((r) => {
    const fields = response.rowFields[r.cardName];
    if (!fields) return r;
    return {
      ...r,
      chanceInBatch: fields.chanceInBatch,
      expectedDecks: fields.expectedDecks,
      costToPull: fields.costToPull,
      plA: fields.plA,
      plB: fields.plB,
    };
  });
}

// ── Default cached values ──────────────────────────────────────────────────────

const DEFAULT_CONFIDENCE_INTERVAL: ConfidenceInterval = {
  estimated: 0,
  optimistic: 0,
};

const DEFAULT_BATCH_PNL = {
  revenue: 0,
  cost: 0,
  netPnL: 0,
  confidence: { estimated: 0, optimistic: 0 },
};

// ── Slice Creator ──────────────────────────────────────────────────────────────

export const createProfitForecastSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  ProfitForecastSlice
> = (set, get) => ({
  profitForecast: {
    // ── Initial state ─────────────────────────────────────────────────────
    rows: [],
    totalWeight: 0,
    evPerDeck: 0,
    snapshotFetchedAt: null,
    chaosToDivineRatio: 0,
    stackedDeckChaosCost: 0,
    baseRate: 0,
    baseRateSource: "none" as BaseRateSource,

    isLoading: false,
    isComputing: false,
    error: null,

    selectedBatch: 10000,
    forecastView: "chart" as ForecastView,
    minPriceThreshold: 5,
    stepDrop: 2,
    subBatchSize: 5000,
    customBaseRate: null,

    // ── Cached compute results ────────────────────────────────────────────
    cachedTotalCost: 0,
    cachedPnLCurve: [],
    cachedConfidenceInterval: { ...DEFAULT_CONFIDENCE_INTERVAL },
    cachedBatchPnL: { ...DEFAULT_BATCH_PNL },

    // ── Actions ───────────────────────────────────────────────────────────

    fetchData: async (game: string, league: string) => {
      set(
        ({ profitForecast }) => {
          profitForecast.isLoading = true;
          profitForecast.error = null;
        },
        false,
        "profitForecastSlice/fetchData/start",
      );

      try {
        const result: ProfitForecastDataDTO =
          await window.electron.profitForecast.getData(
            game as "poe1" | "poe2",
            league,
          );

        // Augment pre-computed rows with renderer-only fields
        const rows = result.rows.map(augmentRow);

        // Fill in dynamic fields synchronously for immediate rendering
        const { selectedBatch, stepDrop, subBatchSize, customBaseRate } =
          get().profitForecast;
        const effectiveRate = customBaseRate ?? result.baseRate;
        const { effectiveStepDrop, effectiveSubBatchSize } =
          getEffectiveCostParams(
            customBaseRate,
            stepDrop,
            subBatchSize,
            selectedBatch,
          );

        recomputeDynamicFields(
          rows,
          selectedBatch,
          effectiveRate,
          effectiveStepDrop,
          effectiveSubBatchSize,
          result.chaosToDivineRatio,
          result.evPerDeck,
        );

        set(
          ({ profitForecast }) => {
            profitForecast.rows = rows;
            profitForecast.totalWeight = result.totalWeight;
            profitForecast.evPerDeck = result.evPerDeck;
            profitForecast.snapshotFetchedAt = result.snapshotFetchedAt;
            profitForecast.chaosToDivineRatio = result.chaosToDivineRatio;
            profitForecast.stackedDeckChaosCost = result.stackedDeckChaosCost;
            profitForecast.baseRate = result.baseRate;
            profitForecast.baseRateSource = result.baseRateSource;
            profitForecast.isLoading = false;
            profitForecast.isComputing = false;
          },
          false,
          "profitForecastSlice/fetchData/success",
        );

        // Fire off IPC compute to populate cached aggregates
        // (non-blocking — the UI will use inline values until this resolves)
        if (rows.length > 0) {
          const pf = get().profitForecast;
          const request = buildComputeRequest(pf);

          try {
            const response =
              await window.electron.profitForecast.compute(request);

            // Apply row fields from the compute response and cache aggregates
            const computedRows = applyComputeResponse(
              get().profitForecast.rows,
              response,
            );

            set(
              ({ profitForecast }) => {
                profitForecast.rows = computedRows;
                profitForecast.cachedTotalCost = response.totalCost;
                profitForecast.cachedPnLCurve = response.pnlCurve;
                profitForecast.cachedConfidenceInterval =
                  response.confidenceInterval;
                profitForecast.cachedBatchPnL = response.batchPnL;
              },
              false,
              "profitForecastSlice/fetchData/computeSuccess",
            );
          } catch {
            // Compute failed — keep the inline-computed values
          }
        }
      } catch (error) {
        console.error("[ProfitForecastSlice] Failed to fetch data:", error);
        set(
          ({ profitForecast }) => {
            profitForecast.isLoading = false;
            profitForecast.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch profit forecast data";
          },
          false,
          "profitForecastSlice/fetchData/error",
        );
      }
    },

    recomputeRows: () => {
      const pf = get().profitForecast;
      const {
        rows,
        baseRate,
        customBaseRate,
        stepDrop,
        subBatchSize,
        chaosToDivineRatio,
        evPerDeck,
        selectedBatch,
      } = pf;

      if (rows.length === 0) return;

      const effectiveRate = customBaseRate ?? baseRate;
      const { effectiveStepDrop, effectiveSubBatchSize } =
        getEffectiveCostParams(
          customBaseRate,
          stepDrop,
          subBatchSize,
          selectedBatch,
        );

      // Deep-copy rows so Immer sees a fresh array — fill dynamic fields inline
      const updatedRows: CardForecastRow[] = rows.map((r) => ({ ...r }));

      recomputeDynamicFields(
        updatedRows,
        selectedBatch,
        effectiveRate,
        effectiveStepDrop,
        effectiveSubBatchSize,
        chaosToDivineRatio,
        evPerDeck,
      );

      set(
        ({ profitForecast }) => {
          profitForecast.rows = updatedRows;
          profitForecast.isComputing = false;
        },
        false,
        "profitForecastSlice/recomputeRows",
      );

      // Fire off IPC compute asynchronously to update cached aggregates
      const request = buildComputeRequest(get().profitForecast);
      window.electron.profitForecast
        .compute(request)
        .then((response: ProfitForecastComputeResponse) => {
          const latestRows = get().profitForecast.rows;
          const computedRows = applyComputeResponse(latestRows, response);

          set(
            ({ profitForecast }) => {
              profitForecast.rows = computedRows;
              profitForecast.cachedTotalCost = response.totalCost;
              profitForecast.cachedPnLCurve = response.pnlCurve;
              profitForecast.cachedConfidenceInterval =
                response.confidenceInterval;
              profitForecast.cachedBatchPnL = response.batchPnL;
            },
            false,
            "profitForecastSlice/recomputeRows/computeSuccess",
          );
        })
        .catch(() => {
          // Compute failed — keep inline-computed values
        });
    },

    toggleCardExclusion: (cardName: string) => {
      const {
        rows,
        baseRate,
        customBaseRate,
        stepDrop,
        subBatchSize,
        chaosToDivineRatio,
        selectedBatch,
      } = get().profitForecast;

      if (rows.length === 0) return;

      // Deep-copy rows and toggle the userOverride flag for the target card
      const updatedRows: CardForecastRow[] = rows.map((r) => {
        const copy = { ...r };
        if (copy.cardName === cardName) {
          copy.userOverride = !copy.userOverride;
          copy.excludeFromEv = computeExcludeFromEv(copy);
        }
        return copy;
      });

      // Recompute EV since exclusion set changed
      const newEvPerDeck = computeEvPerDeck(updatedRows);
      const effectiveRate = customBaseRate ?? baseRate;
      const { effectiveStepDrop, effectiveSubBatchSize } =
        getEffectiveCostParams(
          customBaseRate,
          stepDrop,
          subBatchSize,
          selectedBatch,
        );

      recomputeDynamicFields(
        updatedRows,
        selectedBatch,
        effectiveRate,
        effectiveStepDrop,
        effectiveSubBatchSize,
        chaosToDivineRatio,
        newEvPerDeck,
      );

      set(
        ({ profitForecast }) => {
          profitForecast.rows = updatedRows;
          profitForecast.evPerDeck = newEvPerDeck;
        },
        false,
        "profitForecastSlice/toggleCardExclusion",
      );

      // Fire off IPC compute asynchronously to update cached aggregates
      const request = buildComputeRequest(get().profitForecast);
      window.electron.profitForecast
        .compute(request)
        .then((response: ProfitForecastComputeResponse) => {
          const latestRows = get().profitForecast.rows;
          const computedRows = applyComputeResponse(latestRows, response);

          set(
            ({ profitForecast }) => {
              profitForecast.rows = computedRows;
              profitForecast.cachedTotalCost = response.totalCost;
              profitForecast.cachedPnLCurve = response.pnlCurve;
              profitForecast.cachedConfidenceInterval =
                response.confidenceInterval;
              profitForecast.cachedBatchPnL = response.batchPnL;
            },
            false,
            "profitForecastSlice/toggleCardExclusion/computeSuccess",
          );
        })
        .catch(() => {
          // Compute failed — keep inline-computed values
        });
    },

    setSelectedBatch: (batch: BatchSize) => {
      set(
        ({ profitForecast }) => {
          profitForecast.selectedBatch = batch;
        },
        false,
        "profitForecastSlice/setSelectedBatch",
      );
    },

    setForecastView: (view: ForecastView) => {
      set(
        ({ profitForecast }) => {
          profitForecast.forecastView = view;
        },
        false,
        "profitForecastSlice/setForecastView",
      );
    },

    setMinPriceThreshold: (value: number) => {
      set(
        ({ profitForecast }) => {
          profitForecast.minPriceThreshold = Math.max(
            0,
            Math.min(100, Math.round(value)),
          );
        },
        false,
        "profitForecastSlice/setMinPriceThreshold",
      );
    },

    setStepDrop: (value: number) => {
      set(
        ({ profitForecast }) => {
          profitForecast.stepDrop = Math.max(1, Math.min(5, Math.round(value)));
        },
        false,
        "profitForecastSlice/setStepDrop",
      );
    },

    setSubBatchSize: (value: number) => {
      set(
        ({ profitForecast }) => {
          profitForecast.subBatchSize = Math.max(
            1000,
            Math.min(10_000, Math.round(value)),
          );
        },
        false,
        "profitForecastSlice/setSubBatchSize",
      );
    },

    setCustomBaseRate: (value: number | null) => {
      set(
        ({ profitForecast }) => {
          profitForecast.customBaseRate =
            value === null ? null : Math.max(1, Math.min(1000, Math.floor(value)));
        },
        false,
        "profitForecastSlice/setCustomBaseRate",
      );
    },

    setIsComputing: (value: boolean) => {
      set(
        ({ profitForecast }) => {
          profitForecast.isComputing = value;
        },
        false,
        "profitForecastSlice/setIsComputing",
      );
    },

    // ── Getters ───────────────────────────────────────────────────────────

    getFilteredRows: () => {
      const { rows, minPriceThreshold } = get().profitForecast;
      return rows.filter(
        (row) => row.hasPrice && row.chaosValue >= minPriceThreshold,
      );
    },

    getExcludedCount: () => {
      const { rows } = get().profitForecast;
      let anomalous = 0;
      let lowConfidence = 0;
      let userOverridden = 0;
      for (const row of rows) {
        if (!row.hasPrice) continue;
        if (row.userOverride) {
          // User flipped the auto decision — count separately
          userOverridden++;
        } else if (row.isAnomalous) {
          anomalous++;
        } else if (row.confidence === 3) {
          lowConfidence++;
        }
      }
      return {
        anomalous,
        lowConfidence,
        userOverridden,
        total: anomalous + lowConfidence + userOverridden,
      };
    },

    getTotalCost: () => {
      const {
        selectedBatch,
        baseRate,
        customBaseRate,
        stepDrop,
        subBatchSize,
        chaosToDivineRatio,
      } = get().profitForecast;

      // Always compute inline — single-batch cost is cheap (one loop).
      // The expensive operations (PnL curve, per-row costs) are offloaded
      // to the main process via IPC and cached in state.
      const { effectiveStepDrop, effectiveSubBatchSize } =
        getEffectiveCostParams(
          customBaseRate,
          stepDrop,
          subBatchSize,
          selectedBatch,
        );

      return computeTotalChaosCost(
        selectedBatch,
        customBaseRate ?? baseRate,
        effectiveStepDrop,
        effectiveSubBatchSize,
        chaosToDivineRatio,
      );
    },

    getTotalRevenue: () => {
      const { evPerDeck, selectedBatch } = get().profitForecast;
      return evPerDeck * selectedBatch;
    },

    getNetPnL: () => {
      const { profitForecast } = get();
      return profitForecast.getTotalRevenue() - profitForecast.getTotalCost();
    },

    getBreakEvenRate: () => {
      const { chaosToDivineRatio, evPerDeck } = get().profitForecast;
      if (evPerDeck <= 0) return 0;
      return chaosToDivineRatio / evPerDeck;
    },

    getEffectiveBaseRate: () => {
      const { baseRate, customBaseRate } = get().profitForecast;
      return customBaseRate ?? baseRate;
    },

    getAvgCostPerDeck: () => {
      const { profitForecast } = get();
      const { selectedBatch } = profitForecast;
      if (selectedBatch <= 0) return 0;
      return profitForecast.getTotalCost() / selectedBatch;
    },

    getRateForBatch: (batchIndex: number) => {
      const {
        baseRate,
        customBaseRate,
        stepDrop,
        subBatchSize,
        selectedBatch,
      } = get().profitForecast;
      const { effectiveStepDrop } = getEffectiveCostParams(
        customBaseRate,
        stepDrop,
        subBatchSize,
        selectedBatch,
      );
      return computeRateForBatch(
        customBaseRate ?? baseRate,
        batchIndex,
        effectiveStepDrop,
      );
    },

    getConfidenceInterval: () => {
      const { cachedConfidenceInterval } = get().profitForecast;
      return cachedConfidenceInterval;
    },

    getPnLCurve: () => {
      const { cachedPnLCurve } = get().profitForecast;
      return cachedPnLCurve;
    },

    getBatchPnL: () => {
      const { cachedBatchPnL } = get().profitForecast;
      return cachedBatchPnL;
    },

    hasData: () => {
      const { rows, totalWeight } = get().profitForecast;
      return rows.length > 0 && totalWeight > 0;
    },
  },
});
