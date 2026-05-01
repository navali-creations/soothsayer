import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails } from "~/renderer/store";

const mockCanvasRef = vi.hoisted(() => ({
  current: null as HTMLCanvasElement | null,
}));
const mockSetupCanvas = vi.hoisted(() => vi.fn());
const mockDrawMonotoneCurve = vi.hoisted(() => vi.fn());
const mockHitTestIndexBrush = vi.hoisted(() => vi.fn(() => "range"));
const mockCtx = vi.hoisted(() => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  setLineDash: vi.fn(),
  arc: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
}));

vi.mock("~/renderer/store", () => ({ useCardDetails: vi.fn() }));

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
  drawDonutIndicator: vi.fn(),
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
  ) => {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < points.length; i++) {
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
  brushDeltaIndexFromPixels: ({
    deltaX,
    itemCount,
    brushPixelWidth,
  }: {
    deltaX: number;
    itemCount: number;
    brushPixelWidth: number;
  }) => Math.round((deltaX / brushPixelWidth) * Math.max(0, itemCount - 1)),
  hitTestIndexBrush: mockHitTestIndexBrush,
  indexFromBrushPixel: (
    mapBrushX: ((value: number) => number) & {
      inverse?: (x: number) => number;
    },
    x: number,
    itemCount: number,
  ) => {
    const index = Math.round(mapBrushX.inverse?.(x) ?? 0);
    return Math.max(0, Math.min(itemCount - 1, index));
  },
  panIndexBrush: ({
    range,
    deltaIndex,
    itemCount,
  }: {
    range: { startIndex: number; endIndex: number };
    deltaIndex: number;
    itemCount: number;
  }) => {
    const span = range.endIndex - range.startIndex;
    const startIndex = Math.max(
      0,
      Math.min(itemCount - 1 - span, range.startIndex + deltaIndex),
    );
    return { startIndex, endIndex: startIndex + span };
  },
  resizeIndexBrush: ({
    range,
    pointerIndex,
    edge,
    minSpan,
  }: {
    range: { startIndex: number; endIndex: number };
    pointerIndex: number;
    edge: "start" | "end";
    minSpan: number;
  }) =>
    edge === "start"
      ? {
          ...range,
          startIndex: Math.min(pointerIndex, range.endIndex - minSpan),
        }
      : {
          ...range,
          endIndex: Math.max(pointerIndex, range.startIndex + minSpan),
        },
  zoomIndexBrush: ({
    range,
    deltaY,
  }: {
    range: { startIndex: number; endIndex: number };
    deltaY: number;
  }) =>
    deltaY < 0
      ? { startIndex: range.startIndex + 1, endIndex: range.endIndex - 1 }
      : {
          startIndex: Math.max(0, range.startIndex - 1),
          endIndex: range.endIndex + 1,
        },
  setupCanvas: mockSetupCanvas,
  useCanvasResize: () => ({
    containerRef: vi.fn(),
    containerElRef: { current: null },
    canvasRef: mockCanvasRef,
    canvasSize: { width: 800, height: 320 },
  }),
}));

vi.mock("~/renderer/hooks", () => ({
  useChartColors: () => ({
    primary: "#ff0000",
    primary02: "rgba(255,0,0,0.02)",
    primary30: "rgba(255,0,0,0.3)",
    b1: "#1a1a2e",
    b2: "#16213e",
    bc05: "rgba(255,255,255,0.05)",
    bc06: "rgba(255,255,255,0.06)",
    bc10: "rgba(255,255,255,0.1)",
    bc15: "rgba(255,255,255,0.15)",
    bc35: "rgba(255,255,255,0.35)",
  }),
}));

vi.mock("react-icons/fi", () => ({
  FiClock: (props: any) => <span data-testid="fi-clock" {...props} />,
  FiAlertCircle: (props: any) => <span data-testid="fi-alert" {...props} />,
}));

import CardDetailsPriceChart from "./CardDetailsPriceChart";

afterEach(() => {
  vi.clearAllMocks();
  mockCanvasRef.current = null;
});

