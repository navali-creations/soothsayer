// ─── Mapper Alignment Integration Tests ─────────────────────────────────────
//
// These tests verify that the coordinate-mapping functions used for drawing
// and the ones used for interaction hit-testing produce identical results
// when built from the same domains and layout.
//
// This guards against the #1 bug class in canvas charts: draw and interaction
// code disagreeing on where a data point maps to in pixel space.

import { describe, expect, it } from "vitest";

import {
  computeDomains,
  computeLayout,
} from "~/renderer/components/CombinedChartCanvas/canvas-chart-utils/canvas-chart-utils";
import {
  computeTimelineDomains,
  computeTimelineLayout,
} from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/canvas-utils/canvas-utils";

import { createLinearMapper } from "./canvas-primitives";

// ─── Combined Chart: mapper alignment ───────────────────────────────────────

describe("Combined Chart mapper alignment", () => {
  // Build mappers the same way CombinedChartCanvas.tsx does
  function buildCombinedMappers(
    chartData: { profitDivine: number; rawDecks: number | null }[],
    canvasWidth: number,
    canvasHeight: number,
    showBrush: boolean,
  ) {
    const hiddenMetrics = new Set<string>();
    const domains = computeDomains(chartData, chartData, hiddenMetrics);
    const layout = computeLayout(canvasWidth, canvasHeight, showBrush);

    // mapX in Combined chart maps a visible-slice index to pixel X
    const numVisible = chartData.length;
    const mapX = (index: number): number => {
      if (numVisible <= 1) return layout.chartLeft + layout.chartWidth / 2;
      return layout.chartLeft + (index / (numVisible - 1)) * layout.chartWidth;
    };

    // mapProfitY maps profit value to pixel Y
    const mapProfitY = (value: number): number => {
      const { min, max } = domains.profit;
      const range = max - min || 1;
      const frac = (value - min) / range;
      return layout.chartBottom - frac * layout.chartHeight;
    };

    // mapDecksY maps decks value to pixel Y
    const mapDecksY = (value: number): number => {
      const { min, max } = domains.decks;
      const range = max - min || 1;
      const frac = (value - min) / range;
      return layout.chartBottom - frac * layout.chartHeight;
    };

    return { domains, layout, mapX, mapProfitY, mapDecksY };
  }

  it("mapX(i) and createLinearMapper agree for index-based mapping", () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      profitDivine: Math.sin(i) * 10,
      rawDecks: i * 5,
    }));

    const { layout, mapX } = buildCombinedMappers(data, 800, 400, true);

    // Build equivalent mapper from createLinearMapper
    const mapper = createLinearMapper(
      0,
      data.length - 1,
      layout.chartLeft,
      layout.chartLeft + layout.chartWidth,
    );

    for (let i = 0; i < data.length; i++) {
      expect(mapper(i)).toBeCloseTo(mapX(i), 6);
    }
  });

  it("inverse of mapX recovers the original index", () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      profitDivine: i * 2,
      rawDecks: i * 3,
    }));

    const { layout } = buildCombinedMappers(data, 800, 400, false);

    const mapper = createLinearMapper(
      0,
      data.length - 1,
      layout.chartLeft,
      layout.chartLeft + layout.chartWidth,
    );

    for (let i = 0; i < data.length; i++) {
      const px = mapper(i);
      const recovered = mapper.inverse(px);
      expect(recovered).toBeCloseTo(i, 6);
    }
  });

  it("mapProfitY and createLinearMapper agree", () => {
    const data = [
      { profitDivine: -5, rawDecks: 10 },
      { profitDivine: 15, rawDecks: 20 },
      { profitDivine: -2, rawDecks: 15 },
    ];

    const { domains, layout, mapProfitY } = buildCombinedMappers(
      data,
      600,
      300,
      false,
    );

    // Y-axis is inverted: domain min → chartBottom, domain max → chartTop
    const mapper = createLinearMapper(
      domains.profit.min,
      domains.profit.max,
      layout.chartBottom,
      layout.chartTop,
    );

    for (const pt of data) {
      expect(mapper(pt.profitDivine)).toBeCloseTo(
        mapProfitY(pt.profitDivine),
        6,
      );
    }
  });

  it("mapDecksY and createLinearMapper agree", () => {
    const data = [
      { profitDivine: 1, rawDecks: 5 },
      { profitDivine: 2, rawDecks: 50 },
      { profitDivine: 3, rawDecks: 25 },
    ];

    const { domains, layout, mapDecksY } = buildCombinedMappers(
      data,
      600,
      300,
      false,
    );

    const mapper = createLinearMapper(
      domains.decks.min,
      domains.decks.max,
      layout.chartBottom,
      layout.chartTop,
    );

    for (const pt of data) {
      if (pt.rawDecks != null) {
        expect(mapper(pt.rawDecks)).toBeCloseTo(mapDecksY(pt.rawDecks), 6);
      }
    }
  });

  it("hover hit-test resolves to correct index via inverse mapper", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      profitDivine: i * 3,
      rawDecks: i * 2,
    }));

    const { layout } = buildCombinedMappers(data, 800, 400, false);

    const mapper = createLinearMapper(
      0,
      data.length - 1,
      layout.chartLeft,
      layout.chartLeft + layout.chartWidth,
    );

    // Simulate: draw at index 5, mouse clicks at that pixel
    const targetIndex = 5;
    const pixelX = mapper(targetIndex);
    const recoveredIndex = Math.round(mapper.inverse(pixelX));
    expect(recoveredIndex).toBe(targetIndex);
  });
});

// ─── Timeline Chart: mapper alignment ───────────────────────────────────────

