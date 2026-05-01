import { describe, expect, it } from "vitest";

import {
  computeAll,
  computeRowDynamicFields,
  getEffectiveCostParams,
} from "../ProfitForecast.compute";
import type { ProfitForecastRowDTO } from "../ProfitForecast.dto";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TOTAL_WEIGHT = 1506;

const ROWS: ProfitForecastRowDTO[] = [
  {
    cardName: "The Doctor",
    weight: 1,
    fromBoss: false,
    probability: 1 / TOTAL_WEIGHT,
    chaosValue: 50000,
    divineValue: 250,
    evContribution: (1 / TOTAL_WEIGHT) * 50000,
    hasPrice: true,
    confidence: 1 as const,
    isAnomalous: false,
    excludeFromEv: false,
  },
  {
    cardName: "Rain of Chaos",
    weight: 1000,
    fromBoss: false,
    probability: 1000 / TOTAL_WEIGHT,
    chaosValue: 0.5,
    divineValue: 0.0025,
    evContribution: (1000 / TOTAL_WEIGHT) * 0.5,
    hasPrice: true,
    confidence: 1 as const,
    isAnomalous: false,
    excludeFromEv: false,
  },
];

const BASE_REQUEST = {
  rows: ROWS,
  userOverrides: {} as Record<string, boolean>,
  selectedBatch: 10000,
  baseRate: 90,
  stepDrop: 2,
  subBatchSize: 5000,
  customBaseRate: null as number | null,
  chaosToDivineRatio: 200,
  evPerDeck: ROWS.reduce((sum, r) => sum + r.evContribution, 0),
};

// ── getEffectiveCostParams ─────────────────────────────────────────────────────

describe("getEffectiveCostParams", () => {
  it("should return original params when customBaseRate is null", () => {
    const result = getEffectiveCostParams(null, 2, 5000, 10000);
    expect(result).toEqual({
      effectiveStepDrop: 2,
      effectiveSubBatchSize: 5000,
    });
  });

  it("should return stepDrop=0 and subBatchSize=selectedBatch when customBaseRate is set", () => {
    const result = getEffectiveCostParams(100, 2, 5000, 10000);
    expect(result).toEqual({
      effectiveStepDrop: 0,
      effectiveSubBatchSize: 10000,
    });
  });

  it("should treat customBaseRate=0 as set (not null)", () => {
    const result = getEffectiveCostParams(0, 5, 3000, 8000);
    expect(result).toEqual({
      effectiveStepDrop: 0,
      effectiveSubBatchSize: 8000,
    });
  });
});

// ── computeRowDynamicFields ────────────────────────────────────────────────────

describe("computeRowDynamicFields", () => {
  const selectedBatch = 10000;
  const baseRate = 90;
  const stepDrop = 2;
  const subBatchSize = 5000;
  const chaosToDivineRatio = 200;
  const evPerDeck = BASE_REQUEST.evPerDeck;

  it("should return a record keyed by cardName for each row", () => {
    const result = computeRowDynamicFields(
      ROWS,
      selectedBatch,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
      evPerDeck,
    );

    expect(Object.keys(result)).toHaveLength(2);
    expect(result).toHaveProperty("The Doctor");
    expect(result).toHaveProperty("Rain of Chaos");
  });

  it("should compute correct fields for each card", () => {
    const result = computeRowDynamicFields(
      ROWS,
      selectedBatch,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
      evPerDeck,
    );

    const doctor = result["The Doctor"];
    expect(doctor.chanceInBatch).toBeGreaterThan(0);
    expect(doctor.chanceInBatch).toBeLessThanOrEqual(1);
    expect(doctor.expectedDecks).toBeCloseTo(TOTAL_WEIGHT, 0);
    expect(doctor.costToPull).toBeGreaterThan(0);
    expect(doctor.plA).not.toBe(0);
    expect(doctor.plB).not.toBe(0);

    const rain = result["Rain of Chaos"];
    expect(rain.chanceInBatch).toBeGreaterThan(0.99);
    expect(rain.expectedDecks).toBeCloseTo(TOTAL_WEIGHT / 1000, 1);
    expect(rain.costToPull).toBeGreaterThan(0);
  });

  it("should return plA=0 and plB=0 for cards without prices", () => {
    const noPriceRows: ProfitForecastRowDTO[] = [
      {
        cardName: "No Price Card",
        weight: 10,
        fromBoss: false,
        probability: 10 / TOTAL_WEIGHT,
        chaosValue: 100,
        divineValue: 0.5,
        evContribution: (10 / TOTAL_WEIGHT) * 100,
        hasPrice: false,
        confidence: null,
        isAnomalous: false,
        excludeFromEv: true,
      },
    ];

    const result = computeRowDynamicFields(
      noPriceRows,
      selectedBatch,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
      evPerDeck,
    );

    const card = result["No Price Card"];
    expect(card.plA).toBe(0);
    expect(card.plB).toBe(0);
    // costToPull and expectedDecks should still be computed
    expect(card.expectedDecks).toBeGreaterThan(0);
    expect(card.costToPull).toBeGreaterThan(0);
  });

  it("should return all zeros for a card with probability=0", () => {
    const zeroRows: ProfitForecastRowDTO[] = [
      {
        cardName: "Zero Card",
        weight: 0,
        fromBoss: false,
        probability: 0,
        chaosValue: 100,
        divineValue: 0.5,
        evContribution: 0,
        hasPrice: true,
        confidence: 1,
        isAnomalous: false,
        excludeFromEv: false,
      },
    ];

    const result = computeRowDynamicFields(
      zeroRows,
      selectedBatch,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
      evPerDeck,
    );

    const card = result["Zero Card"];
    expect(card).toEqual({
      chanceInBatch: 0,
      expectedDecks: 0,
      costToPull: 0,
      plA: 0,
      plB: 0,
    });
  });

  it("should compute chanceInBatch using binomial formula", () => {
    const result = computeRowDynamicFields(
      ROWS,
      selectedBatch,
      baseRate,
      stepDrop,
      subBatchSize,
      chaosToDivineRatio,
      evPerDeck,
    );

    const doctorProb = 1 / TOTAL_WEIGHT;
    const expectedChance = 1 - (1 - doctorProb) ** selectedBatch;
    expect(result["The Doctor"].chanceInBatch).toBeCloseTo(expectedChance, 10);
  });
});

