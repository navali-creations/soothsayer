import { describe, expect, it } from "vitest";

import {
  buildXAxisProps,
  type ChartColors,
  formatChaos,
  formatDecks,
  formatDivine,
  gradientId,
  METRICS,
  type RawDataPoint,
  resolveColor,
  transformChartData,
} from "./chart-types";

// ---------------------------------------------------------------------------
// formatDivine
// ---------------------------------------------------------------------------
describe("formatDivine", () => {
  it("formats values >= 10 with 1 decimal place", () => {
    expect(formatDivine(10)).toBe("10.0 div");
    expect(formatDivine(15.678)).toBe("15.7 div");
    expect(formatDivine(100)).toBe("100.0 div");
    expect(formatDivine(999.99)).toBe("1000.0 div");
  });

  it("formats values < 10 with 2 decimal places", () => {
    expect(formatDivine(0.5)).toBe("0.50 div");
    expect(formatDivine(1)).toBe("1.00 div");
    expect(formatDivine(9.999)).toBe("10.00 div");
    expect(formatDivine(3.75)).toBe("3.75 div");
  });

  it("formats zero", () => {
    expect(formatDivine(0)).toBe("0.00 div");
  });

  it("formats negative values >= 10 in absolute value with 1 decimal", () => {
    expect(formatDivine(-10)).toBe("-10.0 div");
    expect(formatDivine(-25.678)).toBe("-25.7 div");
  });

  it("formats negative values < 10 in absolute value with 2 decimals", () => {
    expect(formatDivine(-1)).toBe("-1.00 div");
    expect(formatDivine(-9.5)).toBe("-9.50 div");
    expect(formatDivine(-0.123)).toBe("-0.12 div");
  });
});

// ---------------------------------------------------------------------------
// formatChaos
// ---------------------------------------------------------------------------
describe("formatChaos", () => {
  it("formats positive values with rounding and 'c' suffix", () => {
    expect(formatChaos(100)).toBe("100 c");
    expect(formatChaos(99.4)).toBe("99 c");
    expect(formatChaos(99.5)).toBe("100 c");
  });

  it("formats zero", () => {
    expect(formatChaos(0)).toBe("0 c");
  });

  it("formats negative values", () => {
    expect(formatChaos(-50)).toBe("-50 c");
    expect(formatChaos(-1.7)).toBe("-2 c");
  });

  it("formats large numbers with locale string separators", () => {
    const result = formatChaos(1234567);
    // toLocaleString output is locale-dependent, but the value should contain
    // the digits and end with " c"
    expect(result).toContain("c");
    expect(result).toBe(`${Math.round(1234567).toLocaleString()} c`);
  });
});

// ---------------------------------------------------------------------------
// formatDecks
// ---------------------------------------------------------------------------
describe("formatDecks", () => {
  it('returns "0" for null', () => {
    expect(formatDecks(null)).toBe("0");
  });

  it('returns "0" for 0', () => {
    expect(formatDecks(0)).toBe("0");
  });

  it("returns integer string for whole numbers", () => {
    expect(formatDecks(5)).toBe("5");
    expect(formatDecks(42)).toBe("42");
    expect(formatDecks(1)).toBe("1");
  });

  it("returns 1-decimal string for fractional numbers", () => {
    expect(formatDecks(3.5)).toBe("3.5");
    expect(formatDecks(1.23)).toBe("1.2");
    expect(formatDecks(0.7)).toBe("0.7");
  });
});

// ---------------------------------------------------------------------------
// transformChartData
// ---------------------------------------------------------------------------
describe("transformChartData", () => {
  it("returns empty array for empty input", () => {
    expect(transformChartData([])).toEqual([]);
  });

  it("transforms a single data point correctly", () => {
    const raw: RawDataPoint[] = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 60,
        totalDecksOpened: 5,
        exchangeNetProfit: 500,
        chaosPerDivine: 250,
      },
    ];

    const result = transformChartData(raw);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      sessionIndex: 1,
      sessionDate: "2024-01-01",
      league: "Standard",
      chaosPerDivine: 250,
      profitDivine: 2, // 500 / 250
      profitChaos: 500,
      rawDecks: 5,
    });
  });

  it("transforms multiple data points", () => {
    const raw: RawDataPoint[] = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 30,
        totalDecksOpened: 3,
        exchangeNetProfit: 300,
        chaosPerDivine: 100,
      },
      {
        sessionIndex: 2,
        sessionDate: "2024-01-02",
        league: "Standard",
        durationMinutes: 45,
        totalDecksOpened: 10,
        exchangeNetProfit: 1000,
        chaosPerDivine: 200,
      },
    ];

    const result = transformChartData(raw);

    expect(result).toHaveLength(2);
    expect(result[0].profitDivine).toBe(3); // 300 / 100
    expect(result[0].rawDecks).toBe(3);
    expect(result[1].profitDivine).toBe(5); // 1000 / 200
    expect(result[1].rawDecks).toBe(10);
  });

  it("sets profitDivine to 0 when chaosPerDivine is 0", () => {
    const raw: RawDataPoint[] = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 60,
        totalDecksOpened: 5,
        exchangeNetProfit: 500,
        chaosPerDivine: 0,
      },
    ];

    const result = transformChartData(raw);

    expect(result[0].profitDivine).toBe(0);
    expect(result[0].profitChaos).toBe(500);
  });

  it("sets rawDecks to null when totalDecksOpened is 0", () => {
    const raw: RawDataPoint[] = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 60,
        totalDecksOpened: 0,
        exchangeNetProfit: 500,
        chaosPerDivine: 250,
      },
    ];

    const result = transformChartData(raw);

    expect(result[0].rawDecks).toBeNull();
  });

  it("preserves all pass-through fields", () => {
    const raw: RawDataPoint[] = [
      {
        sessionIndex: 42,
        sessionDate: "2024-06-15",
        league: "Necropolis",
        durationMinutes: 120,
        totalDecksOpened: 7,
        exchangeNetProfit: 700,
        chaosPerDivine: 175,
      },
    ];

    const result = transformChartData(raw);

    expect(result[0].sessionIndex).toBe(42);
    expect(result[0].sessionDate).toBe("2024-06-15");
    expect(result[0].league).toBe("Necropolis");
    expect(result[0].chaosPerDivine).toBe(175);
  });

  it("handles negative exchangeNetProfit", () => {
    const raw: RawDataPoint[] = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 60,
        totalDecksOpened: 2,
        exchangeNetProfit: -400,
        chaosPerDivine: 200,
      },
    ];

    const result = transformChartData(raw);

    expect(result[0].profitDivine).toBe(-2); // -400 / 200
    expect(result[0].profitChaos).toBe(-400);
  });
});

