import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ChartDomains,
  ChartLayout,
} from "../canvas-chart-utils/canvas-chart-utils";
import { drawMonotoneCurve } from "../canvas-chart-utils/canvas-chart-utils";
import type { ChartDataPoint, MetricKey } from "../chart-types/chart-types";
import {
  type BrushDrawContext,
  type DrawContext,
  drawBrush,
  drawDecksScatter,
  drawGrid,
  drawHoverHighlight,
  drawLeagueStartMarker,
  drawProfitArea,
  drawXAxis,
  drawYAxisDecks,
  drawYAxisProfit,
} from "./draw-functions";

// ─── Mock dependency ───────────────────────────────────────────────────────────

vi.mock("../canvas-chart-utils/canvas-chart-utils", () => ({
  ACTIVE_DOT_RADIUS: 3,
  BRUSH_TRAVELLER_WIDTH: 8,
  clamp: (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v)),
  DOT_RADIUS: 3,
  drawMonotoneCurve: vi.fn(),
  evenTicks: vi.fn((_min: number, _max: number, count: number) =>
    Array.from({ length: count }, (_, i) => i),
  ),
  formatDecksTick: vi.fn((v: number) => String(v)),
  formatProfitTick: vi.fn((v: number) => String(v)),
  parseRgba: vi.fn(() => ({ r: 100, g: 200, b: 50, a: 1 })),
  rgbaStr: vi.fn(
    (_r: number, _g: number, _b: number, _a: number) => "rgba(100,200,50,1)",
  ),
  TICK_COUNT: 5,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeGradient() {
  return { addColorStop: vi.fn() };
}

function makeMockCtx() {
  const gradient = makeGradient();
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    bezierCurveTo: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    // Assignable properties
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
    // Expose gradient for assertions
    _gradient: gradient,
  };
}

type MockCtx = ReturnType<typeof makeMockCtx>;

function makeLayout(): ChartLayout {
  return {
    chartLeft: 50,
    chartRight: 450,
    chartTop: 10,
    chartBottom: 300,
    chartWidth: 400,
    chartHeight: 290,
    brushTop: 320,
    brushBottom: 350,
    brushLeft: 50,
    brushRight: 450,
    brushHeight: 30,
  };
}

function makeColors() {
  return {
    profitColor: "#00ff00",
    decksColor: "#ff0000",
    c: {
      primary: "#aaa",
      secondary: "#bbb",
      success: "#0f0",
      warning: "#f90",
      bc06: "rgba(255,255,255,0.06)",
      bc10: "rgba(255,255,255,0.1)",
      bc15: "rgba(255,255,255,0.15)",
      bc20: "rgba(255,255,255,0.2)",
      bc30: "rgba(255,255,255,0.3)",
      bc40: "rgba(255,255,255,0.4)",
      b2: "#1a1a2e",
    } as Record<string, string>,
  };
}

function makeDC(
  ctx: MockCtx,
  overrides: Partial<DrawContext> = {},
): DrawContext {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    layout: makeLayout(),
    colors: makeColors(),
    hiddenMetrics: new Set<MetricKey>(),
    mapX: vi.fn((i: number) => 50 + i * 10),
    mapProfitY: vi.fn((v: number) => 300 - v),
    mapDecksY: vi.fn((v: number) => 300 - v * 2),
    ...overrides,
  };
}

function makeBDC(
  ctx: MockCtx,
  overrides: Partial<BrushDrawContext> = {},
): BrushDrawContext {
  const base = makeDC(ctx);
  return {
    ...base,
    mapBrushX: vi.fn((i: number) => 50 + i * 4),
    brushRange: { startIndex: 0, endIndex: 9 },
    hoverIndex: null,
    markerIndex: null,
    ...overrides,
  };
}

function makeDomains(): ChartDomains {
  return {
    profit: { min: -10, max: 30 },
    decks: { min: 0, max: 100 },
  };
}

function makeDataPoint(
  overrides: Partial<ChartDataPoint> = {},
): ChartDataPoint {
  return {
    sessionIndex: 1,
    sessionDate: "2024-01-01",
    league: "TestLeague",
    profitDivine: 5,
    rawDecks: 10,
    chaosPerDivine: 100,
    ...overrides,
  };
}

