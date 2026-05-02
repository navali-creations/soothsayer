import { describe, expect, it, vi } from "vitest";

const mockEnsureCanvasBackingStore = vi.hoisted(() => vi.fn(() => true));
const mockSetupCanvas = vi.hoisted(() => vi.fn());

vi.mock("~/renderer/lib/canvas-core", () => ({
  clamp: (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value)),
  createLinearMapper: (
    domainMin: number,
    domainMax: number,
    rangeMin: number,
    rangeMax: number,
  ) => {
    const fn = (value: number) => {
      const span = domainMax - domainMin || 1;
      return rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
    };
    fn.inverse = (pixel: number) => {
      const span = rangeMax - rangeMin || 1;
      return domainMin + ((pixel - rangeMin) / span) * (domainMax - domainMin);
    };
    return fn;
  },
  ensureCanvasBackingStore: mockEnsureCanvasBackingStore,
  setupCanvas: mockSetupCanvas,
}));

import type { ChartDataPoint } from "../types";
import {
  computeBrushChange,
  computeLayout,
  computeTimeDomain,
  createOverviewTimeMapper,
  drawOverviewChartCanvas,
  EMPTY_OVERVIEW_DRAG_STATE,
  getOverviewDragMode,
} from "./OverviewChart.utils";

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
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const colors = {
  primary: "#f00",
  bc05: "rgba(255,255,255,0.05)",
  b2: "#222",
  bc15: "rgba(255,255,255,0.15)",
  bc20: "rgba(255,255,255,0.2)",
  bc30: "rgba(255,255,255,0.3)",
  bc40: "rgba(255,255,255,0.4)",
  success50: "rgba(0,255,0,0.5)",
} as any;

const chartData = Array.from({ length: 6 }, (_, index) =>
  makePoint({
    time: 1000 + index * 1000,
    count: index + 1,
    totalDecksOpened: 10 + index,
    sessionId: `session-${index}`,
  }),
);

describe("OverviewChart utils", () => {
  it("computes layouts, domains, and mapper values", () => {
    expect(computeLayout(400, 80)).toMatchObject({
      chartLeft: 44,
      chartRight: 356,
      brushTop: 46,
      brushBottom: 76,
    });
    expect(computeTimeDomain([])).toEqual({ min: 0, max: 1 });
    expect(computeTimeDomain([makePoint({ time: 10 })])).toEqual({
      min: 9,
      max: 11,
    });

    const mapper = createOverviewTimeMapper(
      { min: 0, max: 10 },
      { brushLeft: 100, brushRight: 200 },
    );
    expect(mapper(5)).toBe(150);
    expect(mapper.inverse?.(125)).toBe(2.5);
  });

  it("detects start, end, and range drag modes", () => {
    expect(getOverviewDragMode(102, 100, 200)).toBe("start");
    expect(getOverviewDragMode(196, 100, 200)).toBe("end");
    expect(getOverviewDragMode(150, 100, 200)).toBe("range");
  });

  it("computes brush changes for all drag modes and empty drag state", () => {
    const timeDomain = { min: 1000, max: 6000 };

    expect(
      computeBrushChange({
        chartData,
        timeDomain,
        startTime: 1000,
        endTime: 6000,
        pointerTime: 50,
        drag: {
          mode: "start",
          originTime: 1000,
          originStartTime: 1000,
          originEndTime: 6000,
        },
      }),
    ).toEqual({ startTime: 1000, endTime: 6000 });
    expect(
      computeBrushChange({
        chartData,
        timeDomain,
        startTime: 1000,
        endTime: 6000,
        pointerTime: 7000,
        drag: {
          mode: "end",
          originTime: 6000,
          originStartTime: 1000,
          originEndTime: 6000,
        },
      }),
    ).toEqual({ startTime: 1000, endTime: 6000 });
    expect(
      computeBrushChange({
        chartData,
        timeDomain,
        startTime: 2000,
        endTime: 4000,
        pointerTime: 3500,
        drag: {
          mode: "range",
          originTime: 3000,
          originStartTime: 2000,
          originEndTime: 4000,
        },
      }),
    ).toEqual({ startTime: 2500, endTime: 4500 });
    expect(
      computeBrushChange({
        chartData,
        timeDomain,
        startTime: 2000,
        endTime: 4000,
        pointerTime: 3500,
        drag: EMPTY_OVERVIEW_DRAG_STATE,
      }),
    ).toBeNull();
  });

  it("draws overview canvas and handles canvas setup early returns", () => {
    const ctx = makeCtx();
    const layout = computeLayout(400, 80);
    const canvas = document.createElement("canvas");

    mockEnsureCanvasBackingStore.mockReturnValueOnce(false);
    drawOverviewChartCanvas({
      canvas,
      sourceElement: null,
      chartData,
      maxPerSession: 6,
      hiddenMetrics: new Set(),
      showExpectedBars: false,
      leagueStartTime: 2000,
      startTime: 1000,
      endTime: 6000,
      layout,
      canvasSize: { width: 400, height: 80 },
      timeDomain: { min: 1000, max: 6000 },
      c: colors,
    });
    expect(mockSetupCanvas).not.toHaveBeenCalled();

    mockEnsureCanvasBackingStore.mockReturnValue(true);
    mockSetupCanvas.mockReturnValueOnce(null);
    drawOverviewChartCanvas({
      canvas,
      sourceElement: null,
      chartData,
      maxPerSession: 6,
      hiddenMetrics: new Set(),
      showExpectedBars: false,
      leagueStartTime: 2000,
      startTime: 1000,
      endTime: 6000,
      layout,
      canvasSize: { width: 400, height: 80 },
      timeDomain: { min: 1000, max: 6000 },
      c: colors,
    });
    expect(ctx.fillRect).not.toHaveBeenCalled();

    mockSetupCanvas.mockReturnValueOnce({ ctx, width: 400, height: 80 });
    drawOverviewChartCanvas({
      canvas,
      sourceElement: null,
      chartData,
      maxPerSession: 6,
      hiddenMetrics: new Set(["league-start"]),
      showExpectedBars: false,
      leagueStartTime: 2000,
      startTime: 1000,
      endTime: 6000,
      layout,
      canvasSize: { width: 0, height: 0 },
      timeDomain: { min: 1000, max: 6000 },
      c: colors,
    });

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    expect(ctx.setLineDash).not.toHaveBeenCalledWith([4, 4]);
  });

  it("draws expected bars in the brush preview when requested", () => {
    const ctx = makeCtx();
    const layout = computeLayout(400, 80);
    const canvas = document.createElement("canvas");
    const expectedData = [
      makePoint({
        time: 1000,
        count: 0,
        totalDecksOpened: 100,
        sessionId: "zero-drop",
      }),
      makePoint({
        time: 2000,
        count: 2,
        totalDecksOpened: 100,
        sessionId: "drop",
      }),
    ];

    mockEnsureCanvasBackingStore.mockReturnValue(true);
    mockSetupCanvas.mockReturnValueOnce({ ctx, width: 400, height: 80 });
    drawOverviewChartCanvas({
      canvas,
      sourceElement: null,
      chartData: expectedData,
      maxPerSession: 2,
      hiddenMetrics: new Set(),
      showExpectedBars: true,
      leagueStartTime: undefined,
      startTime: 1000,
      endTime: 2000,
      layout,
      canvasSize: { width: 400, height: 80 },
      timeDomain: { min: 1000, max: 2000 },
      c: colors,
    });

    expect(ctx.clip).toHaveBeenCalled();
  });
});
