import type { StateCreator } from "zustand";

import type {
  BaseRateSource,
  ProfitForecastDataDTO,
  ProfitForecastRowDTO,
} from "~/main/modules/profit-forecast/ProfitForecast.dto";

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

  // Dynamic (recomputed via recomputeRows on batch/stepDrop/subBatchSize change)
  chanceInBatch: number; // 1 − (1 − probability)^selectedBatch  (0–1)
  expectedDecks: number; // 1 / probability
  costToPull: number; // total_chaos_cost(expectedDecks) via sliding model
  plA: number; // chaosValue − costToPull
  plB: number; // (expectedDecks × evPerDeck) − costToPull
}

// ── Batch Literal ──────────────────────────────────────────────────────────────

export type BatchSize = 1000 | 10000 | 100000 | 1000000;

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
    minPriceThreshold: number; // chaos — display filter, default 5
    stepDrop: number; // default 2, range 1–5
    subBatchSize: number; // default 5000, range 1000–10000

    // ── Actions ───────────────────────────────────────────────────────────
    fetchData: (game: string, league: string) => Promise<void>;
    recomputeRows: () => void; // pure math, no IPC
    toggleCardExclusion: (cardName: string) => void; // toggle user override and recompute EV
    setSelectedBatch: (batch: BatchSize) => void;
    setMinPriceThreshold: (value: number) => void;
    setStepDrop: (value: number) => void;
    setSubBatchSize: (value: number) => void;
    setIsComputing: (value: boolean) => void;

    // ── Getters ───────────────────────────────────────────────────────────
    getFilteredRows: () => CardForecastRow[]; // applies minPriceThreshold
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
 * Compute the sliding exchange rate for a given sub-batch index.
 */
export function computeRateForBatch(
  baseRate: number,
  batchIndex: number,
  stepDrop: number,
): number {
  return Math.max(RATE_FLOOR, baseRate - batchIndex * stepDrop);
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
  return !row.hasPrice || row.isAnomalous || row.confidence === 3;
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

  const auto = row.isAnomalous || row.confidence === 3;
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

// ── Slice Creator ──────────────────────────────────────────────────────────────

export const createProfitForecastSlice: StateCreator<
  ProfitForecastSlice,
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
    minPriceThreshold: 5,
    stepDrop: 2,
    subBatchSize: 5000,

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

        // Fill in dynamic fields before storing
        const { selectedBatch, stepDrop, subBatchSize } = get().profitForecast;

        recomputeDynamicFields(
          rows,
          selectedBatch,
          result.baseRate,
          stepDrop,
          subBatchSize,
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
      const {
        rows,
        baseRate,
        stepDrop,
        subBatchSize,
        chaosToDivineRatio,
        evPerDeck,
        selectedBatch,
      } = get().profitForecast;

      if (rows.length === 0) return;

      // Deep-copy rows so Immer sees a fresh array
      const updatedRows: CardForecastRow[] = rows.map((r) => ({ ...r }));

      recomputeDynamicFields(
        updatedRows,
        selectedBatch,
        baseRate,
        stepDrop,
        subBatchSize,
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
    },

    toggleCardExclusion: (cardName: string) => {
      const {
        rows,
        baseRate,
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

      recomputeDynamicFields(
        updatedRows,
        selectedBatch,
        baseRate,
        stepDrop,
        subBatchSize,
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

    setMinPriceThreshold: (value: number) => {
      set(
        ({ profitForecast }) => {
          profitForecast.minPriceThreshold = value;
        },
        false,
        "profitForecastSlice/setMinPriceThreshold",
      );
    },

    setStepDrop: (value: number) => {
      set(
        ({ profitForecast }) => {
          profitForecast.stepDrop = value;
        },
        false,
        "profitForecastSlice/setStepDrop",
      );
    },

    setSubBatchSize: (value: number) => {
      set(
        ({ profitForecast }) => {
          profitForecast.subBatchSize = value;
        },
        false,
        "profitForecastSlice/setSubBatchSize",
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
        stepDrop,
        subBatchSize,
        chaosToDivineRatio,
      } = get().profitForecast;

      return computeTotalChaosCost(
        selectedBatch,
        baseRate,
        stepDrop,
        subBatchSize,
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

    getAvgCostPerDeck: () => {
      const { profitForecast } = get();
      const { selectedBatch } = profitForecast;
      if (selectedBatch <= 0) return 0;
      return profitForecast.getTotalCost() / selectedBatch;
    },

    getRateForBatch: (batchIndex: number) => {
      const { baseRate, stepDrop } = get().profitForecast;
      return computeRateForBatch(baseRate, batchIndex, stepDrop);
    },

    hasData: () => {
      const { rows, totalWeight } = get().profitForecast;
      return rows.length > 0 && totalWeight > 0;
    },
  },
});
