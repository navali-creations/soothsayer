import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

const mockCanvasRef = vi.hoisted(() => ({
  current: null as HTMLCanvasElement | null,
}));
const mockSetupCanvas = vi.hoisted(() => vi.fn());
const mockDrawMonotoneCurve = vi.hoisted(() => vi.fn());
const mockDrawDonutIndicator = vi.hoisted(() => vi.fn());
const mockCtx = vi.hoisted(() => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 6 })),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  setLineDash: vi.fn(),
  arc: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
}));

vi.mock("../helpers", () => ({
  formatAxisDate: (_time: number) => "Jan 1",
}));

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
  createCompressedLinearMapper: ({
    domainMin,
    domainMax,
    pixelMin,
    pixelMax,
  }: {
    domainMin: number;
    domainMax: number;
    pixelMin: number;
    pixelMax: number;
  }) => {
    const span = domainMax - domainMin || 1;
    return (value: number) =>
      pixelMin + ((value - domainMin) / span) * (pixelMax - pixelMin);
  },
  normalizeNumericDomain: (min: number, max: number) =>
    min === max ? { min: min - 1, max: max + 1 } : { min, max },
  drawDonutIndicator: mockDrawDonutIndicator,
  drawMonotoneCurve: mockDrawMonotoneCurve,
  ensureCanvasBackingStore: vi.fn(() => true),
  evenTicks: (min: number, max: number, count: number) =>
    Array.from({ length: count }, (_, index) =>
      count === 1 ? min : min + ((max - min) * index) / (count - 1),
    ),
  nearestPointHitTest: <T,>(
    cursorX: number,
    points: readonly T[],
    toPixelX: (point: T, index: number) => number,
    threshold = 20,
    filter?: (point: T, index: number) => boolean,
  ) => {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (filter && !filter(points[i], i)) continue;
      const distance = Math.abs(cursorX - toPixelX(points[i], i));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestDistance <= threshold
      ? { index: bestIndex, distance: bestDistance }
      : { index: -1, distance: Infinity };
  },
  setupCanvas: mockSetupCanvas,
  useCanvasResize: () => ({
    containerRef: vi.fn(),
    containerElRef: { current: null },
    canvasRef: mockCanvasRef,
    canvasSize: { width: 800, height: 240 },
  }),
}));

import { OVERVIEW_HEIGHT } from "../constants";
import type { ChartDataPoint } from "../types";
import OverviewChart from "./OverviewChart";

function makeDataPoint(
  overrides: Partial<ChartDataPoint> = {},
): ChartDataPoint {
  return {
    time: 1704067200000,
    count: 3,
    cumulativeCount: 10,
    totalDecksOpened: 500,
    league: "Affliction",
    sessionStartedAt: "2024-01-01T12:00:00.000Z",
    sessionId: "session-1",
    sessionCount: 1,
    ...overrides,
  };
}

function makeChartColors() {
  return {
    primary: "#ff0000",
    primary15: "rgba(255,0,0,0.15)",
    primary30: "rgba(255,0,0,0.3)",
    b1: "#1a1a2e",
    b2: "#16213e",
    bc05: "rgba(255,255,255,0.05)",
    bc06: "rgba(255,255,255,0.06)",
    bc10: "rgba(255,255,255,0.1)",
    bc15: "rgba(255,255,255,0.15)",
    bc20: "rgba(255,255,255,0.2)",
    bc30: "rgba(255,255,255,0.3)",
    bc35: "rgba(255,255,255,0.35)",
    bc40: "rgba(255,255,255,0.4)",
    bc50: "rgba(255,255,255,0.5)",
    success: "rgb(0, 255, 200)",
    success50: "rgba(0, 255, 200, 0.5)",
    secondary: "rgb(0, 255, 200)",
    secondary60: "rgba(0, 255, 200, 0.6)",
  };
}

const visibleData: ChartDataPoint[] = [
  makeDataPoint({ time: 1704067200000, count: 2, cumulativeCount: 2 }),
  makeDataPoint({ time: 1704153600000, count: 3, cumulativeCount: 5 }),
  makeDataPoint({ time: 1704240000000, count: 1, cumulativeCount: 6 }),
];

