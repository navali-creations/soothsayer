import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProfitForecastCardPriceDTO,
  ProfitForecastDataDTO,
  ProfitForecastWeightDTO,
} from "~/main/modules/profit-forecast/ProfitForecast.dto";

import {
  buildRows,
  type CardForecastRow,
  computeEvPerDeck,
  computeRateForBatch,
  computeTotalChaosCost,
  RATE_FLOOR,
  recomputeDynamicFields,
} from "../ProfitForecast.slice";

// ── Test Fixtures ──────────────────────────────────────────────────────────────

function makeWeights(
  overrides: Partial<ProfitForecastWeightDTO>[] = [],
): ProfitForecastWeightDTO[] {
  const defaults: ProfitForecastWeightDTO[] = [
    { cardName: "The Doctor", weight: 1, fromBoss: false },
    { cardName: "The Nurse", weight: 5, fromBoss: false },
    { cardName: "Rain of Chaos", weight: 500, fromBoss: false },
    { cardName: "The Wretched", weight: 200, fromBoss: true },
  ];
  if (overrides.length > 0) {
    return overrides.map((o, i) => ({
      ...defaults[i % defaults.length],
      ...o,
    }));
  }
  return defaults;
}

function makePrices(
  cards: string[] = [
    "The Doctor",
    "The Nurse",
    "Rain of Chaos",
    "The Wretched",
  ],
): Record<string, ProfitForecastCardPriceDTO> {
  const map: Record<string, ProfitForecastCardPriceDTO> = {};
  const values: Record<string, ProfitForecastCardPriceDTO> = {
    "The Doctor": { chaosValue: 50000, divineValue: 250, source: "exchange" },
    "The Nurse": { chaosValue: 8000, divineValue: 40, source: "exchange" },
    "Rain of Chaos": { chaosValue: 0.5, divineValue: 0.0025, source: "stash" },
    "The Wretched": { chaosValue: 1, divineValue: 0.005, source: "exchange" },
  };
  for (const card of cards) {
    if (values[card]) {
      map[card] = values[card];
    }
  }
  return map;
}

function makeDTO(
  partial?: Partial<ProfitForecastDataDTO>,
): ProfitForecastDataDTO {
  const weights = makeWeights();
  return {
    snapshot: {
      id: "snap-1",
      fetchedAt: "2025-01-15T12:00:00Z",
      chaosToDivineRatio: 200,
      stackedDeckChaosCost: 2.22,
      cardPrices: makePrices(),
    },
    weights,
    ...partial,
  };
}

// ── Pure Helper Tests ──────────────────────────────────────────────────────────

describe("computeRateForBatch", () => {
  it("returns baseRate for batch index 0", () => {
    expect(computeRateForBatch(90, 0, 2)).toBe(90);
  });

  it("applies stepDrop per batch index", () => {
    expect(computeRateForBatch(90, 1, 2)).toBe(88);
    expect(computeRateForBatch(90, 5, 2)).toBe(80);
  });

  it("clamps to RATE_FLOOR when rate would go below", () => {
    // 90 - 20 * 2 = 50, below RATE_FLOOR of 60
    expect(computeRateForBatch(90, 20, 2)).toBe(RATE_FLOOR);
  });

  it("returns RATE_FLOOR when baseRate equals RATE_FLOOR", () => {
    expect(computeRateForBatch(RATE_FLOOR, 0, 2)).toBe(RATE_FLOOR);
    expect(computeRateForBatch(RATE_FLOOR, 5, 2)).toBe(RATE_FLOOR);
  });

  it("returns RATE_FLOOR when baseRate is below RATE_FLOOR", () => {
    expect(computeRateForBatch(50, 0, 2)).toBe(RATE_FLOOR);
  });

  it("handles stepDrop of 0 (no degradation)", () => {
    expect(computeRateForBatch(90, 100, 0)).toBe(90);
  });

  it("handles stepDrop of 1", () => {
    expect(computeRateForBatch(90, 3, 1)).toBe(87);
  });

  it("handles stepDrop of 5", () => {
    expect(computeRateForBatch(90, 3, 5)).toBe(75);
  });

  it("handles large batch indices that push well below floor", () => {
    expect(computeRateForBatch(90, 1000, 5)).toBe(RATE_FLOOR);
  });
});

