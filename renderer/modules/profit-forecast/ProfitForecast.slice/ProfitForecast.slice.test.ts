import { beforeEach, describe, expect, it, vi } from "vitest";

import { computeAll } from "~/main/modules/profit-forecast/ProfitForecast.compute";
import type {
  BaseRateSource,
  ProfitForecastComputeRequest,
  ProfitForecastDataDTO,
  ProfitForecastRowDTO,
} from "~/main/modules/profit-forecast/ProfitForecast.dto";
import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

import {
  type CardForecastRow,
  computeEvPerDeck,
  computeExcludeFromEv,
  computeRateForBatch,
  computeTotalChaosCost,
  isAutoExcluded,
  RATE_FLOOR,
  recomputeDynamicFields,
} from "./ProfitForecast.slice";

// ── Test Fixtures ──────────────────────────────────────────────────────────────

/** Convenience: build a single ProfitForecastRowDTO with sensible defaults. */
function makeRowDTO(
  overrides: Partial<ProfitForecastRowDTO> & { cardName: string },
): ProfitForecastRowDTO {
  return {
    cardName: overrides.cardName,
    weight: overrides.weight ?? 100,
    fromBoss: overrides.fromBoss ?? false,
    probability: overrides.probability ?? 0,
    chaosValue: overrides.chaosValue ?? 0,
    divineValue: overrides.divineValue ?? 0,
    evContribution: overrides.evContribution ?? 0,
    hasPrice: overrides.hasPrice ?? true,
    confidence: overrides.confidence ?? 1,
    isAnomalous: overrides.isAnomalous ?? false,
    excludeFromEv: overrides.excludeFromEv ?? false,
  };
}

/** Build a CardForecastRow (renderer-side) from a partial DTO + renderer defaults. */
function makeCardForecastRow(
  dto: Partial<ProfitForecastRowDTO> & { cardName: string },
): CardForecastRow {
  return {
    cardName: dto.cardName,
    weight: dto.weight ?? 100,
    fromBoss: dto.fromBoss ?? false,
    probability: dto.probability ?? 0,
    chaosValue: dto.chaosValue ?? 0,
    divineValue: dto.divineValue ?? 0,
    evContribution: dto.evContribution ?? 0,
    hasPrice: dto.hasPrice ?? true,
    confidence: dto.confidence ?? 1,
    isAnomalous: dto.isAnomalous ?? false,
    excludeFromEv: dto.excludeFromEv ?? false,
    userOverride: false,
    belowMinPrice: false,
    chanceInBatch: 0,
    expectedDecks: 0,
    costToPull: 0,
    plA: 0,
    plB: 0,
  };
}

// The 4 test cards and their weights/prices:
// The Doctor:    weight=1,    chaosValue=50000, divineValue=250,    confidence=1, isAnomalous=false, fromBoss=false
// The Nurse:     weight=5,    chaosValue=25000, divineValue=125,    confidence=1, isAnomalous=false, fromBoss=false
// Rain of Chaos: weight=1000, chaosValue=0.5,   divineValue=0.0025, confidence=1, isAnomalous=false, fromBoss=false
// The Wretched:  weight=500,  chaosValue=1,     divineValue=0.005,  confidence=2, isAnomalous=false, fromBoss=true
const TOTAL_WEIGHT = 1 + 5 + 1000 + 500; // 1506

function makeRows(): ProfitForecastRowDTO[] {
  const cards: Array<{
    cardName: string;
    weight: number;
    chaosValue: number;
    divineValue: number;
    confidence: 1 | 2 | 3;
    isAnomalous: boolean;
    fromBoss: boolean;
  }> = [
    {
      cardName: "The Doctor",
      weight: 1,
      chaosValue: 50000,
      divineValue: 250,
      confidence: 1,
      isAnomalous: false,
      fromBoss: false,
    },
    {
      cardName: "The Nurse",
      weight: 5,
      chaosValue: 25000,
      divineValue: 125,
      confidence: 1,
      isAnomalous: false,
      fromBoss: false,
    },
    {
      cardName: "Rain of Chaos",
      weight: 1000,
      chaosValue: 0.5,
      divineValue: 0.0025,
      confidence: 1,
      isAnomalous: false,
      fromBoss: false,
    },
    {
      cardName: "The Wretched",
      weight: 500,
      chaosValue: 1,
      divineValue: 0.005,
      confidence: 2,
      isAnomalous: false,
      fromBoss: true,
    },
  ];

  return cards
    .map((c) => {
      const probability = c.weight / TOTAL_WEIGHT;
      const evContribution = probability * c.chaosValue;
      return makeRowDTO({
        cardName: c.cardName,
        weight: c.weight,
        fromBoss: c.fromBoss,
        probability,
        chaosValue: c.chaosValue,
        divineValue: c.divineValue,
        evContribution,
        hasPrice: true,
        confidence: c.confidence,
        isAnomalous: c.isAnomalous,
        excludeFromEv: false, // all have prices, none anomalous
      });
    })
    .sort((a, b) => b.evContribution - a.evContribution);
}

function computeDefaultEvPerDeck(): number {
  const rows = makeRows();
  return rows.reduce(
    (sum, r) => (r.hasPrice && !r.excludeFromEv ? sum + r.evContribution : sum),
    0,
  );
}

function makeDTO(
  partial?: Partial<ProfitForecastDataDTO>,
): ProfitForecastDataDTO {
  const rows = makeRows();
  const evPerDeck = computeDefaultEvPerDeck();
  return {
    rows,
    totalWeight: TOTAL_WEIGHT,
    evPerDeck,
    snapshotFetchedAt: "2025-01-15T12:00:00Z",
    chaosToDivineRatio: 200,
    stackedDeckChaosCost: 2.22,
    baseRate: 90,
    baseRateSource: "maxVolumeRate" as BaseRateSource,
    ...partial,
  };
}