beforeEach(() => {
  mockSetupCanvas.mockReturnValue({
    ctx: mockCtx,
    width: 800,
    height: 240,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  mockCanvasRef.current = null;
});

describe("OverviewChart", () => {
  const handleBrushChange = vi.fn();

  function renderOverviewChart(
    overrides: Partial<Parameters<typeof OverviewChart>[0]> = {},
  ) {
    return renderWithProviders(
      <OverviewChart
        chartData={visibleData}
        maxPerSession={3}
        hiddenMetrics={new Set()}
        leagueStartTime={undefined}
        brushStartTime={visibleData[0].time}
        brushEndTime={visibleData[visibleData.length - 1].time}
        handleBrushChange={handleBrushChange}
        c={makeChartColors() as any}
        {...overrides}
      />,
    );
  }

  it("renders a canvas with fixed overview height", () => {
    const { container } = renderOverviewChart();

    expect(
      screen.getByTestId("drop-timeline-overview-chart"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("drop-timeline-overview-canvas"),
    ).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).style.height).toBe(
      `${OVERVIEW_HEIGHT}px`,
    );
  });

  it("draws overview bars and brush selection", () => {
    renderOverviewChart();

    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
  });

  it("does not draw when there is no overview data", () => {
    renderOverviewChart({
      chartData: [],
      brushStartTime: undefined,
      brushEndTime: undefined,
    });

    expect(mockSetupCanvas).not.toHaveBeenCalled();
  });

  it("does not draw expected bars in the brush preview", () => {
    renderOverviewChart();

    expect(mockCtx.clip).not.toHaveBeenCalled();
  });

  it("draws a brush marker line when leagueStartTime is in range", () => {
    renderOverviewChart({ leagueStartTime: visibleData[0].time });

    expect(mockCtx.moveTo).toHaveBeenCalledWith(44, 206);
    expect(mockCtx.lineTo).toHaveBeenCalledWith(44, 236);
  });

  it("notifies brush changes when dragging the brush", () => {
    renderOverviewChart();

    const canvas = screen.getByTestId(
      "drop-timeline-overview-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 80,
      right: 800,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);
    canvas.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 220, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 500, clientY: 220, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    expect(handleBrushChange).toHaveBeenCalled();
  });

  it("ignores pointer gestures outside the brush or with a single data point", () => {
    renderOverviewChart();

    const canvas = screen.getByTestId(
      "drop-timeline-overview-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 80,
      right: 800,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 500, clientY: 10, pointerId: 1 });

    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
    expect(handleBrushChange).not.toHaveBeenCalled();

    renderOverviewChart({
      chartData: [visibleData[0]],
      brushStartTime: visibleData[0].time,
      brushEndTime: visibleData[0].time,
    });
    const singleCanvas = screen.getAllByTestId(
      "drop-timeline-overview-canvas",
    )[1] as HTMLCanvasElement;
    vi.spyOn(singleCanvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 80,
      right: 800,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    singleCanvas.setPointerCapture = vi.fn();
    fireEvent.pointerDown(singleCanvas, {
      clientX: 20,
      clientY: 60,
      pointerId: 2,
    });

    expect(handleBrushChange).not.toHaveBeenCalled();
  });

  it("notifies wheel zoom when scrolling overview chart", () => {
    const onWheelZoom = vi.fn();
    renderOverviewChart({ onWheelZoom });

    const canvas = screen.getByTestId(
      "drop-timeline-overview-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 80,
      right: 800,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.wheel(canvas, { deltaY: 120, clientX: 200 });

    expect(onWheelZoom).toHaveBeenCalledWith({
      deltaY: 120,
      focusRatio: 0.25,
    });
  });

  it("ignores tiny wheel deltas and safely renders without wheel handler", () => {
    const onWheelZoom = vi.fn();
    renderOverviewChart({ onWheelZoom });

    const canvas = screen.getByTestId(
      "drop-timeline-overview-canvas",
    ) as HTMLCanvasElement;
    fireEvent.wheel(canvas, { deltaY: 0.5, clientX: 200 });

    expect(onWheelZoom).not.toHaveBeenCalled();

    renderOverviewChart({ onWheelZoom: undefined });
    fireEvent.wheel(screen.getAllByTestId("drop-timeline-overview-canvas")[1], {
      deltaY: 120,
      clientX: 200,
    });

    expect(onWheelZoom).not.toHaveBeenCalled();
  });
});