describe("computeTotalChaosCost", () => {
  it("returns 0 for 0 decks", () => {
    expect(computeTotalChaosCost(0, 90, 2, 5000, 200)).toBe(0);
  });

  it("returns 0 for negative decks", () => {
    expect(computeTotalChaosCost(-10, 90, 2, 5000, 200)).toBe(0);
  });

  it("returns 0 when chaosToDivineRatio is 0", () => {
    expect(computeTotalChaosCost(100, 90, 2, 5000, 0)).toBe(0);
  });

  it("returns 0 when baseRate is 0", () => {
    expect(computeTotalChaosCost(100, 0, 2, 5000, 200)).toBe(0);
  });

  it("computes cost for single sub-batch (decks < subBatchSize)", () => {
    // 1000 decks, rate = 90, costPerDeck = 200/90 ≈ 2.2222
    const cost = computeTotalChaosCost(1000, 90, 2, 5000, 200);
    const expected = 1000 * (200 / 90);
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("computes cost for exactly one full sub-batch", () => {
    const cost = computeTotalChaosCost(5000, 90, 2, 5000, 200);
    const expected = 5000 * (200 / 90);
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("computes cost spanning two sub-batches", () => {
    // Batch 0: 5000 decks at rate 90, Batch 1: 5000 decks at rate 88
    const cost = computeTotalChaosCost(10000, 90, 2, 5000, 200);
    const expected = 5000 * (200 / 90) + 5000 * (200 / 88);
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("handles partial last sub-batch", () => {
    // Batch 0: 5000 decks at rate 90, Batch 1: 2000 decks at rate 88
    const cost = computeTotalChaosCost(7000, 90, 2, 5000, 200);
    const expected = 5000 * (200 / 90) + 2000 * (200 / 88);
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("applies rate floor correctly for many sub-batches", () => {
    // With baseRate=90, stepDrop=2, the rate hits RATE_FLOOR (60) at batch index 15
    // (90 - 15*2 = 60). After that, all batches should be at 60.
    const deckCount = 5000 * 20; // 20 sub-batches
    const cost = computeTotalChaosCost(deckCount, 90, 2, 5000, 200);

    // Calculate expected: batches 0-14 degrade, batches 15-19 at RATE_FLOOR
    let expected = 0;
    for (let i = 0; i < 20; i++) {
      const rate = Math.max(RATE_FLOOR, 90 - i * 2);
      expected += 5000 * (200 / rate);
    }
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("handles subBatchSize of 1 (most granular)", () => {
    const cost = computeTotalChaosCost(3, 90, 2, 1, 200);
    const expected =
      1 * (200 / 90) + // batch 0: rate 90
      1 * (200 / 88) + // batch 1: rate 88
      1 * (200 / 86); //  batch 2: rate 86
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("handles fractional deck counts (from expectedDecks)", () => {
    // expectedDecks might be 706.5 for a card with probability 1/706.5
    const cost = computeTotalChaosCost(706.5, 90, 2, 5000, 200);
    // All within first sub-batch
    const expected = 706.5 * (200 / 90);
    expect(cost).toBeCloseTo(expected, 4);
  });

  it("cost always increases with more decks", () => {
    const cost1 = computeTotalChaosCost(1000, 90, 2, 5000, 200);
    const cost2 = computeTotalChaosCost(5000, 90, 2, 5000, 200);
    const cost3 = computeTotalChaosCost(10000, 90, 2, 5000, 200);
    expect(cost2).toBeGreaterThan(cost1);
    expect(cost3).toBeGreaterThan(cost2);
  });

  it("higher stepDrop produces higher total cost", () => {
    const costLow = computeTotalChaosCost(20000, 90, 1, 5000, 200);
    const costHigh = computeTotalChaosCost(20000, 90, 5, 5000, 200);
    expect(costHigh).toBeGreaterThan(costLow);
  });
});

describe("buildRows", () => {
  it("builds rows from weights and prices", () => {
    const weights = makeWeights();
    const prices = makePrices();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, prices, totalWeight);

    expect(rows).toHaveLength(4);
    expect(rows[0].cardName).toBe("The Doctor");
    expect(rows[0].weight).toBe(1);
    expect(rows[0].fromBoss).toBe(false);
    expect(rows[0].chaosValue).toBe(50000);
    expect(rows[0].divineValue).toBe(250);
    expect(rows[0].hasPrice).toBe(true);
    expect(rows[0].probability).toBeCloseTo(1 / totalWeight, 8);
    expect(rows[0].evContribution).toBeCloseTo((1 / totalWeight) * 50000, 4);
  });

  it("sets hasPrice false and chaosValue 0 for cards without prices", () => {
    const weights = makeWeights();
    // Only provide prices for first two cards
    const prices = makePrices(["The Doctor", "The Nurse"]);
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, prices, totalWeight);

    const rainOfChaos = rows.find((r) => r.cardName === "Rain of Chaos")!;
    expect(rainOfChaos.hasPrice).toBe(false);
    expect(rainOfChaos.chaosValue).toBe(0);
    expect(rainOfChaos.divineValue).toBe(0);
    expect(rainOfChaos.evContribution).toBe(0);
    // But weight and probability are still set
    expect(rainOfChaos.weight).toBe(500);
    expect(rainOfChaos.probability).toBeCloseTo(500 / totalWeight, 8);
  });

  it("handles null cardPrices (no snapshot)", () => {
    const weights = makeWeights();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, null, totalWeight);

    for (const row of rows) {
      expect(row.hasPrice).toBe(false);
      expect(row.chaosValue).toBe(0);
      expect(row.divineValue).toBe(0);
      expect(row.evContribution).toBe(0);
    }
    // Probabilities should still be computed
    expect(rows[0].probability).toBeCloseTo(1 / totalWeight, 8);
  });

  it("handles empty weights array", () => {
    const rows = buildRows([], makePrices(), 0);
    expect(rows).toHaveLength(0);
  });

  it("handles totalWeight of 0 gracefully", () => {
    const weights: ProfitForecastWeightDTO[] = [
      { cardName: "Test", weight: 0, fromBoss: false },
    ];
    const rows = buildRows(weights, null, 0);
    expect(rows[0].probability).toBe(0);
    expect(rows[0].evContribution).toBe(0);
  });

  it("initializes dynamic fields to 0", () => {
    const weights = makeWeights();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, makePrices(), totalWeight);

    for (const row of rows) {
      expect(row.chanceInBatch).toBe(0);
      expect(row.expectedDecks).toBe(0);
      expect(row.costToPull).toBe(0);
      expect(row.plA).toBe(0);
      expect(row.plB).toBe(0);
    }
  });

  it("carries through fromBoss flag", () => {
    const weights = makeWeights();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, makePrices(), totalWeight);
    const wretched = rows.find((r) => r.cardName === "The Wretched")!;
    expect(wretched.fromBoss).toBe(true);
  });

  it("probabilities sum to 1", () => {
    const weights = makeWeights();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, makePrices(), totalWeight);
    const probSum = rows.reduce((s, r) => s + r.probability, 0);
    expect(probSum).toBeCloseTo(1, 8);
  });
});

describe("computeEvPerDeck", () => {
  it("sums evContribution for rows with prices", () => {
    const weights = makeWeights();
    const prices = makePrices();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, prices, totalWeight);
    const ev = computeEvPerDeck(rows);

    let expected = 0;
    for (const w of weights) {
      const price = prices[w.cardName];
      if (price) {
        expected += (w.weight / totalWeight) * price.chaosValue;
      }
    }
    expect(ev).toBeCloseTo(expected, 4);
  });

  it("excludes cards without prices from EV", () => {
    const weights = makeWeights();
    // Only provide Doctor's price
    const prices = makePrices(["The Doctor"]);
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, prices, totalWeight);
    const ev = computeEvPerDeck(rows);

    const expected = (1 / totalWeight) * 50000;
    expect(ev).toBeCloseTo(expected, 4);
  });

  it("returns 0 when no rows have prices", () => {
    const weights = makeWeights();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, null, totalWeight);
    expect(computeEvPerDeck(rows)).toBe(0);
  });

  it("returns 0 for empty rows", () => {
    expect(computeEvPerDeck([])).toBe(0);
  });
});

describe("recomputeDynamicFields", () => {
  function makeStaticRows(): {
    rows: CardForecastRow[];
    totalWeight: number;
    evPerDeck: number;
  } {
    const weights = makeWeights();
    const prices = makePrices();
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, prices, totalWeight);
    const evPerDeck = computeEvPerDeck(rows);
    return { rows, totalWeight, evPerDeck };
  }

  it("fills chanceInBatch for each row", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, evPerDeck);

    for (const row of rows) {
      if (row.probability > 0) {
        const expected = 1 - (1 - row.probability) ** 10000;
        expect(row.chanceInBatch).toBeCloseTo(expected, 8);
      }
    }
  });

  it("fills expectedDecks = 1 / probability", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, evPerDeck);

    for (const row of rows) {
      if (row.probability > 0) {
        expect(row.expectedDecks).toBeCloseTo(1 / row.probability, 4);
      }
    }
  });

  it("fills costToPull using sliding model", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, evPerDeck);

    for (const row of rows) {
      if (row.probability > 0) {
        const expectedCost = computeTotalChaosCost(
          row.expectedDecks,
          90,
          2,
          5000,
          200,
        );
        expect(row.costToPull).toBeCloseTo(expectedCost, 4);
      }
    }
  });

  it("computes plA = chaosValue - costToPull for priced cards", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, evPerDeck);

    const doctor = rows.find((r) => r.cardName === "The Doctor")!;
    expect(doctor.plA).toBeCloseTo(doctor.chaosValue - doctor.costToPull, 4);
  });

  it("computes plB = (expectedDecks × evPerDeck) - costToPull for priced cards", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, evPerDeck);

    const doctor = rows.find((r) => r.cardName === "The Doctor")!;
    expect(doctor.plB).toBeCloseTo(
      doctor.expectedDecks * evPerDeck - doctor.costToPull,
      4,
    );
  });

  it("sets plA and plB to 0 for cards without prices", () => {
    const weights = makeWeights();
    const prices = makePrices(["The Doctor"]); // only Doctor has price
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const rows = buildRows(weights, prices, totalWeight);
    const evPerDeck = computeEvPerDeck(rows);

    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, evPerDeck);

    const nurse = rows.find((r) => r.cardName === "The Nurse")!;
    expect(nurse.hasPrice).toBe(false);
    expect(nurse.plA).toBe(0);
    expect(nurse.plB).toBe(0);
    // But costToPull and expectedDecks should still be set
    expect(nurse.costToPull).toBeGreaterThan(0);
    expect(nurse.expectedDecks).toBeGreaterThan(0);
  });

  it("handles rows with 0 probability", () => {
    const rows: CardForecastRow[] = [
      {
        cardName: "ZeroProb",
        weight: 0,
        fromBoss: false,
        probability: 0,
        chaosValue: 100,
        divineValue: 0.5,
        evContribution: 0,
        hasPrice: true,
        chanceInBatch: 0,
        expectedDecks: 0,
        costToPull: 0,
        plA: 0,
        plB: 0,
      },
    ];

    recomputeDynamicFields(rows, 10000, 90, 2, 5000, 200, 10);

    expect(rows[0].chanceInBatch).toBe(0);
    expect(rows[0].expectedDecks).toBe(0);
    expect(rows[0].costToPull).toBe(0);
    expect(rows[0].plA).toBe(0);
    expect(rows[0].plB).toBe(0);
  });

  it("handles empty rows array", () => {
    const result = recomputeDynamicFields([], 10000, 90, 2, 5000, 200, 10);
    expect(result).toHaveLength(0);
  });

  it("chanceInBatch approaches 1 for large batch sizes", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 1000000, 90, 2, 5000, 200, evPerDeck);

    // Rain of Chaos has weight 500 out of ~706 total → P ≈ 0.708
    // Chance in 1M decks should be essentially 1
    const rain = rows.find((r) => r.cardName === "Rain of Chaos")!;
    expect(rain.chanceInBatch).toBeCloseTo(1, 6);
  });

  it("chanceInBatch is small for rare cards in small batches", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 100, 90, 2, 5000, 200, evPerDeck);

    // The Doctor has weight 1 out of ~706 → P ≈ 0.00142
    // Chance in 100 decks ≈ 1 - (1-0.00142)^100 ≈ 0.132
    const doctor = rows.find((r) => r.cardName === "The Doctor")!;
    expect(doctor.chanceInBatch).toBeGreaterThan(0);
    expect(doctor.chanceInBatch).toBeLessThan(0.5);
  });

  it("returns the mutated array for convenience", () => {
    const { rows, evPerDeck } = makeStaticRows();
    const returned = recomputeDynamicFields(
      rows,
      10000,
      90,
      2,
      5000,
      200,
      evPerDeck,
    );
    expect(returned).toBe(rows);
  });

  it("different selectedBatch produces different chanceInBatch", () => {
    const { rows: rows1, evPerDeck: ev1 } = makeStaticRows();
    const { rows: rows2, evPerDeck: ev2 } = makeStaticRows();

    recomputeDynamicFields(rows1, 1000, 90, 2, 5000, 200, ev1);
    recomputeDynamicFields(rows2, 100000, 90, 2, 5000, 200, ev2);

    const doctor1 = rows1.find((r) => r.cardName === "The Doctor")!;
    const doctor2 = rows2.find((r) => r.cardName === "The Doctor")!;

    expect(doctor2.chanceInBatch).toBeGreaterThan(doctor1.chanceInBatch);
  });
});