// ---------------------------------------------------------------------------
// resolveColor
// ---------------------------------------------------------------------------
describe("resolveColor", () => {
  const mockColors: ChartColors = {
    primary: "#ff0000",
    success: "#00ff00",
    warning: "#ffff00",
    secondary: "#0000ff",
    bc10: "#111111",
    bc30: "#333333",
  } as ChartColors;

  it('resolves "primary"', () => {
    expect(resolveColor(mockColors, "primary")).toBe("#ff0000");
  });

  it('resolves "success"', () => {
    expect(resolveColor(mockColors, "success")).toBe("#00ff00");
  });

  it('resolves "warning"', () => {
    expect(resolveColor(mockColors, "warning")).toBe("#ffff00");
  });

  it('resolves "secondary"', () => {
    expect(resolveColor(mockColors, "secondary")).toBe("#0000ff");
  });

  it("falls back to primary for unknown colorVar", () => {
    expect(resolveColor(mockColors, "nonexistent")).toBe("#ff0000");
    expect(resolveColor(mockColors, "")).toBe("#ff0000");
    expect(resolveColor(mockColors, "danger")).toBe("#ff0000");
  });
});

// ---------------------------------------------------------------------------
// gradientId
// ---------------------------------------------------------------------------
describe("gradientId", () => {
  it("generates the expected gradient ID string", () => {
    expect(gradientId("profit")).toBe("statChartGrad_profit");
    expect(gradientId("decks")).toBe("statChartGrad_decks");
    expect(gradientId("")).toBe("statChartGrad_");
    expect(gradientId("some-key")).toBe("statChartGrad_some-key");
  });
});

// ---------------------------------------------------------------------------
// buildXAxisProps
// ---------------------------------------------------------------------------
describe("buildXAxisProps", () => {
  const mockColors: ChartColors = {
    primary: "#ff0000",
    success: "#00ff00",
    warning: "#ffff00",
    secondary: "#0000ff",
    bc10: "#111111",
    bc30: "#333333",
  } as ChartColors;

  it("returns correct dataKey", () => {
    const props = buildXAxisProps(mockColors);
    expect(props.dataKey).toBe("sessionIndex");
  });

  it("uses bc10 for stroke", () => {
    const props = buildXAxisProps(mockColors);
    expect(props.stroke).toBe("#111111");
  });

  it("sets fontSize to 10", () => {
    const props = buildXAxisProps(mockColors);
    expect(props.fontSize).toBe(10);
  });

  it("disables tickLine", () => {
    const props = buildXAxisProps(mockColors);
    expect(props.tickLine).toBe(false);
  });

  it("uses bc30 for tick fill", () => {
    const props = buildXAxisProps(mockColors);
    expect(props.tick).toEqual({ fill: "#333333" });
  });

  it('sets interval to "preserveStartEnd"', () => {
    const props = buildXAxisProps(mockColors);
    expect(props.interval).toBe("preserveStartEnd");
  });

  it("returns all expected keys", () => {
    const props = buildXAxisProps(mockColors);
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining([
        "dataKey",
        "stroke",
        "fontSize",
        "tickLine",
        "tick",
        "interval",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// METRICS
// ---------------------------------------------------------------------------
describe("METRICS", () => {
  it("contains exactly 2 metric configurations", () => {
    expect(METRICS).toHaveLength(2);
  });

  it('has a "decks" metric at index 0', () => {
    const decks = METRICS[0];
    expect(decks.key).toBe("decks");
    expect(decks.rawDataKey).toBe("rawDecks");
    expect(decks.label).toBe("Decks Opened");
    expect(decks.colorVar).toBe("secondary");
    expect(decks.yAxisId).toBe("decks");
    expect(decks.rawVisual).toBe("scatter");
  });

  it('has a "profit" metric at index 1', () => {
    const profit = METRICS[1];
    expect(profit.key).toBe("profit");
    expect(profit.rawDataKey).toBe("profitDivine");
    expect(profit.label).toBe("Profit");
    expect(profit.colorVar).toBe("secondary");
    expect(profit.yAxisId).toBe("profit");
    expect(profit.rawVisual).toBe("area");
  });

  it("decks formatValue delegates to formatDecks", () => {
    const decks = METRICS[0];
    expect(decks.formatValue(0)).toBe("0");
    expect(decks.formatValue(5)).toBe("5");
    expect(decks.formatValue(3.5)).toBe("3.5");
  });

  it("profit formatValue delegates to formatDivine", () => {
    const profit = METRICS[1];
    expect(profit.formatValue(15)).toBe("15.0 div");
    expect(profit.formatValue(3.14)).toBe("3.14 div");
    expect(profit.formatValue(0)).toBe("0.00 div");
  });
});
