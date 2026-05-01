import { describe, expect, it, vi } from "vitest";

const mockDrawDonutIndicator = vi.hoisted(() => vi.fn());
const mockDrawMonotoneCurve = vi.hoisted(() => vi.fn());

vi.mock("~/renderer/lib/canvas-core", () => ({
  clamp: (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value)),
  drawDonutIndicator: mockDrawDonutIndicator,
  drawMonotoneCurve: mockDrawMonotoneCurve,
}));

import type { ChartDataPoint, LeagueMarker } from "../types";
import {
  buildAnticipatedSeries,
  buildXAxisLabels,
  computeLayout,
  computeTimeDomain,
  computeTooltipStyle,
  drawAxes,
  drawBarLabels,
  drawBars,
  drawDecksOpenedLine,
  drawExpectedBars,
  drawGrid,
  drawHover,
  drawInactivityGap,
  drawReferenceLines,
  getChartPointKey,
  type Layout,
} from "./MainChart.utils";

function makePoint(overrides: Partial<ChartDataPoint> = {}): ChartDataPoint {
  return {
    time: 1000,
    count: 1,
    cumulativeCount: 1,
    totalDecksOpened: 10,
    league: "Settlers",
    sessionStartedAt: "2026-01-01T00:00:00Z",
    sessionId: "session-1",
    sessionCount: 1,
    ...overrides,
  };
}

function makeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    letterSpacing: "0px",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
  } as unknown as CanvasRenderingContext2D & { letterSpacing?: string };
}

const layout: Layout = {
  chartLeft: 44,
  chartRight: 356,
  chartTop: 8,
  chartBottom: 216,
  chartWidth: 312,
  chartHeight: 208,
};

const colors = {
  primary: "#f00",
  bc05: "rgba(255,255,255,0.05)",
  bc15: "rgba(255,255,255,0.15)",
  bc20: "rgba(255,255,255,0.2)",
  bc30: "rgba(255,255,255,0.3)",
  bc35: "rgba(255,255,255,0.35)",
  bc50: "rgba(255,255,255,0.5)",
  b2: "#222",
  success50: "rgba(0,255,0,0.5)",
} as any;

describe("MainChart.utils data helpers", () => {
  it("computes stable layouts for normal and tiny canvases", () => {
    expect(computeLayout(400, 240)).toEqual(layout);
    expect(computeLayout(20, 10)).toMatchObject({
      chartLeft: 44,
      chartRight: 44,
      chartTop: 8,
      chartBottom: 8,
      chartWidth: 0,
      chartHeight: 0,
    });
  });

  it("computes time domains for empty, single, and multi-point data", () => {
    expect(computeTimeDomain([])).toEqual({ min: 0, max: 1 });
    expect(computeTimeDomain([makePoint({ time: 10 })])).toEqual({
      min: 9,
      max: 11,
    });
    expect(
      computeTimeDomain([makePoint({ time: 10 }), makePoint({ time: 20 })]),
    ).toEqual({ min: 10, max: 20 });
  });

  it("positions tooltips inside the canvas and hides missing tooltip data", () => {
    expect(
      computeTooltipStyle({
        tooltip: { visible: false, x: 10, y: 10, dataPoint: makePoint() },
        tooltipSize: { width: 0, height: 0 },
        canvasSize: { width: 800, height: 240 },
      }),
    ).toEqual({ display: "none" });
    expect(
      computeTooltipStyle({
        tooltip: { visible: true, x: 10, y: 10, dataPoint: null },
        tooltipSize: { width: 0, height: 0 },
        canvasSize: { width: 800, height: 240 },
      }),
    ).toEqual({ display: "none" });

    expect(
      computeTooltipStyle({
        tooltip: { visible: true, x: 790, y: 235, dataPoint: makePoint() },
        tooltipSize: { width: 120, height: 80 },
        canvasSize: { width: 800, height: 240 },
      }),
    ).toMatchObject({
      position: "absolute",
      left: "658px",
      top: "143px",
      pointerEvents: "none",
    });
  });

  it("builds anticipated drops from real points only", () => {
    const negativeDecks = makePoint({
      time: 10,
      count: 1,
      totalDecksOpened: -100,
      sessionId: "negative",
    });
    const real = makePoint({
      time: 20,
      count: 2,
      totalDecksOpened: 20,
      sessionId: "real",
    });
    const result = buildAnticipatedSeries([
      makePoint({ isGap: true, count: 99, totalDecksOpened: 99 }),
      makePoint({ isBoundary: true, count: 99, totalDecksOpened: 99 }),
      real,
      negativeDecks,
    ]);

    expect(result.metricsByKey.get(getChartPointKey(negativeDecks))).toEqual({
      anticipatedDrops: 0,
    });
    expect(result.metricsByKey.get(getChartPointKey(real))).toEqual({
      anticipatedDrops: 3,
    });
    expect(
      buildAnticipatedSeries([makePoint({ isGap: true })]).metricsByKey.size,
    ).toBe(0);
  });

  it("builds x-axis labels by segment and gives start markers priority", () => {
    const labels = buildXAxisLabels(
      [
        makePoint({ time: 1 }),
        makePoint({ time: 2, isBoundary: true }),
        makePoint({ time: 3, isGap: true }),
        makePoint({ time: 4 }),
        makePoint({ time: 5 }),
      ],
      [
        { time: 5, label: "Start", type: "start" },
        { time: 6, label: "End", type: "end" },
        { time: Number.POSITIVE_INFINITY, label: "Bad", type: "start" },
      ],
    );

    expect(labels).toEqual([
      { time: 1 },
      { time: 4 },
      { time: 5, marker: true },
    ]);
  });
});