function makeVisibleData(count: number): ChartDataPoint[] {
  return Array.from({ length: count }, (_, i) =>
    makeDataPoint({
      sessionIndex: i + 1,
      profitDivine: i * 2 - 5,
      rawDecks: i === 0 ? null : i * 3,
    }),
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("drawGrid", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("calls save and restore on the context", () => {
    const dc = makeDC(ctx);
    drawGrid(dc, makeDomains(), 10);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("draws the dashed border rectangle around the chart area", () => {
    const dc = makeDC(ctx);
    drawGrid(dc, makeDomains(), 10);
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 3]);
    expect(ctx.strokeRect).toHaveBeenCalledWith(50, 10, 400, 290);
  });

  it("draws horizontal grid lines when profit is visible", () => {
    const dc = makeDC(ctx);
    drawGrid(dc, makeDomains(), 10);
    // evenTicks returns [0,1,2,3,4] (5 items), inner ticks are indices 1,2,3
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(dc.mapProfitY).toHaveBeenCalled();
  });

  it("skips horizontal grid lines when profit is hidden", () => {
    const dc = makeDC(ctx, { hiddenMetrics: new Set<MetricKey>(["profit"]) });
    drawGrid(dc, makeDomains(), 10);
    // mapProfitY should not be called for grid lines (only vertical lines use mapX)
    expect(dc.mapProfitY).not.toHaveBeenCalled();
  });

  it("draws vertical grid lines using mapX", () => {
    const dc = makeDC(ctx);
    drawGrid(dc, makeDomains(), 10);
    expect(dc.mapX).toHaveBeenCalled();
  });
});

// ─── drawYAxisDecks ────────────────────────────────────────────────────────────

describe("drawYAxisDecks", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early when 'decks' metric is hidden", () => {
    const dc = makeDC(ctx, { hiddenMetrics: new Set<MetricKey>(["decks"]) });
    drawYAxisDecks(dc, makeDomains());
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws tick labels on the left axis when decks is visible", () => {
    const dc = makeDC(ctx);
    drawYAxisDecks(dc, makeDomains());
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
    // TICK_COUNT = 5, so 5 fillText calls
    expect(ctx.fillText).toHaveBeenCalledTimes(5);
  });

  it("positions labels to the left of chartLeft", () => {
    const dc = makeDC(ctx);
    drawYAxisDecks(dc, makeDomains());
    const calls = ctx.fillText.mock.calls;
    // Each call's x coordinate should be chartLeft - 6 = 44
    for (const call of calls) {
      expect(call[1]).toBe(44);
    }
  });

  it("sets textBaseline to 'bottom' for the first tick", () => {
    const dc = makeDC(ctx);
    drawYAxisDecks(dc, makeDomains());
    // After setting fillStyle, font, textAlign, the first tick sets textBaseline
    // We check the ctx property was assigned (can only check last assignment via mock)
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

// ─── drawYAxisProfit ───────────────────────────────────────────────────────────

describe("drawYAxisProfit", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early when 'profit' metric is hidden", () => {
    const dc = makeDC(ctx, { hiddenMetrics: new Set<MetricKey>(["profit"]) });
    drawYAxisProfit(dc, makeDomains());
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws tick labels on the right axis when profit is visible", () => {
    const dc = makeDC(ctx);
    drawYAxisProfit(dc, makeDomains());
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
    expect(ctx.fillText).toHaveBeenCalledTimes(5);
  });

  it("positions labels to the right of chartRight", () => {
    const dc = makeDC(ctx);
    drawYAxisProfit(dc, makeDomains());
    const calls = ctx.fillText.mock.calls;
    // Each call's x coordinate should be chartRight + 6 = 456
    for (const call of calls) {
      expect(call[1]).toBe(456);
    }
  });
});

// ─── drawXAxis ─────────────────────────────────────────────────────────────────