describe("Timeline Chart mapper alignment", () => {
  function buildTimelineMappers(
    linePoints: { x: number; profit: number }[],
    chartData: {
      x: number;
      profit: number;
      barValue: number | null;
      cardName: string | null;
      rarity: 1 | 2 | 3 | null;
    }[],
    canvasWidth: number,
    canvasHeight: number,
  ) {
    const layout = computeTimelineLayout(canvasWidth, canvasHeight);
    const domains = computeTimelineDomains(linePoints, chartData);

    // mapX as built inside SessionProfitTimeline's draw() callback
    const mapX = (value: number): number => {
      const range = domains.x.max - domains.x.min || 1;
      const frac = (value - domains.x.min) / range;
      return layout.chartLeft + frac * layout.chartWidth;
    };

    // mapY as built inside SessionProfitTimeline's draw() callback
    const mapY = (value: number): number => {
      const range = domains.y.max - domains.y.min || 1;
      const frac = (value - domains.y.min) / range;
      return layout.chartBottom - frac * layout.chartHeight;
    };

    return { domains, layout, mapX, mapY };
  }

  it("mapX and createLinearMapper agree for domain-value mapping", () => {
    const linePoints = [
      { x: 0, profit: 0 },
      { x: 50, profit: 10 },
      { x: 100, profit: -5 },
    ];
    const chartData = linePoints.map((lp) => ({
      ...lp,
      barValue: null,
      cardName: null,
      rarity: null as 1 | 2 | 3 | null,
    }));

    const { domains, layout, mapX } = buildTimelineMappers(
      linePoints,
      chartData,
      700,
      350,
    );

    const mapper = createLinearMapper(
      domains.x.min,
      domains.x.max,
      layout.chartLeft,
      layout.chartLeft + layout.chartWidth,
    );

    for (const pt of linePoints) {
      expect(mapper(pt.x)).toBeCloseTo(mapX(pt.x), 6);
    }
  });

  it("mapY and createLinearMapper agree for domain-value mapping", () => {
    const linePoints = [
      { x: 0, profit: -20 },
      { x: 50, profit: 30 },
      { x: 100, profit: 10 },
    ];
    const chartData = linePoints.map((lp) => ({
      ...lp,
      barValue: null,
      cardName: null,
      rarity: null as 1 | 2 | 3 | null,
    }));

    const { domains, layout, mapY } = buildTimelineMappers(
      linePoints,
      chartData,
      700,
      350,
    );

    const mapper = createLinearMapper(
      domains.y.min,
      domains.y.max,
      layout.chartBottom,
      layout.chartTop,
    );

    for (const pt of linePoints) {
      expect(mapper(pt.profit)).toBeCloseTo(mapY(pt.profit), 6);
    }
  });

  it("inverse of timeline mapX recovers the original domain value", () => {
    const linePoints = [
      { x: 0, profit: 0 },
      { x: 200, profit: 50 },
    ];
    const chartData = linePoints.map((lp) => ({
      ...lp,
      barValue: null,
      cardName: null,
      rarity: null as 1 | 2 | 3 | null,
    }));

    const { domains, layout } = buildTimelineMappers(
      linePoints,
      chartData,
      700,
      350,
    );

    const mapper = createLinearMapper(
      domains.x.min,
      domains.x.max,
      layout.chartLeft,
      layout.chartLeft + layout.chartWidth,
    );

    // Test round-trip at several domain values
    for (const val of [0, 50, 100, 150, 200]) {
      const px = mapper(val);
      expect(mapper.inverse(px)).toBeCloseTo(val, 6);
    }
  });

  it("hover at bar pixel position resolves to correct chart data index", () => {
    const chartData = [
      {
        x: 0,
        profit: 0,
        barValue: null,
        cardName: null,
        rarity: null as 1 | 2 | 3 | null,
      },
      {
        x: 25,
        profit: 5,
        barValue: 10,
        cardName: "Card A",
        rarity: 2 as 1 | 2 | 3 | null,
      },
      {
        x: 50,
        profit: 8,
        barValue: null,
        cardName: null,
        rarity: null as 1 | 2 | 3 | null,
      },
      {
        x: 75,
        profit: 3,
        barValue: -5,
        cardName: "Card B",
        rarity: 1 as 1 | 2 | 3 | null,
      },
      {
        x: 100,
        profit: 10,
        barValue: null,
        cardName: null,
        rarity: null as 1 | 2 | 3 | null,
      },
    ];
    const linePoints = chartData.map((d) => ({ x: d.x, profit: d.profit }));

    const { domains, layout } = buildTimelineMappers(
      linePoints,
      chartData,
      700,
      350,
    );

    const mapper = createLinearMapper(
      domains.x.min,
      domains.x.max,
      layout.chartLeft,
      layout.chartLeft + layout.chartWidth,
    );

    // Draw a bar at index 1 (x=25) and index 3 (x=75)
    const bar1Px = mapper(25);
    const bar3Px = mapper(75);

    // Simulate mouse near bar1 — find nearest bar
    const cursorX = bar1Px + 3; // 3px off
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].barValue == null) continue;
      const px = mapper(chartData[i].x);
      const dist = Math.abs(cursorX - px);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    expect(bestIdx).toBe(1);
    expect(bestDist).toBeCloseTo(3, 6);

    // Simulate mouse near bar3
    const cursorX2 = bar3Px - 5;
    bestIdx = -1;
    bestDist = Infinity;
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].barValue == null) continue;
      const px = mapper(chartData[i].x);
      const dist = Math.abs(cursorX2 - px);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    expect(bestIdx).toBe(3);
    expect(bestDist).toBeCloseTo(5, 6);
  });
});
