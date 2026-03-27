import { describe, expect, it } from "vitest";

import {
  computeBatchEv,
  computeCardCertainty,
  computeConfidenceInterval,
  computePnLCurve,
  formatChaos,
  formatDivine,
  formatPercent,
  formatPnL,
  formatPnLDivine,
} from "./ProfitForecast.utils";

// ── formatChaos ────────────────────────────────────────────────────────────────

describe("formatChaos", () => {
  it("formats values >= 1,000,000 as M with 2 decimals by default", () => {
    expect(formatChaos(3_450_000)).toBe("3.45M c");
  });

  it("formats exactly 1,000,000", () => {
    expect(formatChaos(1_000_000)).toBe("1.00M c");
  });

  it("respects custom decimals for millions", () => {
    expect(formatChaos(3_450_000, 0)).toBe("3M c");
    expect(formatChaos(3_450_000, 3)).toBe("3.450M c");
  });

  it("formats values >= 1,000 with commas and 0 decimals by default", () => {
    expect(formatChaos(34500)).toBe("34,500 c");
  });

  it("formats exactly 1,000", () => {
    expect(formatChaos(1000)).toBe("1,000 c");
  });

  it("respects custom decimals for thousands", () => {
    expect(formatChaos(1234.56, 2)).toBe("1,234.56 c");
  });

  it("formats small values with 2 decimals by default", () => {
    expect(formatChaos(3.456)).toBe("3.46 c");
  });

  it("formats 0", () => {
    expect(formatChaos(0)).toBe("0.00 c");
  });

  it("respects custom decimals for small values", () => {
    expect(formatChaos(0.5, 4)).toBe("0.5000 c");
  });

  it("handles negative values >= 1,000,000", () => {
    expect(formatChaos(-2_500_000)).toBe("-2.50M c");
  });

  it("handles negative values >= 1,000", () => {
    expect(formatChaos(-5000)).toBe("-5,000 c");
  });

  it("handles negative small values", () => {
    expect(formatChaos(-3.14)).toBe("-3.14 c");
  });
});

// ── formatDivine ───────────────────────────────────────────────────────────────

describe("formatDivine", () => {
  it("returns '— d' when ratio is 0", () => {
    expect(formatDivine(1000, 0)).toBe("— d");
  });

  it("returns '— d' when ratio is negative", () => {
    expect(formatDivine(1000, -100)).toBe("— d");
  });

  it("formats values >= 1,000 divine as 'k d'", () => {
    // 300,000 chaos / 200 ratio = 1,500 divine
    expect(formatDivine(300_000, 200)).toBe("1.5k d");
  });

  it("formats values >= 100 divine with 1 decimal", () => {
    // 25,000 chaos / 200 ratio = 125 divine
    expect(formatDivine(25_000, 200)).toBe("125.0 d");
  });

  it("formats values < 100 divine with 2 decimals", () => {
    // 1,380 chaos / 200 ratio = 6.9 divine
    expect(formatDivine(1_380, 200)).toBe("6.90 d");
  });

  it("formats small divine values", () => {
    // 0.5 chaos / 200 ratio = 0.0025 divine
    expect(formatDivine(0.5, 200)).toBe("0.00 d");
  });

  it("handles negative chaos values", () => {
    // -20,000 chaos / 200 ratio = -100 divine → abs >= 100
    expect(formatDivine(-20_000, 200)).toBe("-100.0 d");
  });

  it("handles negative chaos values in the k range", () => {
    // -300,000 chaos / 200 ratio = -1,500 divine
    expect(formatDivine(-300_000, 200)).toBe("-1.5k d");
  });
});

// ── formatPercent ──────────────────────────────────────────────────────────────

