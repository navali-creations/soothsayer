import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFBreakevenChart from "./PFBreakevenChart";

const mockCanvasRef = vi.hoisted(() => ({
  current: null as HTMLCanvasElement | null,
}));
const mockContainerElRef = vi.hoisted(() => ({
  current: {
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 260,
      right: 800,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
  } as unknown as HTMLDivElement,
}));

const mockSetupCanvas = vi.hoisted(() => vi.fn());
const mockDrawMonotoneCurve = vi.hoisted(() => vi.fn());

const mockCtx = vi.hoisted(() => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  strokeRect: vi.fn(),
  setLineDash: vi.fn(),
  arc: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
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
  DPR: () => 1,
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
  setupCanvas: mockSetupCanvas,
  useCanvasResize: () => ({
    containerRef: vi.fn(),
    containerElRef: mockContainerElRef,
    canvasRef: mockCanvasRef,
    canvasSize: { width: 800, height: 260 },
  }),
}));

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/hooks", () => ({
  useChartColors: vi.fn(() => ({
    bc100: "#fff",
    bc50: "rgba(255,255,255,0.5)",
    bc40: "rgba(255,255,255,0.4)",
    bc35: "rgba(255,255,255,0.35)",
    bc30: "rgba(255,255,255,0.3)",
    bc20: "rgba(255,255,255,0.2)",
    bc15: "rgba(255,255,255,0.15)",
    bc12: "rgba(255,255,255,0.12)",
    bc10: "rgba(255,255,255,0.1)",
    bc08: "rgba(255,255,255,0.08)",
    bc07: "rgba(255,255,255,0.07)",
    bc06: "rgba(255,255,255,0.06)",
    bc05: "rgba(255,255,255,0.05)",
    primary: "#00f",
    primary60: "rgba(0,0,255,0.6)",
    primary30: "rgba(0,0,255,0.3)",
    primary15: "rgba(0,0,255,0.15)",
    primary08: "rgba(0,0,255,0.08)",
    primary02: "rgba(0,0,255,0.02)",
    b1: "#111",
    b2: "#222",
    b3: "#333",
    success: "#0f0",
    success50: "rgba(0,255,0,0.5)",
    success30: "rgba(0,255,0,0.3)",
    success05: "rgba(0,255,0,0.05)",
    info: "#0ff",
    info80: "rgba(0,255,255,0.8)",
    info30: "rgba(0,255,255,0.3)",
    warning: "#ff0",
    warning50: "rgba(255,255,0,0.5)",
  })),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

const DEFAULT_CURVE = [
  { deckCount: 200, estimated: 40, optimistic: 200 },
  { deckCount: 400, estimated: 80, optimistic: 400 },
  { deckCount: 600, estimated: 120, optimistic: 600 },
  { deckCount: 800, estimated: 160, optimistic: 800 },
  { deckCount: 1000, estimated: 200, optimistic: 1000 },
  { deckCount: 2000, estimated: 400, optimistic: 1600 },
  { deckCount: 3000, estimated: 700, optimistic: 2400 },
  { deckCount: 5000, estimated: 1500, optimistic: 4000 },
  { deckCount: 7500, estimated: 3000, optimistic: 8000 },
  { deckCount: 10000, estimated: 5000, optimistic: 12000 },
];