describe("CardDetailsPriceChart", () => {
  beforeEach(() => {
    mockHitTestIndexBrush.mockReturnValue("range");
    mockSetupCanvas.mockReturnValue({
      ctx: mockCtx,
      width: 800,
      height: 320,
    });
  });

  function createMockState(
    overrides: {
      priceHistory?: any;
      isLoadingPriceHistory?: boolean;
      priceHistoryError?: string | null;
    } = {},
  ) {
    return {
      priceHistory: overrides.priceHistory ?? null,
      isLoadingPriceHistory: overrides.isLoadingPriceHistory ?? false,
      priceHistoryError: overrides.priceHistoryError ?? null,
    };
  }

  function renderComponent(
    overrides: {
      priceHistory?: any;
      isLoadingPriceHistory?: boolean;
      priceHistoryError?: string | null;
    } = {},
  ) {
    vi.mocked(useCardDetails).mockReturnValue(
      createMockState(overrides) as any,
    );
    return renderWithProviders(<CardDetailsPriceChart />);
  }

  function makeHistoryPoints(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(2024, 0, i + 1).toISOString(),
      rate: 1.5 + i * 0.1,
      volume: 100 + i * 50,
    }));
  }

  it("renders loading skeleton when price history is loading", () => {
    renderComponent({ isLoadingPriceHistory: true });

    expect(screen.getByText("Price History")).toBeInTheDocument();
    expect(screen.getByText("Loading chart data...")).toBeInTheDocument();
  });

  it("renders error and empty states", () => {
    renderComponent({ priceHistoryError: "Network error" });
    expect(
      screen.getByText(
        "Failed to load price history. poe.ninja may be unreachable.",
      ),
    ).toBeInTheDocument();

    vi.clearAllMocks();
    renderComponent({ priceHistory: null });
    expect(
      screen.getByText("No price history available for this card."),
    ).toBeInTheDocument();
  });

  it("renders canvas chart and draws price data", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    expect(
      screen.getByTestId("price-history-canvas-chart"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("price-history-canvas")).toBeInTheDocument();
    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockDrawMonotoneCurve).toHaveBeenCalled();
  });

  it("shows date range, point count, and cache badge", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: true,
        fetchedAt: "2024-01-15T12:00:00Z",
      },
    });

    expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 5/)).toBeInTheDocument();
    expect(screen.getByText(/5 data points/)).toBeInTheDocument();
    expect(screen.getByText("Cached")).toBeInTheDocument();
    expect(screen.getByTestId("fi-clock")).toBeInTheDocument();
  });

  it("does not show cache badge when cached metadata is incomplete", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: true,
        fetchedAt: null,
      },
    });

    expect(screen.queryByText("Cached")).not.toBeInTheDocument();
  });

  it("uses grab cursor only when brush is available", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(15),
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.getByTestId("price-history-canvas")).toHaveStyle({
      cursor: "grab",
    });

    vi.clearAllMocks();
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.getAllByTestId("price-history-canvas")[1]).toHaveStyle({
      cursor: "crosshair",
    });
  });

  it("renders tooltip for the nearest hovered point", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    const canvas = screen.getByTestId(
      "price-history-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 320,
      right: 800,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 100 });

    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
    expect(screen.getByText(/1\.50/)).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it("hides the tooltip when the pointer moves below the chart area", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    const canvas = screen.getByTestId(
      "price-history-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 320,
      right: 800,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 100 });
    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();

    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 310 });

    expect(screen.queryByText("Jan 1, 2024")).not.toBeInTheDocument();
  });

  it("hides the tooltip on pointer leave", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    const canvas = screen.getByTestId(
      "price-history-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 320,
      right: 800,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 100 });
    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();

    fireEvent.pointerLeave(canvas);

    expect(screen.queryByText("Jan 1, 2024")).not.toBeInTheDocument();
  });

  it("supports brush dragging and wheel zoom for larger histories", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(15),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    const canvas = screen.getByTestId(
      "price-history-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 320,
      right: 800,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);
    canvas.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 292, pointerId: 1 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    expect(canvas.style.cursor).toBe("grabbing");

    fireEvent.pointerMove(canvas, { clientX: 260, clientY: 292, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(canvas.style.cursor).toBe("grab");

    fireEvent.wheel(canvas, { deltaY: -120 });

    expect(mockSetupCanvas).toHaveBeenCalled();
  });

  it("supports resizing brush travellers and ignores null brush hits", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(15),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    const canvas = screen.getByTestId(
      "price-history-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 320,
      right: 800,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);
    canvas.releasePointerCapture = vi.fn();

    mockHitTestIndexBrush.mockReturnValueOnce("left-traveller");
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 292, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 292, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    mockHitTestIndexBrush.mockReturnValueOnce("right-traveller");
    fireEvent.pointerDown(canvas, { clientX: 750, clientY: 292, pointerId: 2 });
    fireEvent.pointerMove(canvas, { clientX: 700, clientY: 292, pointerId: 2 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });

    mockHitTestIndexBrush.mockReturnValueOnce(null);
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 292, pointerId: 3 });

    expect(canvas.setPointerCapture).toHaveBeenCalledTimes(2);
    expect(mockSetupCanvas).toHaveBeenCalled();
  });

  it("keeps drag state on pointer leave and ignores tiny wheel deltas", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(15),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    const canvas = screen.getByTestId(
      "price-history-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 320,
      right: 800,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 292, pointerId: 1 });
    fireEvent.pointerLeave(canvas);
    expect(canvas.style.cursor).toBe("grabbing");

    vi.clearAllMocks();
    fireEvent.wheel(canvas, { deltaY: 0.5 });
    expect(mockSetupCanvas).not.toHaveBeenCalled();
  });

  it("draws a single price point without collapsing the time domain", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(1),
        isFromCache: false,
        fetchedAt: null,
      },
    });

    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockDrawMonotoneCurve).toHaveBeenCalled();
  });
});
