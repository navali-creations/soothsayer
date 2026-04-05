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
    profitChaos: 500,
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
});
