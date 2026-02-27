import type { StateCreator } from "zustand";

import type {
  ProfitForecastDataDTO,
  ProfitForecastWeightDTO,
} from "~/main/modules/profit-forecast/ProfitForecast.dto";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Hard minimum for the sliding exchange rate model.
 * Never observed below ~70 in practice — 60 provides a safe floor.
 */
export const RATE_FLOOR = 60;

// ── Row Shape ──────────────────────────────────────────────────────────────────

export interface CardForecastRow {
  // Static (set on fetchData)
  cardName: string;
  weight: number;
  fromBoss: boolean;
  probability: number; // weight / totalWeight
  chaosValue: number; // 0 when price unavailable
  divineValue: number; // 0 when price unavailable
  evContribution: number; // probability × chaosValue
  hasPrice: boolean; // false when card has PL weight but no snapshot price

  // Dynamic (recomputed via recomputeRows on batch/stepDrop/subBatchSize change)
  chanceInBatch: number; // 1 − (1 − probability)^selectedBatch  (0–1)
  expectedDecks: number; // 1 / probability
  costToPull: number; // total_chaos_cost(expectedDecks) via sliding model
  plA: number; // chaosValue − costToPull
  plB: number; // (expectedDecks × evPerDeck) − costToPull
}

// ── Batch Literal ──────────────────────────────────────────────────────────────

export type BatchSize = 1000 | 10000 | 100000 | 1000000;

// ── Slice Interface ────────────────────────────────────────────────────────────

export interface ProfitForecastSlice {
  profitForecast: {
    // ── Raw data (set by fetchData) ───────────────────────────────────────
    rows: CardForecastRow[];
    totalWeight: number;
    evPerDeck: number; // Σ P(card) × price — all matched cards
    snapshotFetchedAt: string | null;
    chaosToDivineRatio: number;
    stackedDeckChaosCost: number;
    baseRate: number; // floor(chaosToDivineRatio / stackedDeckChaosCost)

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

/**
 * Build static row fields from the DTO data. Dynamic (batch-dependent) fields
 * are initialised to 0 and filled in by `recomputeRows`.
 */
export function buildRows(
  weights: ProfitForecastWeightDTO[],
  cardPrices: Record<
    string,
    { chaosValue: number; divineValue: number; source: "exchange" | "stash" }
  > | null,
  totalWeight: number,
): CardForecastRow[] {
  return weights.map((w) => {
    const price = cardPrices?.[w.cardName] ?? null;
    const probability = totalWeight > 0 ? w.weight / totalWeight : 0;
    const chaosValue = price?.chaosValue ?? 0;
    const divineValue = price?.divineValue ?? 0;
    const hasPrice = price !== null;

    return {
      cardName: w.cardName,
      weight: w.weight,
      fromBoss: w.fromBoss,
      probability,
      chaosValue,
      divineValue,
      hasPrice,
      evContribution: hasPrice ? probability * chaosValue : 0,

      // Dynamic — filled by recomputeRows
      chanceInBatch: 0,
      expectedDecks: 0,
      costToPull: 0,
      plA: 0,
      plB: 0,
    };
  });
}

/**
 * Compute EV per deck = Σ P(card) × chaosValue for all cards that have a price.
 */
export function computeEvPerDeck(rows: CardForecastRow[]): number {
  return rows.reduce(
    (sum, row) => (row.hasPrice ? sum + row.evContribution : sum),
    0,
  );
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

        const totalWeight = result.weights.reduce(
          (sum, w) => sum + w.weight,
          0,
        );

        // Build static row data
        const rows = buildRows(
          result.weights,
          result.snapshot?.cardPrices ?? null,
          totalWeight,
        );

        const evPerDeck = computeEvPerDeck(rows);

        const chaosToDivineRatio = result.snapshot?.chaosToDivineRatio ?? 0;
        const stackedDeckChaosCost = result.snapshot?.stackedDeckChaosCost ?? 0;

        // Compute base rate, clamped to RATE_FLOOR
        let baseRate = 0;
        if (stackedDeckChaosCost > 0 && chaosToDivineRatio > 0) {
          baseRate = Math.max(
            RATE_FLOOR,
            Math.floor(chaosToDivineRatio / stackedDeckChaosCost),
          );
        }

        // Fill in dynamic fields before storing
        const { selectedBatch, stepDrop, subBatchSize } = get().profitForecast;

        recomputeDynamicFields(
          rows,
          selectedBatch,
          baseRate,
          stepDrop,
          subBatchSize,
          chaosToDivineRatio,
          evPerDeck,
        );

        // Sort by evContribution descending
        rows.sort((a, b) => b.evContribution - a.evContribution);

        set(
          ({ profitForecast }) => {
            profitForecast.rows = rows;
            profitForecast.totalWeight = totalWeight;
            profitForecast.evPerDeck = evPerDeck;
            profitForecast.snapshotFetchedAt =
              result.snapshot?.fetchedAt ?? null;
            profitForecast.chaosToDivineRatio = chaosToDivineRatio;
            profitForecast.stackedDeckChaosCost = stackedDeckChaosCost;
            profitForecast.baseRate = baseRate;
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
        (row) => !row.hasPrice || row.chaosValue >= minPriceThreshold,
      );
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