// ── Zustand Slice Integration Tests ────────────────────────────────────────────

// Since the renderer slice depends on `window.electron` and Zustand middleware
// that are difficult to set up in the main-process test runner, we test the
// slice creator in an isolated Zustand store with mocked `window.electron`.

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  createProfitForecastSlice,
  type ProfitForecastSlice,
} from "../ProfitForecast.slice";

type TestStore = ProfitForecastSlice;

function createTestStore() {
  return create<TestStore>()(
    devtools(
      immer((...a) => ({
        ...createProfitForecastSlice(...a),
      })),
    ),
  );
}

describe("ProfitForecastSlice (Zustand)", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();

    // Mock window.electron.profitForecast.getData
    (globalThis as any).window = {
      electron: {
        profitForecast: {
          getData: vi.fn(),
        },
      },
    };
  });

  describe("initial state", () => {
    it("has correct default values", () => {
      const state = store.getState().profitForecast;
      expect(state.rows).toEqual([]);
      expect(state.totalWeight).toBe(0);
      expect(state.evPerDeck).toBe(0);
      expect(state.snapshotFetchedAt).toBeNull();
      expect(state.chaosToDivineRatio).toBe(0);
      expect(state.stackedDeckChaosCost).toBe(0);
      expect(state.baseRate).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.isComputing).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedBatch).toBe(10000);
      expect(state.minPriceThreshold).toBe(5);
      expect(state.stepDrop).toBe(2);
      expect(state.subBatchSize).toBe(5000);
    });
  });

  describe("setters", () => {
    it("setSelectedBatch updates selectedBatch", () => {
      store.getState().profitForecast.setSelectedBatch(100000);
      expect(store.getState().profitForecast.selectedBatch).toBe(100000);
    });

    it("setMinPriceThreshold updates minPriceThreshold", () => {
      store.getState().profitForecast.setMinPriceThreshold(10);
      expect(store.getState().profitForecast.minPriceThreshold).toBe(10);
    });

    it("setStepDrop updates stepDrop", () => {
      store.getState().profitForecast.setStepDrop(5);
      expect(store.getState().profitForecast.stepDrop).toBe(5);
    });

    it("setSubBatchSize updates subBatchSize", () => {
      store.getState().profitForecast.setSubBatchSize(10000);
      expect(store.getState().profitForecast.subBatchSize).toBe(10000);
    });

    it("setIsComputing updates isComputing", () => {
      store.getState().profitForecast.setIsComputing(true);
      expect(store.getState().profitForecast.isComputing).toBe(true);
      store.getState().profitForecast.setIsComputing(false);
      expect(store.getState().profitForecast.isComputing).toBe(false);
    });
  });

  describe("fetchData", () => {
    it("sets isLoading true then false on success", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      const fetchPromise = store
        .getState()
        .profitForecast.fetchData("poe1", "Settlers");

      // isLoading should be true during fetch
      expect(store.getState().profitForecast.isLoading).toBe(true);

      await fetchPromise;

      expect(store.getState().profitForecast.isLoading).toBe(false);
    });

    it("populates rows, totalWeight, evPerDeck, and snapshot fields", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.rows.length).toBe(4);
      expect(state.totalWeight).toBe(1 + 5 + 500 + 200);
      expect(state.evPerDeck).toBeGreaterThan(0);
      expect(state.snapshotFetchedAt).toBe("2025-01-15T12:00:00Z");
      expect(state.chaosToDivineRatio).toBe(200);
      expect(state.stackedDeckChaosCost).toBe(2.22);
      expect(state.baseRate).toBeGreaterThanOrEqual(RATE_FLOOR);
    });

    it("computes baseRate = floor(chaosToDivineRatio / stackedDeckChaosCost)", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      // 200 / 2.22 = 90.09... → floor = 90
      expect(store.getState().profitForecast.baseRate).toBe(90);
    });

    it("clamps baseRate to RATE_FLOOR if computed value is lower", async () => {
      const dto = makeDTO({
        snapshot: {
          id: "snap-1",
          fetchedAt: "2025-01-15T12:00:00Z",
          chaosToDivineRatio: 200,
          stackedDeckChaosCost: 10, // 200/10 = 20 → below RATE_FLOOR
          cardPrices: makePrices(),
        },
      });
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      expect(store.getState().profitForecast.baseRate).toBe(RATE_FLOOR);
    });

    it("handles null snapshot gracefully", async () => {
      const dto = makeDTO({ snapshot: null });
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.snapshotFetchedAt).toBeNull();
      expect(state.chaosToDivineRatio).toBe(0);
      expect(state.stackedDeckChaosCost).toBe(0);
      expect(state.baseRate).toBe(0);
      expect(state.evPerDeck).toBe(0);
      // Rows should still exist with weights but no prices
      expect(state.rows.length).toBe(4);
      for (const row of state.rows) {
        expect(row.hasPrice).toBe(false);
      }
    });

    it("sorts rows by evContribution descending", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const rows = store.getState().profitForecast.rows;
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1].evContribution).toBeGreaterThanOrEqual(
          rows[i].evContribution,
        );
      }
    });

    it("fills dynamic fields after fetchData", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const rows = store.getState().profitForecast.rows;
      for (const row of rows) {
        if (row.probability > 0) {
          expect(row.expectedDecks).toBeGreaterThan(0);
          expect(row.chanceInBatch).toBeGreaterThan(0);
          expect(row.costToPull).toBeGreaterThan(0);
        }
      }
    });

    it("handles fetch error", async () => {
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("Network failure"));

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Network failure");
      expect(state.rows).toEqual([]);
    });

    it("handles non-Error thrown value", async () => {
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockRejectedValue("Some string error");

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.error).toBe("Failed to fetch profit forecast data");
    });

    it("clears previous error on new fetch", async () => {
      // First fetch fails
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("fail"));
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      expect(store.getState().profitForecast.error).toBe("fail");

      // Second fetch succeeds
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(makeDTO());
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      expect(store.getState().profitForecast.error).toBeNull();
    });

    it("passes game and league to the IPC call", async () => {
      const dto = makeDTO();
      const mockGetData = window.electron.profitForecast.getData as ReturnType<
        typeof vi.fn
      >;
      mockGetData.mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe2", "Keepers");

      expect(mockGetData).toHaveBeenCalledWith("poe2", "Keepers");
    });

    it("handles empty weights array", async () => {
      const dto = makeDTO({ weights: [] });
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.rows).toEqual([]);
      expect(state.totalWeight).toBe(0);
      expect(state.evPerDeck).toBe(0);
    });

    it("handles stackedDeckChaosCost of 0 (baseRate stays 0)", async () => {
      const dto = makeDTO({
        snapshot: {
          id: "snap-1",
          fetchedAt: "2025-01-15T12:00:00Z",
          chaosToDivineRatio: 200,
          stackedDeckChaosCost: 0,
          cardPrices: makePrices(),
        },
      });
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      expect(store.getState().profitForecast.baseRate).toBe(0);
    });

    it("uses current UI controls (selectedBatch, stepDrop, subBatchSize) for initial recompute", async () => {
      // Set non-default values before fetch
      store.getState().profitForecast.setSelectedBatch(100000);
      store.getState().profitForecast.setStepDrop(5);
      store.getState().profitForecast.setSubBatchSize(1000);

      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const rows = store.getState().profitForecast.rows;
      // Verify the chanceInBatch uses selectedBatch of 100000
      const doctor = rows.find((r) => r.cardName === "The Doctor")!;
      const expectedChance = 1 - (1 - doctor.probability) ** 100000;
      expect(doctor.chanceInBatch).toBeCloseTo(expectedChance, 6);
    });
  });

  describe("recomputeRows", () => {
    async function setupWithData() {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
    }

    it("updates dynamic fields when called", async () => {
      await setupWithData();

      // Change selectedBatch and recompute
      store.getState().profitForecast.setSelectedBatch(1000000);
      store.getState().profitForecast.recomputeRows();

      const rows = store.getState().profitForecast.rows;
      const doctor = rows.find((r) => r.cardName === "The Doctor")!;
      const expectedChance = 1 - (1 - doctor.probability) ** 1000000;
      expect(doctor.chanceInBatch).toBeCloseTo(expectedChance, 6);
    });

    it("sets isComputing to false after recompute", async () => {
      await setupWithData();

      store.getState().profitForecast.setIsComputing(true);
      expect(store.getState().profitForecast.isComputing).toBe(true);

      store.getState().profitForecast.recomputeRows();
      expect(store.getState().profitForecast.isComputing).toBe(false);
    });

    it("does nothing when rows are empty", () => {
      store.getState().profitForecast.recomputeRows();
      expect(store.getState().profitForecast.rows).toEqual([]);
    });

    it("produces different costToPull with different stepDrop", async () => {
      await setupWithData();

      // Use subBatchSize=100 so The Doctor's ~706 expectedDecks spans
      // multiple sub-batches, making stepDrop changes observable.
      store.getState().profitForecast.setSubBatchSize(100);

      const getDocCost = () =>
        store
          .getState()
          .profitForecast.rows.find((r) => r.cardName === "The Doctor")!
          .costToPull;

      store.getState().profitForecast.setStepDrop(1);
      store.getState().profitForecast.recomputeRows();
      const costLow = getDocCost();

      store.getState().profitForecast.setStepDrop(5);
      store.getState().profitForecast.recomputeRows();
      const costHigh = getDocCost();

      // Higher stepDrop → higher cost (rate degrades faster)
      expect(costHigh).toBeGreaterThan(costLow);
    });

    it("produces different costToPull with different subBatchSize", async () => {
      await setupWithData();

      const getDocCost = () =>
        store
          .getState()
          .profitForecast.rows.find((r) => r.cardName === "The Doctor")!
          .costToPull;

      // Use subBatchSize=100 so ~706 expectedDecks spans 8 sub-batches
      store.getState().profitForecast.setSubBatchSize(100);
      store.getState().profitForecast.recomputeRows();
      const costSmallBatch = getDocCost();

      // Use subBatchSize=10000 so all ~706 decks fit in one sub-batch (no degradation)
      store.getState().profitForecast.setSubBatchSize(10000);
      store.getState().profitForecast.recomputeRows();
      const costLargeBatch = getDocCost();

      // Smaller sub-batch = more degradation steps = higher cost
      expect(costSmallBatch).toBeGreaterThan(costLargeBatch);
    });

    it("preserves row order after recompute", async () => {
      await setupWithData();

      const namesBefore = store
        .getState()
        .profitForecast.rows.map((r) => r.cardName);

      store.getState().profitForecast.setSelectedBatch(100000);
      store.getState().profitForecast.recomputeRows();

      const namesAfter = store
        .getState()
        .profitForecast.rows.map((r) => r.cardName);

      expect(namesAfter).toEqual(namesBefore);
    });

    it("preserves static fields after recompute", async () => {
      await setupWithData();

      const staticBefore = store.getState().profitForecast.rows.map((r) => ({
        cardName: r.cardName,
        weight: r.weight,
        fromBoss: r.fromBoss,
        probability: r.probability,
        chaosValue: r.chaosValue,
        divineValue: r.divineValue,
        evContribution: r.evContribution,
        hasPrice: r.hasPrice,
      }));

      store.getState().profitForecast.setStepDrop(5);
      store.getState().profitForecast.recomputeRows();

      const staticAfter = store.getState().profitForecast.rows.map((r) => ({
        cardName: r.cardName,
        weight: r.weight,
        fromBoss: r.fromBoss,
        probability: r.probability,
        chaosValue: r.chaosValue,
        divineValue: r.divineValue,
        evContribution: r.evContribution,
        hasPrice: r.hasPrice,
      }));

      expect(staticAfter).toEqual(staticBefore);
    });
  });

  describe("getters", () => {
    async function setupWithData() {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
    }

    describe("hasData", () => {
      it("returns false with no data", () => {
        expect(store.getState().profitForecast.hasData()).toBe(false);
      });

      it("returns true after successful fetch", async () => {
        await setupWithData();
        expect(store.getState().profitForecast.hasData()).toBe(true);
      });

      it("returns false when rows exist but totalWeight is 0", async () => {
        // Edge case: shouldn't happen normally, but test the guard
        const dto = makeDTO({
          weights: [{ cardName: "Test", weight: 0, fromBoss: false }],
        });
        (
          window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
        ).mockResolvedValue(dto);
        await store.getState().profitForecast.fetchData("poe1", "Settlers");
        // weight is 0 → totalWeight is 0 → hasData returns false
        expect(store.getState().profitForecast.hasData()).toBe(false);
      });
    });

    describe("getFilteredRows", () => {
      it("filters rows below minPriceThreshold", async () => {
        await setupWithData();

        // Default threshold is 5. Rain of Chaos (0.5c) and The Wretched (1c) should be filtered
        const filtered = store.getState().profitForecast.getFilteredRows();
        const filteredNames = filtered.map((r) => r.cardName);

        expect(filteredNames).toContain("The Doctor");
        expect(filteredNames).toContain("The Nurse");
        expect(filteredNames).not.toContain("Rain of Chaos");
        expect(filteredNames).not.toContain("The Wretched");
      });

      it("includes all rows when threshold is 0", async () => {
        await setupWithData();

        store.getState().profitForecast.setMinPriceThreshold(0);
        const filtered = store.getState().profitForecast.getFilteredRows();
        expect(filtered.length).toBe(4);
      });

      it("always includes cards without prices regardless of threshold", async () => {
        // Cards with hasPrice=false should always be shown
        const dto = makeDTO({
          snapshot: {
            id: "snap-1",
            fetchedAt: "2025-01-15T12:00:00Z",
            chaosToDivineRatio: 200,
            stackedDeckChaosCost: 2.22,
            cardPrices: makePrices(["The Doctor"]), // Only Doctor has price
          },
        });
        (
          window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
        ).mockResolvedValue(dto);
        await store.getState().profitForecast.fetchData("poe1", "Settlers");

        store.getState().profitForecast.setMinPriceThreshold(100000);
        const filtered = store.getState().profitForecast.getFilteredRows();

        // The Nurse, Rain of Chaos, The Wretched have no price → included
        // The Doctor has price 50000 < 100000 → excluded
        expect(filtered.map((r) => r.cardName)).not.toContain("The Doctor");
        expect(filtered.length).toBe(3);
      });

      it("returns empty array when no rows", () => {
        expect(store.getState().profitForecast.getFilteredRows()).toEqual([]);
      });
    });

    describe("getTotalCost", () => {
      it("computes total chaos cost for selectedBatch", async () => {
        await setupWithData();

        const cost = store.getState().profitForecast.getTotalCost();
        const {
          selectedBatch,
          baseRate,
          stepDrop,
          subBatchSize,
          chaosToDivineRatio,
        } = store.getState().profitForecast;

        const expected = computeTotalChaosCost(
          selectedBatch,
          baseRate,
          stepDrop,
          subBatchSize,
          chaosToDivineRatio,
        );
        expect(cost).toBeCloseTo(expected, 4);
      });

      it("returns 0 when no data loaded", () => {
        expect(store.getState().profitForecast.getTotalCost()).toBe(0);
      });
    });

    describe("getTotalRevenue", () => {
      it("computes evPerDeck × selectedBatch", async () => {
        await setupWithData();

        const { evPerDeck, selectedBatch } = store.getState().profitForecast;
        const revenue = store.getState().profitForecast.getTotalRevenue();
        expect(revenue).toBeCloseTo(evPerDeck * selectedBatch, 4);
      });

      it("returns 0 when no data loaded", () => {
        expect(store.getState().profitForecast.getTotalRevenue()).toBe(0);
      });
    });

    describe("getNetPnL", () => {
      it("computes revenue - cost", async () => {
        await setupWithData();

        const pnl = store.getState().profitForecast.getNetPnL();
        const revenue = store.getState().profitForecast.getTotalRevenue();
        const cost = store.getState().profitForecast.getTotalCost();
        expect(pnl).toBeCloseTo(revenue - cost, 4);
      });
    });

    describe("getBreakEvenRate", () => {
      it("computes chaosToDivineRatio / evPerDeck", async () => {
        await setupWithData();

        const { chaosToDivineRatio, evPerDeck } =
          store.getState().profitForecast;
        const breakEven = store.getState().profitForecast.getBreakEvenRate();
        expect(breakEven).toBeCloseTo(chaosToDivineRatio / evPerDeck, 4);
      });

      it("returns 0 when evPerDeck is 0", () => {
        expect(store.getState().profitForecast.getBreakEvenRate()).toBe(0);
      });
    });

    describe("getAvgCostPerDeck", () => {
      it("computes totalCost / selectedBatch", async () => {
        await setupWithData();

        const avg = store.getState().profitForecast.getAvgCostPerDeck();
        const cost = store.getState().profitForecast.getTotalCost();
        const { selectedBatch } = store.getState().profitForecast;
        expect(avg).toBeCloseTo(cost / selectedBatch, 4);
      });

      it("returns 0 when no data loaded", () => {
        expect(store.getState().profitForecast.getAvgCostPerDeck()).toBe(0);
      });
    });

    describe("getRateForBatch", () => {
      it("delegates to computeRateForBatch with current baseRate/stepDrop", async () => {
        await setupWithData();

        const { baseRate, stepDrop } = store.getState().profitForecast;
        const rate = store.getState().profitForecast.getRateForBatch(3);
        expect(rate).toBe(computeRateForBatch(baseRate, 3, stepDrop));
      });

      it("returns RATE_FLOOR when no data loaded (baseRate=0)", () => {
        expect(store.getState().profitForecast.getRateForBatch(0)).toBe(
          RATE_FLOOR,
        );
      });
    });
  });

  describe("RATE_FLOOR constant", () => {
    it("equals 60", () => {
      expect(RATE_FLOOR).toBe(60);
    });
  });

  describe("edge cases / regression", () => {
    it("multiple sequential fetches don't corrupt state", async () => {
      const dto1 = makeDTO();
      const dto2 = makeDTO({
        snapshot: {
          id: "snap-2",
          fetchedAt: "2025-02-01T00:00:00Z",
          chaosToDivineRatio: 250,
          stackedDeckChaosCost: 3,
          cardPrices: makePrices(["The Doctor"]),
        },
      });
      const mockGetData = window.electron.profitForecast.getData as ReturnType<
        typeof vi.fn
      >;

      mockGetData.mockResolvedValue(dto1);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      const state1 = store.getState().profitForecast;
      expect(state1.chaosToDivineRatio).toBe(200);

      mockGetData.mockResolvedValue(dto2);
      await store.getState().profitForecast.fetchData("poe1", "Keepers");
      const state2 = store.getState().profitForecast;
      expect(state2.chaosToDivineRatio).toBe(250);
      expect(state2.snapshotFetchedAt).toBe("2025-02-01T00:00:00Z");
    });

    it("recomputeRows after setter change yields consistent results", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      // Simulate what the page component does:
      // 1. User changes stepDrop
      // 2. setIsComputing(true)
      // 3. debounce fires → recomputeRows()
      store.getState().profitForecast.setStepDrop(4);
      store.getState().profitForecast.setIsComputing(true);
      expect(store.getState().profitForecast.isComputing).toBe(true);

      store.getState().profitForecast.recomputeRows();
      expect(store.getState().profitForecast.isComputing).toBe(false);

      // Verify the rows use the updated stepDrop
      const { rows, baseRate, subBatchSize, chaosToDivineRatio } =
        store.getState().profitForecast;
      const doctor = rows.find((r) => r.cardName === "The Doctor")!;
      const expectedCost = computeTotalChaosCost(
        doctor.expectedDecks,
        baseRate,
        4, // new stepDrop
        subBatchSize,
        chaosToDivineRatio,
      );
      expect(doctor.costToPull).toBeCloseTo(expectedCost, 4);
    });

    it("very large batch (1M) computes without error", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      store.getState().profitForecast.setSelectedBatch(1000000);
      store.getState().profitForecast.recomputeRows();

      const { rows } = store.getState().profitForecast;
      expect(rows.length).toBe(4);
      for (const row of rows) {
        expect(Number.isFinite(row.costToPull)).toBe(true);
        expect(Number.isFinite(row.plA)).toBe(true);
        expect(Number.isFinite(row.plB)).toBe(true);
        expect(Number.isFinite(row.chanceInBatch)).toBe(true);
      }
    });

    it("all batch sizes produce valid total cost", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const batches = [1000, 10000, 100000, 1000000] as const;
      const costs: number[] = [];

      for (const batch of batches) {
        store.getState().profitForecast.setSelectedBatch(batch);
        store.getState().profitForecast.recomputeRows();
        costs.push(store.getState().profitForecast.getTotalCost());
      }

      // Each larger batch should cost more
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      }
    });

    it("getAvgCostPerDeck increases with larger batches due to sliding rate", async () => {
      const dto = makeDTO();
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      store.getState().profitForecast.setSelectedBatch(1000);
      store.getState().profitForecast.recomputeRows();
      const avg1k = store.getState().profitForecast.getAvgCostPerDeck();

      store.getState().profitForecast.setSelectedBatch(1000000);
      store.getState().profitForecast.recomputeRows();
      const avg1M = store.getState().profitForecast.getAvgCostPerDeck();

      // Avg cost should be higher at 1M due to rate degradation
      expect(avg1M).toBeGreaterThan(avg1k);
    });

    it("single-card weight list works correctly", async () => {
      const dto: ProfitForecastDataDTO = {
        snapshot: {
          id: "snap-1",
          fetchedAt: "2025-01-15T12:00:00Z",
          chaosToDivineRatio: 200,
          stackedDeckChaosCost: 2.22,
          cardPrices: {
            "The Doctor": {
              chaosValue: 50000,
              divineValue: 250,
              source: "exchange",
            },
          },
        },
        weights: [{ cardName: "The Doctor", weight: 1, fromBoss: false }],
      };
      (
        window.electron.profitForecast.getData as ReturnType<typeof vi.fn>
      ).mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.rows.length).toBe(1);
      expect(state.rows[0].probability).toBe(1); // only card → 100%
      expect(state.rows[0].evContribution).toBe(50000);
      expect(state.totalWeight).toBe(1);
      expect(state.evPerDeck).toBe(50000);
    });
  });
});
