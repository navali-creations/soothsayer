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

import { CHART_HEIGHT } from "../constants";
import type { ChartDataPoint, LeagueMarker } from "../types";
import MainChart from "./MainChart";

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

const visibleMarkers: LeagueMarker[] = [
  { time: 1704067200000, label: "Affliction Start", type: "start" },
  { time: 1704240000000, label: "Affliction End", type: "end" },
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

describe("MainChart", () => {
  function renderMainChart(
    overrides: Partial<Parameters<typeof MainChart>[0]> = {},
  ) {
    return renderWithProviders(
      <MainChart
        chartData={visibleData}
        visibleData={visibleData}
        maxPerSession={3}
        hiddenMetrics={new Set()}
        inactivityGap={null}
        visibleMarkers={[]}
        visibleTimeMin={visibleData[0].time}
        visibleTimeMax={visibleData[visibleData.length - 1].time}
        c={makeChartColors() as any}
        {...overrides}
      />,
    );
  }

  it("renders a canvas with fixed chart height", () => {
    const { container } = renderMainChart();

    expect(screen.getByTestId("drop-timeline-main-chart")).toBeInTheDocument();
    expect(screen.getByTestId("drop-timeline-main-canvas")).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).style.height).toBe(
      `${CHART_HEIGHT}px`,
    );
  });

  it("draws grid, bars, deck line, expected bars, and marker labels", () => {
    renderMainChart({ visibleMarkers });

    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockDrawMonotoneCurve).toHaveBeenCalled();
    expect(mockCtx.rotate).toHaveBeenCalledTimes(2);
    expect(mockCtx.fillText).toHaveBeenCalledWith("AFFLICTION START", 0, 0);
    expect(mockCtx.fillText).toHaveBeenCalledWith("AFFLICTION END", 0, 0);
    expect(mockCtx.fillText.mock.calls.some(([text]) => text === "Jan 1")).toBe(
      true,
    );
  });

  it("does not draw the deck line when it is hidden", () => {
    renderMainChart({ hiddenMetrics: new Set(["decks-opened"]) });

    expect(mockDrawMonotoneCurve).not.toHaveBeenCalled();
  });

  it("does not draw bars through an empty visible range", () => {
    renderMainChart({
      visibleData: [],
      visibleTimeMin: visibleData[0].time + 1,
      visibleTimeMax: visibleData[visibleData.length - 1].time - 1,
    });

    expect(mockCtx.fillRect).not.toHaveBeenCalled();
  });

  it("uses fallback layout from setup canvas when resize dimensions are unavailable", () => {
    mockSetupCanvas.mockReturnValue({
      ctx: mockCtx,
      width: 800,
      height: 240,
    });

    renderMainChart();

    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalledWith(44, 8, 712, 208);
  });

  it("renders tooltip for the nearest hovered point", () => {
    renderMainChart();

    const canvas = screen.getByTestId(
      "drop-timeline-main-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 240,
      right: 800,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 44, clientY: 80 });

    expect(screen.getByText("Affliction")).toBeInTheDocument();
    expect(screen.getByText("Dropped")).toBeInTheDocument();
  });

  it("clears tooltip state when no point is hit", () => {
    const onHoverTimeChange = vi.fn();
    renderMainChart({ onHoverTimeChange });

    const canvas = screen.getByTestId(
      "drop-timeline-main-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 240,
      right: 800,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 44, clientY: 80 });
    expect(screen.getByText("Affliction")).toBeInTheDocument();

    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 80 });

    expect(onHoverTimeChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText("Affliction")).not.toBeInTheDocument();
  });

  it("notifies hover time changes on move and leave", () => {
    const onHoverTimeChange = vi.fn();
    renderMainChart({ onHoverTimeChange });

    const canvas = screen.getByTestId(
      "drop-timeline-main-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 240,
      right: 800,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 44, clientY: 80 });
    fireEvent.pointerLeave(canvas);

    expect(onHoverTimeChange).toHaveBeenCalledWith(visibleData[0].time);
    expect(onHoverTimeChange).toHaveBeenCalledWith(null);
  });

  it("notifies wheel zoom when scrolling main chart", () => {
    const onWheelZoom = vi.fn();
    renderMainChart({ onWheelZoom });

    const canvas = screen.getByTestId(
      "drop-timeline-main-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 240,
      right: 800,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.wheel(canvas, { deltaY: -120, clientX: 400 });

    expect(onWheelZoom).toHaveBeenCalledWith({
      deltaY: -120,
      focusRatio: 0.5,
    });
  });

  it("ignores sub-pixel wheel deltas and missing wheel callbacks", () => {
    const onWheelZoom = vi.fn();
    renderMainChart({ onWheelZoom });

    const canvas = screen.getByTestId(
      "drop-timeline-main-canvas",
    ) as HTMLCanvasElement;
    fireEvent.wheel(canvas, { deltaY: 0.5, clientX: 400 });

    expect(onWheelZoom).not.toHaveBeenCalled();

    renderMainChart({ onWheelZoom: undefined });
    fireEvent.wheel(screen.getAllByTestId("drop-timeline-main-canvas")[1], {
      deltaY: 120,
      clientX: 400,
    });

    expect(onWheelZoom).not.toHaveBeenCalled();
  });
});