// ── Pure Helper Tests ──────────────────────────────────────────────────────────

// ── isAutoExcluded ─────────────────────────────────────────────────────────────

describe("isAutoExcluded", () => {
  it("returns true when hasPrice is false", () => {
    expect(
      isAutoExcluded({ hasPrice: false, isAnomalous: false, confidence: 1 }),
    ).toBe(true);
  });

  it("returns true when isAnomalous is true", () => {
    expect(
      isAutoExcluded({ hasPrice: true, isAnomalous: true, confidence: 1 }),
    ).toBe(true);
  });

  it("returns false when confidence is 3 (low confidence is not excluded)", () => {
    expect(
      isAutoExcluded({ hasPrice: true, isAnomalous: false, confidence: 3 }),
    ).toBe(false);
  });

  it("returns false for a normal priced card", () => {
    expect(
      isAutoExcluded({ hasPrice: true, isAnomalous: false, confidence: 1 }),
    ).toBe(false);
  });

  it("returns false for confidence 2", () => {
    expect(
      isAutoExcluded({ hasPrice: true, isAnomalous: false, confidence: 2 }),
    ).toBe(false);
  });

  it("returns true when anomalous (regardless of confidence)", () => {
    expect(
      isAutoExcluded({ hasPrice: true, isAnomalous: true, confidence: 3 }),
    ).toBe(true);
  });
});

describe("computeExcludeFromEv", () => {
  it("always returns true when hasPrice is false, even with userOverride", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: false,
        isAnomalous: false,
        confidence: 1,
        userOverride: false,
      }),
    ).toBe(true);
    expect(
      computeExcludeFromEv({
        hasPrice: false,
        isAnomalous: false,
        confidence: 1,
        userOverride: true,
      }),
    ).toBe(true);
  });

  it("returns true for anomalous card without override", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: true,
        confidence: 1,
        userOverride: false,
      }),
    ).toBe(true);
  });

  it("returns false for anomalous card with override (force-include)", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: true,
        confidence: 1,
        userOverride: true,
      }),
    ).toBe(false);
  });

  it("returns false for low-confidence card without override (confidence no longer excludes)", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: false,
        confidence: 3,
        userOverride: false,
      }),
    ).toBe(false);
  });

  it("returns true for low-confidence card with override (force-exclude, since confidence no longer auto-excludes)", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: false,
        confidence: 3,
        userOverride: true,
      }),
    ).toBe(true);
  });

  it("returns false for normal card without override", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: false,
        confidence: 1,
        userOverride: false,
      }),
    ).toBe(false);
  });

  it("returns true for normal card with override (force-exclude)", () => {
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: false,
        confidence: 1,
        userOverride: true,
      }),
    ).toBe(true);
  });

  it("returns false for anomalous + low-confidence card with override", () => {
    // Both auto flags set, override flips → included
    expect(
      computeExcludeFromEv({
        hasPrice: true,
        isAnomalous: true,
        confidence: 3,
        userOverride: true,
      }),
    ).toBe(false);
  });
});