describe("MainChart.utils draw helpers", () => {
  it("draws grid lines and the zero reference line only when visible", () => {
    const ctx = makeCtx();

    drawGrid(
      ctx,
      layout,
      [-1, 0, 1],
      [1, 2, 3],
      (value) => (value === 0 ? 100 : 500),
      (value) => value,
      "#333",
      "#fff",
    );

    expect(ctx.strokeRect).toHaveBeenCalledWith(44, 8, 312, 208);
    expect(ctx.moveTo).toHaveBeenCalledWith(44, 100);
    expect(ctx.lineTo).toHaveBeenCalledWith(356, 100);

    vi.clearAllMocks();
    drawGrid(
      ctx,
      layout,
      [-2, -1],
      [1, 2],
      () => 500,
      (value) => value,
      "#333",
      "#fff",
    );
    expect(ctx.moveTo).not.toHaveBeenCalledWith(44, 500);
  });

  it("draws axes while respecting hidden metrics and marker label priority", () => {
    const ctx = makeCtx();
    const hidden = new Set(["drops-per-day", "anticipated"] as const);

    drawAxes(
      ctx,
      layout,
      [0, 1, 2],
      [0, 1000],
      [{ time: 10, marker: true }, { time: 11 }, { time: 20 }],
      (value) => 200 - value,
      (value) => 200 - value / 10,
      (value) => value * 10,
      hidden,
      colors,
    );

    expect(ctx.fillText).not.toHaveBeenCalledWith(
      "1",
      expect.any(Number),
      expect.any(Number),
    );
    expect(ctx.fillText).toHaveBeenCalledWith("1k", 362, 100);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("draws valid reference lines and restores canvas letter spacing", () => {
    const ctx = makeCtx();
    const markers: LeagueMarker[] = [
      { time: Number.NaN, label: "bad", type: "start" },
      { time: 0, label: "offscreen", type: "start" },
      { time: 10, label: "league start", type: "start" },
      { time: 20, label: "league end", type: "end", emphasis: "muted" },
    ];

    drawReferenceLines(ctx, layout, markers, (value) => value * 10, colors);

    expect(ctx.fillText).toHaveBeenCalledWith("LEAGUE START", 0, 0);
    expect(ctx.fillText).toHaveBeenCalledWith("LEAGUE END", 0, 0);
    expect(ctx.letterSpacing).toBe("0px");
  });

  it("draws deck lines as a segment for one point and a curve for many points", () => {
    const ctx = makeCtx();

    drawDecksOpenedLine(
      ctx,
      [makePoint({ time: 10, totalDecksOpened: 20 })],
      layout,
      (value) => value + 44,
      (value) => 200 - value,
      colors,
    );
    expect(ctx.moveTo).toHaveBeenCalledWith(50, 180);
    expect(ctx.lineTo).toHaveBeenCalledWith(58, 180);

    vi.clearAllMocks();
    mockDrawMonotoneCurve.mockClear();
    drawDecksOpenedLine(
      ctx,
      [
        makePoint({ time: 10, totalDecksOpened: 20 }),
        makePoint({ time: 20, totalDecksOpened: 30 }),
      ],
      layout,
      (value) => value * 10,
      (value) => 200 - value,
      colors,
    );
    expect(mockDrawMonotoneCurve).toHaveBeenCalled();
  });

  it("draws bars and suppresses invalid points", () => {
    const ctx = makeCtx();

    drawBars(
      ctx,
      [
        makePoint({ time: 10, count: 0 }),
        makePoint({ time: 20, count: 2, isGap: true }),
        makePoint({ time: 30, count: 3, isBoundary: true }),
        makePoint({ time: 40, count: 4 }),
      ],
      layout,
      (value) => value,
      (value) => 200 - value,
      colors,
    );

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
  });

  it("draws bar labels above the larger neighboring value", () => {
    const ctx = makeCtx();
    const first = makePoint({ time: 10, count: 2, sessionId: "first" });
    const second = makePoint({ time: 11, count: 5, sessionId: "second" });
    const metrics = new Map([
      [getChartPointKey(second), { anticipatedDrops: 8 }],
    ]);

    drawBarLabels(
      ctx,
      [first, second],
      metrics,
      layout,
      (value) => value,
      (value) => 200 - value,
      colors,
    );

    expect(ctx.fillText).not.toHaveBeenCalledWith(
      "2",
      expect.any(Number),
      expect.any(Number),
    );
    expect(ctx.fillText).toHaveBeenCalledWith("5", 11, 188);
  });

  it("ignores invalid neighboring points when suppressing crowded bar labels", () => {
    const ctx = makeCtx();

    drawBarLabels(
      ctx,
      [
        makePoint({ time: 10, count: 4, sessionId: "real" }),
        makePoint({ time: 11, count: 99, sessionId: "gap", isGap: true }),
        makePoint({
          time: 12,
          count: 99,
          sessionId: "boundary",
          isBoundary: true,
        }),
      ],
      null,
      layout,
      (value) => value,
      (value) => 200 - value,
      colors,
    );

    expect(ctx.fillText).toHaveBeenCalledWith("4", 10, 192);
  });

  it("draws expected bars only when anticipated drops exceed real drops", () => {
    const ctx = makeCtx();
    const low = makePoint({ time: 10, count: 5, sessionId: "low" });
    const high = makePoint({ time: 20, count: 1, sessionId: "high" });
    const invalid = makePoint({ time: 30, count: 1, sessionId: "invalid" });
    const metrics = new Map([
      [getChartPointKey(low), { anticipatedDrops: 4 }],
      [getChartPointKey(high), { anticipatedDrops: 6 }],
      [getChartPointKey(invalid), { anticipatedDrops: 7 }],
    ]);

    drawExpectedBars(
      ctx,
      [low, high, invalid, makePoint({ isGap: true })],
      metrics,
      layout,
      (value) => (value === 30 ? Number.POSITIVE_INFINITY : value),
      (value) => 200 - value,
      colors,
    );

    expect(ctx.clip).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
  });

  it("draws inactivity gap veils only for visible positive-width ranges", () => {
    const ctx = makeCtx();

    drawInactivityGap(ctx, layout, null, (value) => value, colors);
    drawInactivityGap(
      ctx,
      layout,
      { startTime: 10, endTime: 5 },
      (value) => value,
      colors,
    );
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();

    drawInactivityGap(
      ctx,
      layout,
      { startTime: 50, endTime: 90 },
      (value) => value,
      colors,
    );

    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws hover guide lines and optional indicators", () => {
    const ctx = makeCtx();

    drawHover(ctx, null, layout, (value) => value, 50, "#f00", colors);
    expect(ctx.moveTo).not.toHaveBeenCalled();

    drawHover(
      ctx,
      makePoint({ time: 10 }),
      layout,
      (value) => value,
      null,
      "#f00",
      colors,
    );
    expect(mockDrawDonutIndicator).not.toHaveBeenCalled();

    drawHover(
      ctx,
      makePoint({ time: 20 }),
      layout,
      (value) => value,
      80,
      "#f00",
      colors,
    );
    expect(mockDrawDonutIndicator).toHaveBeenCalledWith(ctx, 20, 80, {
      fillStyle: "#f00",
      strokeStyle: "rgba(255, 255, 255, 0.9)",
    });
  });
});