describe("formatPercent", () => {
  it("formats a small probability with default 2 decimals", () => {
    expect(formatPercent(0.00312)).toBe("0.31%");
  });

  it("formats a large probability", () => {
    expect(formatPercent(0.632)).toBe("63.20%");
  });

  it("formats 0", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("formats 1 (100%)", () => {
    expect(formatPercent(1)).toBe("100.00%");
  });

  it("respects custom decimals", () => {
    expect(formatPercent(0.00312, 4)).toBe("0.3120%");
  });

  it("formats with 0 decimals", () => {
    expect(formatPercent(0.632, 0)).toBe("63%");
  });
});

// ── formatPnL ──────────────────────────────────────────────────────────────────

describe("formatPnL", () => {
  it("formats positive values with + sign", () => {
    expect(formatPnL(2273)).toBe("+2,273 c");
  });

  it("formats negative values with − (U+2212) sign", () => {
    expect(formatPnL(-450)).toBe("\u2212450 c");
  });

  it("formats zero with + sign", () => {
    expect(formatPnL(0)).toBe("+0 c");
  });

  it("formats millions with M suffix", () => {
    expect(formatPnL(3_450_000)).toBe("+3.45M c");
  });

  it("formats negative millions with − and M suffix", () => {
    expect(formatPnL(-2_500_000)).toBe("\u22122.50M c");
  });

  it("rounds to nearest integer for non-million values", () => {
    expect(formatPnL(1234.56)).toBe("+1,235 c");
  });

  it("handles large values with commas", () => {
    expect(formatPnL(999_999)).toBe("+999,999 c");
  });

  it("handles small negative values", () => {
    expect(formatPnL(-5)).toBe("\u22125 c");
  });
});

// ── formatPnLDivine ────────────────────────────────────────────────────────────

describe("formatPnLDivine", () => {
  it("returns '— d' when ratio is 0", () => {
    expect(formatPnLDivine(1000, 0)).toBe("— d");
  });

  it("returns '— d' when ratio is negative", () => {
    expect(formatPnLDivine(1000, -50)).toBe("— d");
  });

  it("formats positive divine P&L with + sign", () => {
    // 1,134 chaos / 200 ratio = 5.67 divine
    expect(formatPnLDivine(1_134, 200)).toBe("+5.67 d");
  });

  it("formats negative divine P&L with − (U+2212) sign", () => {
    // -468 chaos / 200 ratio = -2.34 divine
    expect(formatPnLDivine(-468, 200)).toBe("\u22122.34 d");
  });

  it("formats zero chaos as +0.00 d", () => {
    expect(formatPnLDivine(0, 200)).toBe("+0.00 d");
  });

  it("formats large divine values >= 1,000 as 'k'", () => {
    // 240,000 chaos / 200 ratio = 1,200 divine
    expect(formatPnLDivine(240_000, 200)).toBe("+1.2k d");
  });

  it("formats negative large divine values >= 1,000 as 'k'", () => {
    // -240,000 chaos / 200 ratio = -1,200 divine
    expect(formatPnLDivine(-240_000, 200)).toBe("\u22121.2k d");
  });

  it("formats divine values >= 100 with 1 decimal", () => {
    // 25,000 chaos / 200 ratio = 125 divine
    expect(formatPnLDivine(25_000, 200)).toBe("+125.0 d");
  });

  it("formats negative divine values >= 100 with 1 decimal", () => {
    // -25,000 chaos / 200 ratio = -125 divine
    expect(formatPnLDivine(-25_000, 200)).toBe("\u2212125.0 d");
  });

  it("formats divine values < 100 with 2 decimals", () => {
    // 1,380 chaos / 200 ratio = 6.9 divine
    expect(formatPnLDivine(1_380, 200)).toBe("+6.90 d");
  });
});

// ── computeCardCertainty ───────────────────────────────────────────────────────

describe("computeCardCertainty", () => {
  it("returns 0 for p=0", () => {
    expect(computeCardCertainty(0, 1000)).toBe(0);
  });

  it("returns 1 for p=1", () => {
    expect(computeCardCertainty(1, 1000)).toBe(1);
  });

  it("returns ~0.6321 for p=0.001, N=1000 (1 - e^-1)", () => {
    const result = computeCardCertainty(0.001, 1000);
    expect(result).toBeCloseTo(1 - Math.exp(-1), 3);
  });

  it("returns exact value for known p/N", () => {
    // p=0.5, N=3 → 1 - 0.5^3 = 0.875
    expect(computeCardCertainty(0.5, 3)).toBeCloseTo(0.875, 6);
  });

  it("approaches 1 for large N", () => {
    const result = computeCardCertainty(0.01, 1000);
    expect(result).toBeGreaterThan(0.99);
  });

  it("is small for very rare cards in small batches", () => {
    // p = 0.0001, N = 100 → ~0.00995
    const result = computeCardCertainty(0.0001, 100);
    expect(result).toBeCloseTo(0.00995, 3);
  });

  it("handles negative probability by returning 0", () => {
    expect(computeCardCertainty(-0.5, 1000)).toBe(0);
  });
});

// ── computeBatchEv ─────────────────────────────────────────────────────────────

describe("computeBatchEv", () => {
  it("returns correct revenue, cost, and netPnL for known inputs", () => {
    // evPerDeck=10, batch=1000, baseRate=90, stepDrop=2, subBatchSize=5000, chaosRatio=200
    const result = computeBatchEv(10, 1000, 90, 2, 5000, 200);
    expect(result.revenue).toBe(10000); // 10 * 1000
    expect(result.cost).toBeGreaterThan(0);
    expect(result.netPnL).toBeCloseTo(result.revenue - result.cost, 6);
  });

  it("with zero decks returns all zeros", () => {
    const result = computeBatchEv(10, 0, 90, 2, 5000, 200);
    expect(result.revenue).toBe(0);
    expect(result.cost).toBe(0);
    expect(result.netPnL).toBe(0);
  });

  it("revenue scales linearly with batch size", () => {
    const r1 = computeBatchEv(10, 1000, 90, 2, 5000, 200);
    const r2 = computeBatchEv(10, 2000, 90, 2, 5000, 200);
    expect(r2.revenue).toBe(r1.revenue * 2);
  });

  it("netPnL can be negative when cost exceeds revenue", () => {
    // Very high cost scenario: low baseRate means expensive decks
    const result = computeBatchEv(0.5, 10000, 25, 2, 5000, 200);
    expect(result.netPnL).toBeLessThan(0);
  });
});

// ── computeConfidenceInterval ──────────────────────────────────────────────────

describe("computeConfidenceInterval", () => {
  const rows = [
    {
      probability: 0.001,
      chaosValue: 50000,
      evContribution: 0.001 * 50000,
      hasPrice: true,
      excludeFromEv: false,
    }, // rare jackpot
    {
      probability: 0.5,
      chaosValue: 1,
      evContribution: 0.5 * 1,
      hasPrice: true,
      excludeFromEv: false,
    }, // common
    {
      probability: 0.3,
      chaosValue: 2,
      evContribution: 0.3 * 2,
      hasPrice: true,
      excludeFromEv: true,
    }, // excluded (anomalous)
  ];

  it("estimated ≤ optimistic", () => {
    const result = computeConfidenceInterval(rows, 1000);
    expect(result.estimated).toBeLessThanOrEqual(result.optimistic);
  });

  it("excluded rows are ignored by all tiers", () => {
    const result = computeConfidenceInterval(rows, 1000);
    // The excluded row (0.3 * 2 * 1000 = 600) should NOT appear in optimistic
    // Optimistic only includes non-excluded rows now
    const expectedWithoutExcluded = 0.001 * 50000 * 1000 + 0.5 * 1 * 1000; // 50000 + 500 = 50500
    expect(result.optimistic).toBeGreaterThan(result.estimated);
    // estimated should equal the non-excluded sum
    expect(result.estimated).toBeCloseTo(expectedWithoutExcluded, 2);
  });

  it("returns all zeros for empty rows", () => {
    const result = computeConfidenceInterval([], 1000);
    expect(result.estimated).toBe(0);
    expect(result.optimistic).toBe(0);
  });

  it("returns all zeros for zero batch size", () => {
    const result = computeConfidenceInterval(rows, 0);
    expect(result.estimated).toBe(0);
    expect(result.optimistic).toBe(0);
  });
});

// ── computePnLCurve ────────────────────────────────────────────────────────────

describe("computePnLCurve", () => {
  const rows = [
    {
      probability: 0.001,
      chaosValue: 50000,
      evContribution: 0.001 * 50000,
      hasPrice: true,
      excludeFromEv: false,
    },
    {
      probability: 0.5,
      chaosValue: 1,
      evContribution: 0.5 * 1,
      hasPrice: true,
      excludeFromEv: false,
    },
  ];

  it("returns correct number of data points", () => {
    const batchSizes = [1000, 5000, 10000, 50000, 100000];
    const result = computePnLCurve(rows, batchSizes, 90, 2, 5000, 200);
    expect(result).toHaveLength(5);
  });

  it("each point has deckCount matching input batch sizes", () => {
    const batchSizes = [1000, 10000];
    const result = computePnLCurve(rows, batchSizes, 90, 2, 5000, 200);
    expect(result[0].deckCount).toBe(1000);
    expect(result[1].deckCount).toBe(10000);
  });

  it("estimated ≤ optimistic for each data point", () => {
    const batchSizes = [1000, 5000, 10000];
    const result = computePnLCurve(rows, batchSizes, 90, 2, 5000, 200);
    for (const point of result) {
      expect(point.estimated).toBeLessThanOrEqual(point.optimistic);
    }
  });

  it("handles empty batch sizes array", () => {
    const result = computePnLCurve(rows, [], 90, 2, 5000, 200);
    expect(result).toHaveLength(0);
  });

  it("handles empty rows array", () => {
    const result = computePnLCurve([], [1000], 90, 2, 5000, 200);
    expect(result).toHaveLength(1);
    expect(result[0].estimated).toBeLessThan(0); // cost but no revenue
  });
});