// ── computeAll ─────────────────────────────────────────────────────────────────

describe("computeAll", () => {
  it("should return rowFields keyed by cardName with correct dynamic fields", () => {
    const result = computeAll(BASE_REQUEST);

    expect(result.rowFields).toHaveProperty("The Doctor");
    expect(result.rowFields).toHaveProperty("Rain of Chaos");

    const doctor = result.rowFields["The Doctor"];
    expect(doctor).toHaveProperty("chanceInBatch");
    expect(doctor).toHaveProperty("expectedDecks");
    expect(doctor).toHaveProperty("costToPull");
    expect(doctor).toHaveProperty("plA");
    expect(doctor).toHaveProperty("plB");

    expect(doctor.chanceInBatch).toBeGreaterThan(0);
    expect(doctor.chanceInBatch).toBeLessThanOrEqual(1);
    expect(doctor.expectedDecks).toBeCloseTo(TOTAL_WEIGHT, 0);
    expect(doctor.costToPull).toBeGreaterThan(0);
  });

  it("should return totalCost > 0", () => {
    const result = computeAll(BASE_REQUEST);
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it("should return pnlCurve with multiple data points", () => {
    const result = computeAll(BASE_REQUEST);

    expect(result.pnlCurve.length).toBeGreaterThan(1);

    for (const point of result.pnlCurve) {
      expect(point).toHaveProperty("deckCount");
      expect(point).toHaveProperty("estimated");
      expect(point).toHaveProperty("optimistic");
      expect(typeof point.deckCount).toBe("number");
      expect(typeof point.estimated).toBe("number");
      expect(typeof point.optimistic).toBe("number");
    }
  });

  it("should include selectedBatch as the last pnlCurve data point", () => {
    const result = computeAll(BASE_REQUEST);
    const lastPoint = result.pnlCurve[result.pnlCurve.length - 1];
    expect(lastPoint.deckCount).toBe(BASE_REQUEST.selectedBatch);
  });

  it("should return the capped pnlCurve batch-size distribution", () => {
    const result = computeAll(BASE_REQUEST);

    expect(result.pnlCurve.map((point) => point.deckCount)).toEqual([
      200, 400, 600, 800, 1000, 2000, 3000, 5000, 7500, 10000,
    ]);
  });

  it("should return pnlCurve points in ascending deckCount order", () => {
    const result = computeAll(BASE_REQUEST);
    for (let i = 1; i < result.pnlCurve.length; i++) {
      expect(result.pnlCurve[i].deckCount).toBeGreaterThan(
        result.pnlCurve[i - 1].deckCount,
      );
    }
  });

  it("should return confidenceInterval with estimated <= optimistic", () => {
    const result = computeAll(BASE_REQUEST);

    expect(result.confidenceInterval).toHaveProperty("estimated");
    expect(result.confidenceInterval).toHaveProperty("optimistic");
    expect(result.confidenceInterval.estimated).toBeLessThanOrEqual(
      result.confidenceInterval.optimistic,
    );
  });

  it("should return batchPnL with revenue, cost, netPnL, and confidence", () => {
    const result = computeAll(BASE_REQUEST);

    expect(result.batchPnL).toHaveProperty("revenue");
    expect(result.batchPnL).toHaveProperty("cost");
    expect(result.batchPnL).toHaveProperty("netPnL");
    expect(result.batchPnL).toHaveProperty("confidence");
    expect(result.batchPnL.confidence).toHaveProperty("estimated");
    expect(result.batchPnL.confidence).toHaveProperty("optimistic");

    expect(result.batchPnL.revenue).toBeGreaterThan(0);
    expect(result.batchPnL.cost).toBeGreaterThan(0);
    // netPnL = revenue - cost
    expect(result.batchPnL.netPnL).toBeCloseTo(
      result.batchPnL.revenue - result.batchPnL.cost,
      5,
    );
  });

  it("should disable rate degradation when customBaseRate is set", () => {
    const withCustomRate = computeAll({
      ...BASE_REQUEST,
      customBaseRate: 80,
    });

    const withoutCustomRate = computeAll({
      ...BASE_REQUEST,
      customBaseRate: null,
    });

    // With a custom rate, stepDrop=0, so the cost per deck is uniform.
    // The total cost should differ from the sliding-rate model.
    expect(withCustomRate.totalCost).not.toBeCloseTo(
      withoutCustomRate.totalCost,
      0,
    );

    // Custom rate uses the custom value, not the server baseRate
    // So cost should reflect the custom rate (80) rather than the server rate (90)
    expect(withCustomRate.totalCost).toBeGreaterThan(
      withoutCustomRate.totalCost,
    );
  });

  it("should return zero-filled results with empty rows", () => {
    const result = computeAll({
      ...BASE_REQUEST,
      rows: [],
      evPerDeck: 0,
    });

    expect(result.rowFields).toEqual({});
    expect(result.totalCost).toBeGreaterThan(0); // cost is independent of rows
    expect(result.confidenceInterval.estimated).toBe(0);
    expect(result.confidenceInterval.optimistic).toBe(0);
    expect(result.batchPnL.revenue).toBe(0);
    expect(result.batchPnL.netPnL).toBeLessThan(0); // pure cost, no revenue
  });

  it("should return all-zero rowFields for a card with probability=0", () => {
    const zeroRow: ProfitForecastRowDTO = {
      cardName: "Zero Card",
      weight: 0,
      fromBoss: false,
      probability: 0,
      chaosValue: 500,
      divineValue: 2.5,
      evContribution: 0,
      hasPrice: true,
      confidence: 1,
      isAnomalous: false,
      excludeFromEv: false,
    };

    const result = computeAll({
      ...BASE_REQUEST,
      rows: [zeroRow],
    });

    expect(result.rowFields["Zero Card"]).toEqual({
      chanceInBatch: 0,
      expectedDecks: 0,
      costToPull: 0,
      plA: 0,
      plB: 0,
    });
  });

  it("should apply userOverrides to toggle excludeFromEv", () => {
    // The Doctor is not anomalous, so toggling the override should
    // set excludeFromEv = !auto = !false = true, excluding it from EV.
    const resultExcluded = computeAll({
      ...BASE_REQUEST,
      userOverrides: { "The Doctor": true },
    });

    const resultIncluded = computeAll({
      ...BASE_REQUEST,
      userOverrides: {},
    });

    // When The Doctor is excluded, confidence interval estimated revenue
    // should be lower because its evContribution is not counted.
    expect(resultExcluded.confidenceInterval.estimated).toBeLessThan(
      resultIncluded.confidenceInterval.estimated,
    );
  });

  it("should exclude rows without prices from confidence interval", () => {
    const noPriceRow: ProfitForecastRowDTO = {
      cardName: "No Price",
      weight: 500,
      fromBoss: false,
      probability: 500 / TOTAL_WEIGHT,
      chaosValue: 1000,
      divineValue: 5,
      evContribution: (500 / TOTAL_WEIGHT) * 1000,
      hasPrice: false,
      confidence: null,
      isAnomalous: false,
      excludeFromEv: false,
    };

    const withPrice = computeAll(BASE_REQUEST);
    const withExtra = computeAll({
      ...BASE_REQUEST,
      rows: [...ROWS, noPriceRow],
    });

    // Adding a no-price row should NOT affect the confidence interval
    // because hasPrice=false rows are excluded.
    expect(withExtra.confidenceInterval.estimated).toBeCloseTo(
      withPrice.confidenceInterval.estimated,
      5,
    );
  });

  it("should produce consistent totalCost and batchPnL.cost", () => {
    const result = computeAll(BASE_REQUEST);
    expect(result.totalCost).toBeCloseTo(result.batchPnL.cost, 10);
  });

  it("should only include pnlCurve points up to selectedBatch", () => {
    const smallBatch = computeAll({
      ...BASE_REQUEST,
      selectedBatch: 500,
    });

    for (const point of smallBatch.pnlCurve) {
      expect(point.deckCount).toBeLessThanOrEqual(500);
    }

    // Should still include the selectedBatch as the last point
    const lastPoint = smallBatch.pnlCurve[smallBatch.pnlCurve.length - 1];
    expect(lastPoint.deckCount).toBe(500);
  });

  it("should handle a very small selectedBatch below all curve sizes", () => {
    const result = computeAll({
      ...BASE_REQUEST,
      selectedBatch: 50,
    });

    // Should have at least one data point (the selectedBatch itself)
    expect(result.pnlCurve.length).toBeGreaterThanOrEqual(1);
    expect(result.pnlCurve[result.pnlCurve.length - 1].deckCount).toBe(50);
  });
});