describe("computeRateForBatch", () => {
  it("returns baseRate for batch index 0", () => {
    expect(computeRateForBatch(90, 0, 2)).toBe(90);
  });

  it("applies stepDrop per batch index", () => {
    expect(computeRateForBatch(90, 1, 2)).toBe(88);
    expect(computeRateForBatch(90, 5, 2)).toBe(80);
  });

  it("clamps to dynamic floor (80% of baseRate) when rate would drop below it", () => {
    // 90 * 0.8 = 72, so dynamic floor = 72
    // 90 - 10 * 2 = 70, below dynamic floor of 72
    expect(computeRateForBatch(90, 10, 2)).toBe(72);
  });

  it("clamps to RATE_FLOOR when baseRate is very low and dynamic floor < RATE_FLOOR", () => {
    // baseRate=22, dynamic floor = ceil(22*0.8) = 18, below RATE_FLOOR of 20
    // 22 - 5 * 2 = 12, below both floors
    expect(computeRateForBatch(22, 5, 2)).toBe(RATE_FLOOR);
  });

  it("returns RATE_FLOOR when baseRate equals RATE_FLOOR", () => {
    expect(computeRateForBatch(RATE_FLOOR, 0, 2)).toBe(RATE_FLOOR);
    expect(computeRateForBatch(RATE_FLOOR, 5, 2)).toBe(RATE_FLOOR);
  });

  it("returns RATE_FLOOR when baseRate is below RATE_FLOOR", () => {
    expect(computeRateForBatch(10, 0, 2)).toBe(RATE_FLOOR);
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

  it("handles large batch indices that push well below dynamic floor", () => {
    // 90 * 0.8 = 72, dynamic floor = 72
    expect(computeRateForBatch(90, 1000, 5)).toBe(72);
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

  it("applies dynamic rate floor correctly for many sub-batches", () => {
    // With baseRate=90, stepDrop=2, dynamic floor = ceil(90*0.8) = 72.
    // The rate hits 72 at batch index 9 (90 - 9*2 = 72).
    // After that, all batches should be at 72.
    const deckCount = 5000 * 40; // 40 sub-batches
    const cost = computeTotalChaosCost(deckCount, 90, 2, 5000, 200);

    const dynamicFloor = Math.ceil(90 * 0.8); // 72
    let expected = 0;
    for (let i = 0; i < 40; i++) {
      const rate = Math.max(RATE_FLOOR, dynamicFloor, 90 - i * 2);
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

describe("computeEvPerDeck", () => {
  it("sums evContribution for rows with prices", () => {
    const rows: CardForecastRow[] = makeRows().map((r) =>
      makeCardForecastRow(r),
    );
    const ev = computeEvPerDeck(rows);

    let expected = 0;
    for (const row of rows) {
      if (row.hasPrice && !row.excludeFromEv) {
        expected += row.evContribution;
      }
    }
    expect(ev).toBeCloseTo(expected, 4);
  });

  it("excludes cards without prices from EV", () => {
    const rows: CardForecastRow[] = makeRows().map((r) => {
      if (r.cardName !== "The Doctor") {
        return makeCardForecastRow({
          ...r,
          hasPrice: false,
          chaosValue: 0,
          divineValue: 0,
          evContribution: 0,
          excludeFromEv: true,
        });
      }
      return makeCardForecastRow(r);
    });
    const ev = computeEvPerDeck(rows);

    const expected = (1 / TOTAL_WEIGHT) * 50000;
    expect(ev).toBeCloseTo(expected, 4);
  });

  it("excludes low-confidence cards from EV", () => {
    const totalWeight = 200;
    const rows: CardForecastRow[] = [
      makeCardForecastRow({
        cardName: "Good Card",
        weight: 100,
        probability: 100 / totalWeight,
        chaosValue: 50,
        divineValue: 0.25,
        evContribution: (100 / totalWeight) * 50,
        hasPrice: true,
        confidence: 1,
        isAnomalous: false,
        excludeFromEv: false,
      }),
      makeCardForecastRow({
        cardName: "Bad Conf",
        weight: 100,
        probability: 100 / totalWeight,
        chaosValue: 50,
        divineValue: 0.25,
        evContribution: (100 / totalWeight) * 50,
        hasPrice: true,
        confidence: 3,
        isAnomalous: false,
        excludeFromEv: true, // low confidence → excluded
      }),
    ];
    const ev = computeEvPerDeck(rows);

    // Only "Good Card" should contribute
    const expected = (100 / 200) * 50;
    expect(ev).toBeCloseTo(expected, 4);
  });

  it("excludes anomalous cards from EV", () => {
    const totalWeight = 200;
    const rows: CardForecastRow[] = [
      makeCardForecastRow({
        cardName: "Normal",
        weight: 100,
        probability: 100 / totalWeight,
        chaosValue: 50,
        divineValue: 0.25,
        evContribution: (100 / totalWeight) * 50,
        hasPrice: true,
        confidence: 1,
        isAnomalous: false,
        excludeFromEv: false,
      }),
      makeCardForecastRow({
        cardName: "Anomalous",
        weight: 100,
        probability: 100 / totalWeight,
        chaosValue: 50,
        divineValue: 0.25,
        evContribution: (100 / totalWeight) * 50,
        hasPrice: true,
        confidence: 1,
        isAnomalous: true,
        excludeFromEv: true, // anomalous → excluded
      }),
    ];

    const anomalousRow = rows.find((r) => r.cardName === "Anomalous")!;
    expect(anomalousRow.isAnomalous).toBe(true);
    expect(anomalousRow.excludeFromEv).toBe(true);

    const ev = computeEvPerDeck(rows);

    // Only Normal should contribute to EV
    const expected = (100 / 200) * 50;
    expect(ev).toBeCloseTo(expected, 4);

    // Anomalous card has evContribution set but is excluded from sum
    expect(anomalousRow.evContribution).toBeGreaterThan(0);
  });

  it("returns 0 when no rows have prices", () => {
    const rows: CardForecastRow[] = makeRows().map((r) =>
      makeCardForecastRow({
        ...r,
        hasPrice: false,
        chaosValue: 0,
        divineValue: 0,
        evContribution: 0,
        excludeFromEv: true,
      }),
    );
    expect(computeEvPerDeck(rows)).toBe(0);
  });

  it("returns 0 for empty rows", () => {
    expect(computeEvPerDeck([])).toBe(0);
  });
});

describe("recomputeDynamicFields", () => {
  function makeStaticRows(): {
    rows: CardForecastRow[];
    evPerDeck: number;
  } {
    const dtoRows = makeRows();
    const rows: CardForecastRow[] = dtoRows.map((r) => makeCardForecastRow(r));
    const evPerDeck = computeEvPerDeck(rows);
    return { rows, evPerDeck };
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
    const dtoRows = makeRows().map((r) => {
      if (r.cardName === "The Doctor") {
        return r; // keep price
      }
      return {
        ...r,
        hasPrice: false,
        chaosValue: 0,
        divineValue: 0,
        evContribution: 0,
        excludeFromEv: true,
      };
    });
    const rows: CardForecastRow[] = dtoRows.map((r) => makeCardForecastRow(r));
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
        confidence: 1,
        isAnomalous: false,
        userOverride: false,
        belowMinPrice: false,
        excludeFromEv: false,
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

    // Rain of Chaos has weight 1000 out of 1506 total → P ≈ 0.664
    // Chance in 1M decks should be essentially 1
    const rain = rows.find((r) => r.cardName === "Rain of Chaos")!;
    expect(rain.chanceInBatch).toBeCloseTo(1, 6);
  });

  it("chanceInBatch is small for rare cards in small batches", () => {
    const { rows, evPerDeck } = makeStaticRows();
    recomputeDynamicFields(rows, 100, 90, 2, 5000, 200, evPerDeck);

    // The Doctor has weight 1 out of 1506 → P ≈ 0.000664
    // Chance in 100 decks ≈ 1 - (1-0.000664)^100 ≈ 0.064
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

describe("ProfitForecastSlice (Zustand)", () => {
  let store: TestStore;
  let electron: ElectronMock;

  /**
   * Install a compute mock that delegates to the real `computeAll` function.
   * This ensures cached aggregate values (PnL curve, confidence interval, etc.)
   * are populated correctly in tests, mirroring what the main process would return.
   */
  function installRealisticComputeMock() {
    electron.profitForecast.compute.mockImplementation(
      (request: ProfitForecastComputeRequest) => {
        return Promise.resolve(computeAll(request));
      },
    );
  }

  beforeEach(() => {
    electron = window.electron as unknown as ElectronMock;
    store = createTestStore();
    installRealisticComputeMock();
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
      expect(state.baseRateSource).toBe("none");
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
      electron.profitForecast.getData.mockResolvedValue(dto);

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
      electron.profitForecast.getData.mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.rows.length).toBe(4);
      expect(state.totalWeight).toBe(TOTAL_WEIGHT);
      expect(state.evPerDeck).toBeGreaterThan(0);
      expect(state.snapshotFetchedAt).toBe("2025-01-15T12:00:00Z");
      expect(state.chaosToDivineRatio).toBe(200);
      expect(state.stackedDeckChaosCost).toBe(2.22);
      expect(state.baseRate).toBeGreaterThanOrEqual(RATE_FLOOR);
    });

    it("populates baseRate and baseRateSource from DTO", async () => {
      const dto = makeDTO(); // baseRate: 90, baseRateSource: "maxVolumeRate"
      electron.profitForecast.getData.mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      expect(store.getState().profitForecast.baseRate).toBe(90);
      expect(store.getState().profitForecast.baseRateSource).toBe(
        "maxVolumeRate",
      );
    });

    it("handles null snapshotFetchedAt gracefully", async () => {
      const dto = makeDTO({
        rows: makeRows().map((r) => ({
          ...r,
          hasPrice: false,
          chaosValue: 0,
          divineValue: 0,
          evContribution: 0,
          excludeFromEv: true,
        })),
        snapshotFetchedAt: null,
        chaosToDivineRatio: 0,
        stackedDeckChaosCost: 0,
        baseRate: 0,
        baseRateSource: "none" as BaseRateSource,
        evPerDeck: 0,
      });
      electron.profitForecast.getData.mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.snapshotFetchedAt).toBeNull();
      expect(state.chaosToDivineRatio).toBe(0);
      expect(state.stackedDeckChaosCost).toBe(0);
      expect(state.baseRate).toBe(0);
      expect(state.baseRateSource).toBe("none");
      expect(state.evPerDeck).toBe(0);
      // Rows should still exist with weights but no prices
      expect(state.rows.length).toBe(4);
      for (const row of state.rows) {
        expect(row.hasPrice).toBe(false);
      }
    });

    it("sorts rows by evContribution descending", async () => {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);

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
      electron.profitForecast.getData.mockResolvedValue(dto);

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
      electron.profitForecast.getData.mockRejectedValue(
        new Error("Network failure"),
      );

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Network failure");
      expect(state.rows).toEqual([]);
    });

    it("handles non-Error thrown value", async () => {
      electron.profitForecast.getData.mockRejectedValue("Some string error");

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.error).toBe("Failed to fetch profit forecast data");
    });

    it("clears previous error on new fetch", async () => {
      // First fetch fails
      electron.profitForecast.getData.mockRejectedValueOnce(new Error("fail"));
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      expect(store.getState().profitForecast.error).toBe("fail");

      // Second fetch succeeds
      electron.profitForecast.getData.mockResolvedValueOnce(makeDTO());
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      expect(store.getState().profitForecast.error).toBeNull();
    });

    it("passes game and league to the IPC call", async () => {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe2", "Keepers");

      expect(electron.profitForecast.getData).toHaveBeenCalledWith(
        "poe2",
        "Keepers",
      );
    });

    it("handles empty rows array", async () => {
      const dto = makeDTO({ rows: [], totalWeight: 0, evPerDeck: 0 });
      electron.profitForecast.getData.mockResolvedValue(dto);

      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.rows).toEqual([]);
      expect(state.totalWeight).toBe(0);
      expect(state.evPerDeck).toBe(0);
    });

    it("uses current UI controls (selectedBatch, stepDrop, subBatchSize) for initial recompute", async () => {
      // Set non-default values before fetch
      store.getState().profitForecast.setSelectedBatch(100000);
      store.getState().profitForecast.setStepDrop(5);
      store.getState().profitForecast.setSubBatchSize(1000);

      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);

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
      electron.profitForecast.getData.mockResolvedValue(dto);
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

      // Use subBatchSize=100 so The Doctor's ~1506 expectedDecks spans
      // multiple sub-batches, making stepDrop changes observable.
      store.getState().profitForecast.setSubBatchSize(100);

      const getDocCost = (): number =>
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

      const getDocCost = (): number =>
        store
          .getState()
          .profitForecast.rows.find((r) => r.cardName === "The Doctor")!
          .costToPull;

      // Use subBatchSize=100 so ~1506 expectedDecks spans many sub-batches
      store.getState().profitForecast.setSubBatchSize(100);
      store.getState().profitForecast.recomputeRows();
      const costSmallBatch = getDocCost();

      // Use subBatchSize=10000 so all ~1506 decks fit in one sub-batch (no degradation)
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
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      // Wait for the async IPC compute call to resolve and update cached values
      await vi.waitFor(() => {
        expect(
          store.getState().profitForecast.cachedBatchPnL.revenue,
        ).toBeGreaterThan(0);
      });
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
          rows: [makeRowDTO({ cardName: "X", weight: 0 })],
          totalWeight: 0,
        });
        electron.profitForecast.getData.mockResolvedValue(dto);
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

      it("includes all priced rows when threshold is 0", async () => {
        await setupWithData();

        store.getState().profitForecast.setMinPriceThreshold(0);
        const filtered = store.getState().profitForecast.getFilteredRows();
        expect(filtered.length).toBe(4);
      });

      it("includes rows at exactly the threshold boundary", async () => {
        await setupWithData();

        // The Wretched has chaosValue = 1, set threshold to exactly 1
        store.getState().profitForecast.setMinPriceThreshold(1);
        const filtered = store.getState().profitForecast.getFilteredRows();
        const filteredNames = filtered.map((r) => r.cardName);

        // chaosValue >= 1 → The Doctor (50000), The Nurse (25000), The Wretched (1) included
        expect(filteredNames).toContain("The Doctor");
        expect(filteredNames).toContain("The Nurse");
        expect(filteredNames).toContain("The Wretched");
        // Rain of Chaos (0.5) is below threshold
        expect(filteredNames).not.toContain("Rain of Chaos");
      });

      it("excludes cards without prices", async () => {
        // Cards with hasPrice=false should be filtered out
        const doctorRow = makeRows().find((r) => r.cardName === "The Doctor")!;
        const noPriceRows = makeRows()
          .filter((r) => r.cardName !== "The Doctor")
          .map((r) => ({
            ...r,
            hasPrice: false,
            chaosValue: 0,
            divineValue: 0,
            evContribution: 0,
            excludeFromEv: true,
          }));
        const dto = makeDTO({
          rows: [doctorRow, ...noPriceRows],
          evPerDeck: doctorRow.evContribution,
        });
        electron.profitForecast.getData.mockResolvedValue(dto);
        await store.getState().profitForecast.fetchData("poe1", "Settlers");

        store.getState().profitForecast.setMinPriceThreshold(0);
        const filtered = store.getState().profitForecast.getFilteredRows();

        // The Nurse, Rain of Chaos, The Wretched have no price → excluded
        // The Doctor has price 50000 ≥ 0 → included
        expect(filtered.map((r) => r.cardName)).toContain("The Doctor");
        expect(filtered.map((r) => r.cardName)).not.toContain("The Nurse");
        expect(filtered.map((r) => r.cardName)).not.toContain("Rain of Chaos");
        expect(filtered.map((r) => r.cardName)).not.toContain("The Wretched");
        expect(filtered.length).toBe(1);
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

    describe("getAvgCostPerDeck edge", () => {
      it("returns 0 when selectedBatch would be 0", async () => {
        // The BatchSize type restricts to specific literals, but the guard
        // exists so we verify it by casting to exercise the defensive path
        await setupWithData();
        store.getState().profitForecast.setSelectedBatch(0 as any);
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

    describe("getConfidenceInterval", () => {
      it("returns estimated ≤ optimistic", async () => {
        await setupWithData();

        const ci = store.getState().profitForecast.getConfidenceInterval();
        expect(ci.estimated).toBeLessThanOrEqual(ci.optimistic);
      });

      it("returns all zeros when no data loaded", () => {
        const ci = store.getState().profitForecast.getConfidenceInterval();
        expect(ci.estimated).toBe(0);
        expect(ci.optimistic).toBe(0);
      });

      it("estimated equals evPerDeck × selectedBatch (revenue)", async () => {
        await setupWithData();

        const { evPerDeck, selectedBatch } = store.getState().profitForecast;
        const ci = store.getState().profitForecast.getConfidenceInterval();
        expect(ci.estimated).toBeCloseTo(evPerDeck * selectedBatch, 4);
      });

      it("changes when selectedBatch changes", async () => {
        await setupWithData();

        const ci1 = store.getState().profitForecast.getConfidenceInterval();

        store.getState().profitForecast.setSelectedBatch(100000);
        store.getState().profitForecast.recomputeRows();
        // Wait for the async IPC compute to update cached values
        await vi.waitFor(() => {
          expect(
            store.getState().profitForecast.cachedConfidenceInterval.estimated,
          ).toBeGreaterThan(ci1.estimated);
        });

        const ci2 = store.getState().profitForecast.getConfidenceInterval();
        expect(ci2.estimated).not.toBeCloseTo(ci1.estimated, 0);
        expect(ci2.estimated).toBeGreaterThan(ci1.estimated);
      });
    });

    describe("getPnLCurve", () => {
      it("returns an array of data points", async () => {
        await setupWithData();

        const curve = store.getState().profitForecast.getPnLCurve();
        expect(curve.length).toBeGreaterThan(0);
      });

      it("each data point has deckCount, estimated, optimistic", async () => {
        await setupWithData();

        const curve = store.getState().profitForecast.getPnLCurve();
        for (const point of curve) {
          expect(point).toHaveProperty("deckCount");
          expect(point).toHaveProperty("estimated");
          expect(point).toHaveProperty("optimistic");
        }
      });

      it("estimated ≤ optimistic for each point", async () => {
        await setupWithData();

        const curve = store.getState().profitForecast.getPnLCurve();
        for (const point of curve) {
          expect(point.estimated).toBeLessThanOrEqual(point.optimistic);
        }
      });

      it("returns empty-ish curve when no data loaded", () => {
        const curve = store.getState().profitForecast.getPnLCurve();
        // With no rows, all revenue values are 0, so estimated P&L ≤ 0 for all points
        for (const point of curve) {
          expect(point.estimated).toBeLessThanOrEqual(0);
        }
      });
    });

    describe("getBatchPnL", () => {
      it("returns revenue, cost, netPnL, and confidence", async () => {
        await setupWithData();

        const result = store.getState().profitForecast.getBatchPnL();
        expect(result).toHaveProperty("revenue");
        expect(result).toHaveProperty("cost");
        expect(result).toHaveProperty("netPnL");
        expect(result).toHaveProperty("confidence");
        expect(result.confidence).toHaveProperty("estimated");
        expect(result.confidence).toHaveProperty("optimistic");
      });

      it("netPnL equals revenue minus cost", async () => {
        await setupWithData();

        const result = store.getState().profitForecast.getBatchPnL();
        expect(result.netPnL).toBeCloseTo(result.revenue - result.cost, 4);
      });

      it("confidence values are net (revenue - cost)", async () => {
        await setupWithData();

        const result = store.getState().profitForecast.getBatchPnL();
        // confidence.estimated should equal netPnL (same cost subtracted from estimated revenue)
        // The CI estimated is evPerDeck * selectedBatch - cost = revenue - cost = netPnL
        expect(result.confidence.estimated).toBeCloseTo(result.netPnL, 4);
      });

      it("confidence.estimated ≤ confidence.optimistic", async () => {
        await setupWithData();

        const { confidence } = store.getState().profitForecast.getBatchPnL();
        expect(confidence.estimated).toBeLessThanOrEqual(confidence.optimistic);
      });

      it("returns zeros when no data loaded", () => {
        const result = store.getState().profitForecast.getBatchPnL();
        expect(result.revenue).toBe(0);
        expect(result.cost).toBe(0);
        expect(result.netPnL).toBe(0);
      });

      it("changes when selectedBatch changes", async () => {
        await setupWithData();

        const pnl1 = store.getState().profitForecast.getBatchPnL();

        store.getState().profitForecast.setSelectedBatch(100000);
        store.getState().profitForecast.recomputeRows();
        // Wait for the async IPC compute to update cached values
        await vi.waitFor(() => {
          expect(
            store.getState().profitForecast.cachedBatchPnL.revenue,
          ).toBeGreaterThan(pnl1.revenue);
        });

        const pnl2 = store.getState().profitForecast.getBatchPnL();
        expect(pnl2.revenue).toBeGreaterThan(pnl1.revenue);
        expect(pnl2.cost).toBeGreaterThan(pnl1.cost);
      });
    });
  });

  describe("edge cases / regression", () => {
    it("multiple sequential fetches don't corrupt state", async () => {
      const dto1 = makeDTO();
      const dto2 = makeDTO({
        rows: [
          makeRowDTO({
            cardName: "The Doctor",
            weight: 1,
            probability: 1,
            chaosValue: 50000,
            divineValue: 250,
            evContribution: 50000,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
            fromBoss: false,
          }),
        ],
        totalWeight: 1,
        evPerDeck: 50000,
        snapshotFetchedAt: "2025-02-01T00:00:00Z",
        chaosToDivineRatio: 250,
        stackedDeckChaosCost: 3,
        baseRate: 83,
        baseRateSource: "derived" as BaseRateSource,
      });

      electron.profitForecast.getData.mockResolvedValueOnce(dto1);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
      const state1 = store.getState().profitForecast;
      expect(state1.chaosToDivineRatio).toBe(200);

      electron.profitForecast.getData.mockResolvedValueOnce(dto2);
      await store.getState().profitForecast.fetchData("poe1", "Keepers");
      const state2 = store.getState().profitForecast;
      expect(state2.chaosToDivineRatio).toBe(250);
      expect(state2.snapshotFetchedAt).toBe("2025-02-01T00:00:00Z");
    });

    it("recomputeRows after setter change yields consistent results", async () => {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);
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
      electron.profitForecast.getData.mockResolvedValue(dto);
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
      electron.profitForecast.getData.mockResolvedValue(dto);
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
      electron.profitForecast.getData.mockResolvedValue(dto);
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
        rows: [
          makeRowDTO({
            cardName: "The Doctor",
            weight: 1,
            fromBoss: false,
            probability: 1,
            chaosValue: 50000,
            divineValue: 250,
            evContribution: 50000,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
          }),
        ],
        totalWeight: 1,
        evPerDeck: 50000,
        snapshotFetchedAt: "2025-01-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        baseRate: 90,
        baseRateSource: "maxVolumeRate" as BaseRateSource,
      };
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const state = store.getState().profitForecast;
      expect(state.rows.length).toBe(1);
      expect(state.rows[0].probability).toBe(1); // only card → 100%
      expect(state.rows[0].evContribution).toBe(50000);
      expect(state.totalWeight).toBe(1);
      expect(state.evPerDeck).toBe(50000);
    });
  });

  describe("toggleCardExclusion", () => {
    async function setupWithData() {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");
    }

    it("sets userOverride to true and excludeFromEv to true for a normal card", async () => {
      await setupWithData();

      const doctorBefore = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctorBefore.userOverride).toBe(false);
      expect(doctorBefore.excludeFromEv).toBe(false);

      store.getState().profitForecast.toggleCardExclusion("The Doctor");

      const doctorAfter = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctorAfter.userOverride).toBe(true);
      expect(doctorAfter.excludeFromEv).toBe(true);
    });

    it("does not affect other cards", async () => {
      await setupWithData();

      const nurseBefore = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Nurse")!;
      const nurseOverrideBefore = nurseBefore.userOverride;

      store.getState().profitForecast.toggleCardExclusion("The Doctor");

      const nurseAfter = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurseAfter.userOverride).toBe(nurseOverrideBefore);
    });

    it("double toggle restores the card to its original state", async () => {
      await setupWithData();

      const evBefore = store.getState().profitForecast.evPerDeck;

      store.getState().profitForecast.toggleCardExclusion("The Doctor");
      expect(store.getState().profitForecast.evPerDeck).not.toBe(evBefore);

      store.getState().profitForecast.toggleCardExclusion("The Doctor");

      const doctorAfter = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctorAfter.userOverride).toBe(false);
      expect(doctorAfter.excludeFromEv).toBe(false);
      expect(store.getState().profitForecast.evPerDeck).toBeCloseTo(
        evBefore,
        8,
      );
    });

    it("recomputes evPerDeck excluding the toggled card", async () => {
      await setupWithData();

      const evBefore = store.getState().profitForecast.evPerDeck;
      const doctor = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Doctor")!;
      const doctorContribution = doctor.evContribution;

      store.getState().profitForecast.toggleCardExclusion("The Doctor");

      const evAfter = store.getState().profitForecast.evPerDeck;
      expect(evAfter).toBeCloseTo(evBefore - doctorContribution, 8);
    });

    it("recomputes dynamic fields (plB) after toggling", async () => {
      await setupWithData();

      const nursePlBBefore = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Nurse")!.plB;

      // Excluding Doctor changes evPerDeck, which changes plB for all cards
      store.getState().profitForecast.toggleCardExclusion("The Doctor");

      const nursePlBAfter = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "The Nurse")!.plB;

      expect(nursePlBAfter).not.toBe(nursePlBBefore);
    });

    it("does nothing when rows are empty", () => {
      // No data loaded — should not throw
      expect(() => {
        store.getState().profitForecast.toggleCardExclusion("The Doctor");
      }).not.toThrow();
    });

    it("does nothing for a card name that does not exist", async () => {
      await setupWithData();

      const evBefore = store.getState().profitForecast.evPerDeck;

      store.getState().profitForecast.toggleCardExclusion("Nonexistent Card");

      expect(store.getState().profitForecast.evPerDeck).toBe(evBefore);
    });

    it("initializes userOverride to false on fetchData", async () => {
      await setupWithData();

      for (const row of store.getState().profitForecast.rows) {
        expect(row.userOverride).toBe(false);
      }
    });

    it("force-includes an anomalous card when toggled", async () => {
      // Build a DTO where one card is flagged anomalous
      const totalWeight = 150;
      const dto: ProfitForecastDataDTO = {
        rows: [
          makeRowDTO({
            cardName: "Normal",
            weight: 100,
            fromBoss: false,
            probability: 100 / totalWeight,
            chaosValue: 100,
            divineValue: 0.5,
            evContribution: (100 / totalWeight) * 100,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
          }),
          makeRowDTO({
            cardName: "Anomalous",
            weight: 50,
            fromBoss: false,
            probability: 50 / totalWeight,
            chaosValue: 5000,
            divineValue: 25,
            evContribution: (50 / totalWeight) * 5000,
            hasPrice: true,
            confidence: 1,
            isAnomalous: true,
            excludeFromEv: true, // auto-excluded because anomalous
          }),
        ],
        totalWeight,
        evPerDeck: (100 / totalWeight) * 100, // only Normal contributes
        snapshotFetchedAt: "2025-01-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        baseRate: 90,
        baseRateSource: "maxVolumeRate" as BaseRateSource,
      };
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      // Anomalous card should be auto-excluded
      const anomBefore = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "Anomalous")!;
      expect(anomBefore.isAnomalous).toBe(true);
      expect(anomBefore.excludeFromEv).toBe(true);
      expect(anomBefore.userOverride).toBe(false);

      const evBefore = store.getState().profitForecast.evPerDeck;

      // Toggle → force-include the anomalous card
      store.getState().profitForecast.toggleCardExclusion("Anomalous");

      const anomAfter = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "Anomalous")!;
      expect(anomAfter.userOverride).toBe(true);
      expect(anomAfter.excludeFromEv).toBe(false); // now included
      expect(anomAfter.isAnomalous).toBe(true); // flag unchanged

      // EV should increase since a high-value card was included
      const evAfter = store.getState().profitForecast.evPerDeck;
      expect(evAfter).toBeGreaterThan(evBefore);
    });

    it("force-excludes a low-confidence card when toggled (confidence no longer auto-excludes)", async () => {
      const totalWeight = 150;
      const dto: ProfitForecastDataDTO = {
        rows: [
          makeRowDTO({
            cardName: "Normal",
            weight: 100,
            fromBoss: false,
            probability: 100 / totalWeight,
            chaosValue: 100,
            divineValue: 0.5,
            evContribution: (100 / totalWeight) * 100,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
          }),
          makeRowDTO({
            cardName: "LowConf",
            weight: 50,
            fromBoss: false,
            probability: 50 / totalWeight,
            chaosValue: 3000,
            divineValue: 15,
            evContribution: (50 / totalWeight) * 3000,
            hasPrice: true,
            confidence: 3,
            isAnomalous: false,
            excludeFromEv: false, // confidence alone no longer excludes
          }),
        ],
        totalWeight,
        evPerDeck: (100 / totalWeight) * 100 + (50 / totalWeight) * 3000, // both contribute (confidence no longer excludes)
        snapshotFetchedAt: "2025-01-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        baseRate: 90,
        baseRateSource: "maxVolumeRate" as BaseRateSource,
      };
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const lowConfBefore = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "LowConf")!;
      expect(lowConfBefore.confidence).toBe(3);
      expect(lowConfBefore.excludeFromEv).toBe(false);

      store.getState().profitForecast.toggleCardExclusion("LowConf");

      const lowConfAfter = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "LowConf")!;
      expect(lowConfAfter.userOverride).toBe(true);
      expect(lowConfAfter.excludeFromEv).toBe(true);
    });

    it("double toggle on anomalous card restores auto-excluded state", async () => {
      const totalWeight = 150;
      const dto: ProfitForecastDataDTO = {
        rows: [
          makeRowDTO({
            cardName: "Normal",
            weight: 100,
            fromBoss: false,
            probability: 100 / totalWeight,
            chaosValue: 100,
            divineValue: 0.5,
            evContribution: (100 / totalWeight) * 100,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
          }),
          makeRowDTO({
            cardName: "Anomalous",
            weight: 50,
            fromBoss: false,
            probability: 50 / totalWeight,
            chaosValue: 5000,
            divineValue: 25,
            evContribution: (50 / totalWeight) * 5000,
            hasPrice: true,
            confidence: 1,
            isAnomalous: true,
            excludeFromEv: true,
          }),
        ],
        totalWeight,
        evPerDeck: (100 / totalWeight) * 100,
        snapshotFetchedAt: "2025-01-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        baseRate: 90,
        baseRateSource: "maxVolumeRate" as BaseRateSource,
      };
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const evBefore = store.getState().profitForecast.evPerDeck;

      // Toggle on then off
      store.getState().profitForecast.toggleCardExclusion("Anomalous");
      store.getState().profitForecast.toggleCardExclusion("Anomalous");

      const anom = store
        .getState()
        .profitForecast.rows.find((r) => r.cardName === "Anomalous")!;
      expect(anom.userOverride).toBe(false);
      expect(anom.excludeFromEv).toBe(true); // back to auto-excluded
      expect(store.getState().profitForecast.evPerDeck).toBeCloseTo(
        evBefore,
        8,
      );
    });
  });

  describe("getExcludedCount with userOverride", () => {
    it("counts user-overridden cards separately from anomalous and low-confidence", async () => {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      // Before any user override
      const countBefore = store.getState().profitForecast.getExcludedCount();
      expect(countBefore.userOverridden).toBe(0);

      // Exclude a normal card manually
      store.getState().profitForecast.toggleCardExclusion("The Doctor");

      const countAfter = store.getState().profitForecast.getExcludedCount();
      expect(countAfter.userOverridden).toBe(1);
      expect(countAfter.total).toBe(
        countAfter.anomalous +
          countAfter.lowConfidence +
          countAfter.userOverridden,
      );
    });

    it("un-overriding a card decrements the userOverridden count", async () => {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      store.getState().profitForecast.toggleCardExclusion("The Doctor");
      expect(
        store.getState().profitForecast.getExcludedCount().userOverridden,
      ).toBe(1);

      store.getState().profitForecast.toggleCardExclusion("The Doctor");
      expect(
        store.getState().profitForecast.getExcludedCount().userOverridden,
      ).toBe(0);
    });

    it("multiple cards can be user-overridden simultaneously", async () => {
      const dto = makeDTO();
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      store.getState().profitForecast.toggleCardExclusion("The Doctor");
      store.getState().profitForecast.toggleCardExclusion("The Nurse");

      const count = store.getState().profitForecast.getExcludedCount();
      expect(count.userOverridden).toBe(2);
    });

    it("force-including an anomalous card counts as userOverridden, not anomalous", async () => {
      const totalWeight = 150;
      const dto: ProfitForecastDataDTO = {
        rows: [
          makeRowDTO({
            cardName: "Normal",
            weight: 100,
            fromBoss: false,
            probability: 100 / totalWeight,
            chaosValue: 100,
            divineValue: 0.5,
            evContribution: (100 / totalWeight) * 100,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
          }),
          makeRowDTO({
            cardName: "Anomalous",
            weight: 50,
            fromBoss: false,
            probability: 50 / totalWeight,
            chaosValue: 5000,
            divineValue: 25,
            evContribution: (50 / totalWeight) * 5000,
            hasPrice: true,
            confidence: 1,
            isAnomalous: true,
            excludeFromEv: true,
          }),
        ],
        totalWeight,
        evPerDeck: (100 / totalWeight) * 100,
        snapshotFetchedAt: "2025-01-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        baseRate: 90,
        baseRateSource: "maxVolumeRate" as BaseRateSource,
      };
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      // Before toggle: anomalous card counted under anomalous
      const countBefore = store.getState().profitForecast.getExcludedCount();
      expect(countBefore.anomalous).toBe(1);
      expect(countBefore.userOverridden).toBe(0);

      // Force-include the anomalous card
      store.getState().profitForecast.toggleCardExclusion("Anomalous");

      // After toggle: moved from anomalous to userOverridden
      const countAfter = store.getState().profitForecast.getExcludedCount();
      expect(countAfter.anomalous).toBe(0);
      expect(countAfter.userOverridden).toBe(1);
    });

    it("counts a low-confidence row under lowConfidence", async () => {
      const totalWeight = 200;
      const dto: ProfitForecastDataDTO = {
        rows: [
          makeRowDTO({
            cardName: "Normal",
            weight: 100,
            fromBoss: false,
            probability: 100 / totalWeight,
            chaosValue: 100,
            divineValue: 0.5,
            evContribution: (100 / totalWeight) * 100,
            hasPrice: true,
            confidence: 1,
            isAnomalous: false,
            excludeFromEv: false,
          }),
          makeRowDTO({
            cardName: "LowConf",
            weight: 100,
            fromBoss: false,
            probability: 100 / totalWeight,
            chaosValue: 200,
            divineValue: 1,
            evContribution: (100 / totalWeight) * 200,
            hasPrice: true,
            confidence: 3,
            isAnomalous: false,
            excludeFromEv: true,
          }),
        ],
        totalWeight,
        evPerDeck: (100 / totalWeight) * 100,
        snapshotFetchedAt: "2025-01-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        baseRate: 90,
        baseRateSource: "maxVolumeRate" as BaseRateSource,
      };
      electron.profitForecast.getData.mockResolvedValue(dto);
      await store.getState().profitForecast.fetchData("poe1", "Settlers");

      const count = store.getState().profitForecast.getExcludedCount();
      expect(count).toEqual({
        lowConfidence: 1,
        anomalous: 0,
        userOverridden: 0,
        total: 1,
      });
    });
  });
});
