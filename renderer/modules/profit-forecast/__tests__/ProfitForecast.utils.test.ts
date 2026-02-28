import { describe, expect, it } from "vitest";

import {
  formatChaos,
  formatDivine,
  formatPercent,
  formatPnL,
  formatPnLDivine,
} from "../ProfitForecast.utils";

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