function createMockStore(overrides: any = {}) {
  return {
    chaosToDivineRatio: 200,
    isLoading: false,
    selectedBatch: 10000,
    hasData: vi.fn(() => true),
    cachedPnLCurve: DEFAULT_CURVE,
    getPnLCurve: vi.fn(() => DEFAULT_CURVE),
    ...overrides.profitForecast,
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue({ profitForecast: store } as any);
  return store;
}

describe("PFBreakevenChart", () => {
  beforeEach(() => {
    mockSetupCanvas.mockReturnValue({
      ctx: mockCtx,
      width: 800,
      height: 260,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockCanvasRef.current = null;
  });

  it("renders a canvas chart when data is available", () => {
    setupStore();

    renderWithProviders(<PFBreakevenChart />);

    expect(screen.getByTestId("pf-breakeven-chart")).toBeInTheDocument();
    expect(screen.getByTestId("pf-breakeven-canvas")).toBeInTheDocument();
  });

  it("draws grid, axes, curves, and break-even label", () => {
    setupStore();

    renderWithProviders(<PFBreakevenChart />);

    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockDrawMonotoneCurve).toHaveBeenCalledTimes(4);
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      "Break-even",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("renders x-axis labels for every sampled pnl curve point", () => {
    setupStore();

    renderWithProviders(<PFBreakevenChart />);

    for (const label of [
      "200",
      "400",
      "600",
      "800",
      "1k",
      "2k",
      "3k",
      "5k",
      "8k",
      "10k",
    ]) {
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        label,
        expect.any(Number),
        expect.any(Number),
      );
    }
  });

  it("shows empty state when hasData returns false", () => {
    setupStore({
      profitForecast: { hasData: vi.fn(() => false) },
    });

    renderWithProviders(<PFBreakevenChart />);

    expect(screen.getByTestId("pf-breakeven-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("pf-breakeven-chart")).not.toBeInTheDocument();
  });

  it("shows empty state when isLoading is true", () => {
    setupStore({
      profitForecast: { isLoading: true },
    });

    renderWithProviders(<PFBreakevenChart />);

    expect(screen.getByTestId("pf-breakeven-empty")).toBeInTheDocument();
  });

  it("shows empty state when curve data is empty", () => {
    setupStore({
      profitForecast: { cachedPnLCurve: [] },
    });

    renderWithProviders(<PFBreakevenChart />);

    expect(screen.getByTestId("pf-breakeven-empty")).toBeInTheDocument();
  });

  it("renders tooltip content for the nearest hovered point", () => {
    setupStore();

    renderWithProviders(<PFBreakevenChart />);

    const canvas = screen.getByTestId(
      "pf-breakeven-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 260,
      right: 800,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 62, clientY: 80 });

    expect(screen.getByText("200 decks")).toBeInTheDocument();
    expect(screen.getByText(/Optimistic:/)).toHaveTextContent("1.00 d");
    expect(screen.getByText(/Estimated:/)).toHaveTextContent("0.20 d");
  });

  it("hides an existing tooltip when the cursor leaves the hit threshold", () => {
    setupStore();

    renderWithProviders(<PFBreakevenChart />);

    const canvas = screen.getByTestId(
      "pf-breakeven-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 260,
      right: 800,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 62, clientY: 80 });
    expect(screen.getByText("200 decks")).toBeInTheDocument();

    fireEvent.pointerMove(canvas, { clientX: 101, clientY: 80 });

    expect(screen.queryByText("200 decks")).not.toBeInTheDocument();
  });

  it("hides an existing tooltip on pointer leave", () => {
    setupStore();

    renderWithProviders(<PFBreakevenChart />);

    const canvas = screen.getByTestId(
      "pf-breakeven-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 260,
      right: 800,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 62, clientY: 80 });
    expect(screen.getByText("200 decks")).toBeInTheDocument();

    fireEvent.pointerLeave(canvas);

    expect(screen.queryByText("200 decks")).not.toBeInTheDocument();
  });

  it("draws a single zero point without collapsing either domain", () => {
    setupStore({
      profitForecast: {
        cachedPnLCurve: [{ deckCount: 500, estimated: 0, optimistic: 0 }],
      },
    });

    renderWithProviders(<PFBreakevenChart />);

    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockDrawMonotoneCurve).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      "500",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("uses updated cached curve data after the store changes", () => {
    setupStore();

    const { rerender } = renderWithProviders(<PFBreakevenChart />);

    const canvas = screen.getByTestId(
      "pf-breakeven-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 260,
      right: 800,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 62, clientY: 80 });
    expect(screen.getByText("200 decks")).toBeInTheDocument();

    setupStore({
      profitForecast: {
        cachedPnLCurve: [
          { deckCount: 200, estimated: 60, optimistic: 300 },
          { deckCount: 400, estimated: 120, optimistic: 600 },
          { deckCount: 600, estimated: 180, optimistic: 900 },
          { deckCount: 800, estimated: 240, optimistic: 1200 },
          { deckCount: 1000, estimated: 300, optimistic: 1500 },
          { deckCount: 2000, estimated: 600, optimistic: 2000 },
          { deckCount: 3000, estimated: 900, optimistic: 3000 },
          { deckCount: 5000, estimated: 2000, optimistic: 5000 },
          { deckCount: 7500, estimated: 5000, optimistic: 10000 },
          { deckCount: 10000, estimated: 9000, optimistic: 18000 },
        ],
      },
    });
    rerender(<PFBreakevenChart />);

    fireEvent.pointerMove(canvas, { clientX: 62, clientY: 80 });

    expect(screen.getByText("200 decks")).toBeInTheDocument();
    expect(screen.getByText(/Optimistic:/)).toHaveTextContent("1.50 d");
    expect(screen.getByText(/Estimated:/)).toHaveTextContent("0.30 d");
  });

  it("uses dash divine formatting when the ratio is not usable", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 0 } });

    renderWithProviders(<PFBreakevenChart />);

    const canvas = screen.getByTestId(
      "pf-breakeven-canvas",
    ) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 260,
      right: 800,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 62, clientY: 80 });

    expect(screen.getAllByText(/\u2014 d/)).toHaveLength(2);
  });
});