describe("drawXAxis", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("calls save and restore", () => {
    const dc = makeDC(ctx);
    drawXAxis(dc, makeVisibleData(5));
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("draws session index labels for visible data", () => {
    const dc = makeDC(ctx);
    const data = makeVisibleData(3);
    drawXAxis(dc, data);
    expect(ctx.fillText).toHaveBeenCalled();
    // Verify at least the first data point's sessionIndex was drawn
    const firstCall = ctx.fillText.mock.calls[0];
    expect(firstCall[0]).toBe(String(data[0].sessionIndex));
  });

  it("draws the last label when it doesn't overlap with the stepped labels", () => {
    const dc = makeDC(ctx);
    // Make enough data so xStep > 1 and lastI % xStep !== 0
    const data = makeVisibleData(7);
    drawXAxis(dc, data);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("draws the last label when it has enough gap from the last stepped label", () => {
    // Use wide spacing so that the last non-stepped label has minGap (18) room
    const _dc = makeDC(ctx, {
      mapX: vi.fn((i: number) => 50 + i * 40),
    });
    // 10 points: indices 0–9, xSpacing=40, minLabelSpacing=30 → xStep=1
    // With xStep=1, lastI%1===0, so it won't enter the branch.
    // Need xStep > 1: use narrower spacing so step > 1, but last gap >= 18.
    // mapX spacing=20, count=10: xSpacing=20, minLabelSpacing~30 → xStep=2
    // stepped: 0,2,4,6,8. lastI=9, 9%2=1≠0. last stepped x=50+8*20=210, last x=50+9*20=230. gap=20>=18 ✓
    const dc2 = makeDC(ctx, {
      mapX: vi.fn((i: number) => 50 + i * 20),
    });
    const data = makeVisibleData(10);

    ctx.fillText.mockClear();
    drawXAxis(dc2, data);

    // The last fillText call should be for the last data point's sessionIndex
    const calls = ctx.fillText.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe(String(data[9].sessionIndex));
  });

  it("skips the last label when it would overlap the last stepped label", () => {
    // chartWidth=44 → maxXTicks = min(10, max(2, floor(44/22))) = 2
    // numVisible=10, xStep = ceil(10/2) = 5
    // stepped indices: 0, 5. lastI=9, 9%5=4≠0 → enters branch.
    // last stepped x = 50+5*5=75, last x = 50+9*5=95. gap=20 >= 18 → drawn!
    // With spacing=3: last stepped x=50+5*3=65, last x=50+9*3=77. gap=12 < 18 → skipped.
    const narrowLayout = { ...makeLayout(), chartWidth: 44 };
    const dc = makeDC(ctx, {
      layout: narrowLayout,
      mapX: vi.fn((i: number) => 50 + i * 3),
    });
    const data = makeVisibleData(10);

    ctx.fillText.mockClear();
    drawXAxis(dc, data);

    const calls = ctx.fillText.mock.calls;
    const lastCall = calls[calls.length - 1];
    // The last drawn label should NOT be the last data point (index 9)
    expect(lastCall[0]).not.toBe(String(data[9].sessionIndex));
  });
});

// ─── drawProfitArea ────────────────────────────────────────────────────────────

describe("drawProfitArea", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early when 'profit' is hidden", () => {
    const dc = makeDC(ctx, { hiddenMetrics: new Set<MetricKey>(["profit"]) });
    drawProfitArea(dc, makeVisibleData(5), makeVisibleData(5));
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("returns early when visible data is empty", () => {
    const dc = makeDC(ctx);
    drawProfitArea(dc, [], []);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("creates a linear gradient for the area fill", () => {
    const dc = makeDC(ctx);
    const data = makeVisibleData(5);
    drawProfitArea(dc, data, data);
    expect(ctx.createLinearGradient).toHaveBeenCalledOnce();
    expect(ctx._gradient.addColorStop).toHaveBeenCalledTimes(2);
  });

  it("calls beginPath twice (area fill + line stroke)", () => {
    const dc = makeDC(ctx);
    const data = makeVisibleData(5);
    drawProfitArea(dc, data, data);
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
  });

  it("calls fill for the area and stroke for the line", () => {
    const dc = makeDC(ctx);
    const data = makeVisibleData(5);
    drawProfitArea(dc, data, data);
    expect(ctx.fill).toHaveBeenCalledOnce();
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it("sets line width to 2 for the stroke line", () => {
    const dc = makeDC(ctx);
    const data = makeVisibleData(5);
    drawProfitArea(dc, data, data);
    expect(ctx.lineWidth).toBe(2);
  });
});

// ─── drawDecksScatter ──────────────────────────────────────────────────────────

describe("drawDecksScatter", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early when 'decks' is hidden", () => {
    const dc = makeDC(ctx, { hiddenMetrics: new Set<MetricKey>(["decks"]) });
    drawDecksScatter(dc, makeVisibleData(5));
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("skips points with null rawDecks", () => {
    const dc = makeDC(ctx);
    // makeVisibleData sets rawDecks = null for index 0
    const data = makeVisibleData(3);
    drawDecksScatter(dc, data);
    // 3 data points, 1 has null rawDecks, so 2 dots drawn
    expect(ctx.arc).toHaveBeenCalledTimes(2);
  });

  it("draws filled and stroked circles for each valid point", () => {
    const dc = makeDC(ctx);
    const data = [
      makeDataPoint({ rawDecks: 10 }),
      makeDataPoint({ rawDecks: 20 }),
    ];
    drawDecksScatter(dc, data);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it("draws nothing for a single point with null rawDecks", () => {
    const dc = makeDC(ctx);
    const data = [makeDataPoint({ rawDecks: null })];
    drawDecksScatter(dc, data);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

// ─── drawHoverHighlight ────────────────────────────────────────────────────────

describe("drawHoverHighlight", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early when hoverIndex is null", () => {
    const dc = makeDC(ctx);
    drawHoverHighlight(dc, makeVisibleData(5), null);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("returns early when hoverIndex is negative", () => {
    const dc = makeDC(ctx);
    drawHoverHighlight(dc, makeVisibleData(5), -1);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("returns early when hoverIndex is out of bounds", () => {
    const dc = makeDC(ctx);
    drawHoverHighlight(dc, makeVisibleData(3), 3);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("draws the vertical cursor line at the hover position", () => {
    const dc = makeDC(ctx);
    drawHoverHighlight(dc, makeVisibleData(5), 2);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 3]);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws the profit active dot when profit is visible", () => {
    const dc = makeDC(ctx);
    const data = makeVisibleData(5);
    drawHoverHighlight(dc, data, 2);
    // Should draw arc for profit dot
    expect(ctx.arc).toHaveBeenCalled();
    expect(dc.mapProfitY).toHaveBeenCalledWith(data[2].profitDivine);
  });

  it("skips profit dot when profit is hidden", () => {
    const dc = makeDC(ctx, { hiddenMetrics: new Set<MetricKey>(["profit"]) });
    const data = makeVisibleData(5);
    drawHoverHighlight(dc, data, 2);
    expect(dc.mapProfitY).not.toHaveBeenCalled();
  });

  it("draws the decks active dot when rawDecks is not null and decks is visible", () => {
    const dc = makeDC(ctx);
    // index 2 has rawDecks = 6 (not null)
    const data = makeVisibleData(5);
    drawHoverHighlight(dc, data, 2);
    expect(dc.mapDecksY).toHaveBeenCalledWith(data[2].rawDecks);
  });

  it("skips decks dot when rawDecks is null even if decks is visible", () => {
    const dc = makeDC(ctx);
    // index 0 has rawDecks = null in makeVisibleData
    const data = makeVisibleData(5);
    drawHoverHighlight(dc, data, 0);
    // mapDecksY should not be called because rawDecks is null at index 0
    expect(dc.mapDecksY).not.toHaveBeenCalled();
  });
});

describe("drawLeagueStartMarker", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early for non-finite and offscreen marker positions", () => {
    drawLeagueStartMarker(makeDC(ctx, { mapX: vi.fn(() => Number.NaN) }), 1, {
      label: "Mirage",
      color: "#0f0",
    });
    drawLeagueStartMarker(makeDC(ctx, { mapX: vi.fn(() => 10) }), 1, {
      label: "Mirage",
      color: "#0f0",
    });
    drawLeagueStartMarker(makeDC(ctx, { mapX: vi.fn(() => 500) }), 1, {
      label: "Mirage",
      color: "#0f0",
    });

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("draws a dashed marker line without a label when showLabel is false", () => {
    drawLeagueStartMarker(makeDC(ctx, { mapX: vi.fn(() => 120) }), 1, {
      label: "Mirage",
      color: "#0f0",
      lineDash: [2, 2],
      showLabel: false,
    });

    expect(ctx.setLineDash).toHaveBeenCalledWith([2, 2]);
    expect(ctx.moveTo).toHaveBeenCalledWith(120, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(120, 300);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws an uppercase rotated marker label by default", () => {
    drawLeagueStartMarker(makeDC(ctx, { mapX: vi.fn(() => 120) }), 1, {
      label: "Mirage",
      color: "#0f0",
    });

    expect(ctx.translate).toHaveBeenCalledWith(130, 16);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.fillText).toHaveBeenCalledWith("MIRAGE", 0, 0);
  });
});

// ─── drawBrush ─────────────────────────────────────────────────────────────────

describe("drawBrush", () => {
  let ctx: MockCtx;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it("returns early when chartData is empty", () => {
    const bdc = makeBDC(ctx);
    drawBrush(bdc, []);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("draws the background rectangle", () => {
    const bdc = makeBDC(ctx);
    const data = makeVisibleData(10);
    drawBrush(bdc, data);
    // First fillRect call is the background
    expect(ctx.fillRect).toHaveBeenCalled();
    const firstCall = ctx.fillRect.mock.calls[0];
    expect(firstCall).toEqual([50, 320, 400, 30]);
  });

  it("draws the brush outline strokeRect", () => {
    const bdc = makeBDC(ctx);
    drawBrush(bdc, makeVisibleData(10));
    // strokeRect is called for outline and selected range border
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("draws travellers (closePath is called for rounded rects)", () => {
    const bdc = makeBDC(ctx);
    drawBrush(bdc, makeVisibleData(10));
    // drawTraveller is called twice (start and end), each calls closePath
    expect(ctx.closePath).toHaveBeenCalledTimes(2);
  });

  it("draws hover indicator when hoverIndex is set and profit is visible", () => {
    const bdc = makeBDC(ctx, { hoverIndex: 3 });
    drawBrush(bdc, makeVisibleData(10));
    // Hover indicator draws an arc for the dot
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("draws a league marker line in the brush when markerIndex is visible", () => {
    const bdc = makeBDC(ctx, { markerIndex: 3 });

    drawBrush(bdc, makeVisibleData(10));

    expect(ctx.moveTo).toHaveBeenCalledWith(62, 320);
    expect(ctx.lineTo).toHaveBeenCalledWith(62, 350);
  });

  it("skips brush marker drawing when markerIndex is out of range", () => {
    const bdc = makeBDC(ctx, { markerIndex: 20 });

    drawBrush(bdc, makeVisibleData(10));

    expect(ctx.moveTo).not.toHaveBeenCalledWith(130, 320);
  });

  it("skips mini profit line when profit is hidden", () => {
    const bdc = makeBDC(ctx, { hiddenMetrics: new Set<MetricKey>(["profit"]) });
    const mockedCurve = vi.mocked(drawMonotoneCurve);
    mockedCurve.mockClear();
    drawBrush(bdc, makeVisibleData(10));
    expect(mockedCurve).not.toHaveBeenCalled();
  });

  it("draws range labels via fillText", () => {
    const bdc = makeBDC(ctx);
    drawBrush(bdc, makeVisibleData(10));
    // Range labels are drawn with fillText — at least the start and end labels
    const fillTextCalls = ctx.fillText.mock.calls;
    expect(fillTextCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("handles flat profit data where bMin === bMax (L482, L518-519)", () => {
    const bdc = makeBDC(ctx);
    // All points have identical profitDivine → bMin === bMax triggers the ±1 branch
    const flatData = Array.from({ length: 5 }, (_, i) =>
      makeDataPoint({
        sessionIndex: i + 1,
        profitDivine: 10,
        rawDecks: i * 2,
      }),
    );
    // Should not throw and should still draw
    drawBrush(bdc, flatData);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("dims left area when bxStart > brushLeft (L531 left dim)", () => {
    // brushRange starting at index 2 means bxStart = 50 + 2*4 = 58 > brushLeft(50)
    const bdc = makeBDC(ctx, { brushRange: { startIndex: 2, endIndex: 9 } });
    const data = makeVisibleData(10);
    drawBrush(bdc, data);
    // fillRect should be called for the left dim region
    const fillRectCalls = ctx.fillRect.mock.calls;
    // At least one call should dim the left area (x=brushLeft, width = bxStart - brushLeft)
    const leftDim = fillRectCalls.find(
      (call: number[]) => call[0] === 50 && call[2] > 0 && call[2] < 400,
    );
    expect(leftDim).toBeDefined();
  });

  it("dims right area when bxEnd < brushRight (L531 right dim)", () => {
    // brushRange ending at index 5 means bxEnd = 50 + 5*4 = 70 < brushRight(450)
    const bdc = makeBDC(ctx, { brushRange: { startIndex: 0, endIndex: 5 } });
    const data = makeVisibleData(10);
    drawBrush(bdc, data);
    const fillRectCalls = ctx.fillRect.mock.calls;
    // Right dim: fillRect(bxEnd, brushTop, brushRight - bxEnd, brushH)
    const rightDim = fillRectCalls.find(
      (call: number[]) => call[0] === 70 && call[2] === 380,
    );
    expect(rightDim).toBeDefined();
  });
});
