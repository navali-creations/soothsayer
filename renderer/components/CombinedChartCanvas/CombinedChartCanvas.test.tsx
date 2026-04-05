import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CombinedChartCanvas } from "./CombinedChartCanvas";
import type {
  BrushRange,
  ChartColors,
  ChartDataPoint,
} from "./chart-types/chart-types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("./canvas-chart-utils/canvas-chart-utils", () => ({
  CLIP_BLEED: 2,
  computeDomains: () => ({
    profit: { min: -100, max: 100 },
    decks: { min: 0, max: 500 },
  }),
  computeLayout: () => ({
    chartLeft: 50,
    chartRight: 750,
    chartTop: 10,
    chartBottom: 400,
    chartWidth: 700,
    chartHeight: 390,
    brushLeft: 50,
    brushRight: 750,
    brushTop: 410,
    brushBottom: 440,
    brushHeight: 30,
  }),
  DPR: () => 1,
}));

vi.mock("./draw-functions/draw-functions", () => ({
  drawBrush: vi.fn(),
  drawDecksScatter: vi.fn(),
  drawGrid: vi.fn(),
  drawHoverHighlight: vi.fn(),
  drawProfitArea: vi.fn(),
  drawXAxis: vi.fn(),
  drawYAxisDecks: vi.fn(),
  drawYAxisProfit: vi.fn(),
}));

vi.mock("./hooks/useCanvasResize/useCanvasResize", () => ({
  useCanvasResize: () => ({
    containerRef: vi.fn(),
    containerElRef: { current: null },
    canvasRef: { current: null },
    canvasSize: { width: 800, height: 450 },
  }),
}));

vi.mock("./hooks/useChartInteractions/useChartInteractions", () => ({
  useChartInteractions: vi.fn(),
}));

vi.mock("./hooks/useScrollZoom/useScrollZoom", () => ({
  useScrollZoom: vi.fn(),
}));

vi.mock("./hooks/useTooltipPosition/useTooltipPosition", () => ({
  useTooltipPosition: () => ({
    tooltipRef: { current: null },
    tooltip: { visible: false, x: 0, y: 0, dataPoint: null },
    setTooltip: vi.fn(),
    tooltipStyle: { display: "none" },
  }),
}));

vi.mock("./LegendIcon", () => ({
  LegendIcon: ({ visual, color }: any) => (
    <span data-testid={`legend-icon-${visual}`} style={{ color }} />
  ),
}));

vi.mock("./chart-types/chart-types", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./chart-types/chart-types")>();
  return {
    ...actual,
    resolveColor: (_c: any, key: string) => `resolved-${key}`,
  };
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeColors(): ChartColors {
  return {
    primary: "#3b82f6",
    primary02: "rgba(59,130,246,0.02)",
    primary30: "rgba(59,130,246,0.3)",
    secondary: "#8b5cf6",
    secondary02: "rgba(139,92,246,0.02)",
    secondary30: "rgba(139,92,246,0.3)",
  };
}

function makeChartData(count = 3): ChartDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    sessionIndex: i + 1,
    sessionDate: `2024-01-${String(i + 1).padStart(2, "0")}`,
    rawDecks: (i + 1) * 100,
    profitDivine: (i + 1) * 10 - 15,
    chaosPerDivine: 150,
    league: "Settlers",
  }));
}

function makeBrushRange(length = 3): BrushRange {
  return { startIndex: 0, endIndex: length - 1 };
}

const defaultProps = {
  chartData: makeChartData(),
  c: makeColors(),
  hiddenMetrics: new Set<never>(),
  showBrush: false,
  brushRange: makeBrushRange(),
  onBrushChange: vi.fn(),
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CombinedChartCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a container div with a canvas element", () => {
    const { container } = renderWithProviders(
      <CombinedChartCanvas {...defaultProps} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("does not show tooltip when tooltip is not visible", () => {
    renderWithProviders(<CombinedChartCanvas {...defaultProps} />);

    // No tooltip content should be in DOM
    expect(screen.queryByText(/Session/)).not.toBeInTheDocument();
  });

  it("renders without crashing when chartData is empty", () => {
    renderWithProviders(
      <CombinedChartCanvas
        {...defaultProps}
        chartData={[]}
        brushRange={{ startIndex: 0, endIndex: 0 }}
      />,
    );

    // Should not throw
  });

  it("renders without crashing when showBrush is true", () => {
    renderWithProviders(
      <CombinedChartCanvas {...defaultProps} showBrush={true} />,
    );

    // Should not throw
  });

  it("renders without crashing with hidden metrics", () => {
    const hiddenMetrics = new Set(["decks", "profit"]) as Set<any>;

    renderWithProviders(
      <CombinedChartCanvas {...defaultProps} hiddenMetrics={hiddenMetrics} />,
    );

    // Should not throw
  });

  it("applies cursor grab style to canvas", () => {
    const { container } = renderWithProviders(
      <CombinedChartCanvas {...defaultProps} />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas?.style.cursor).toBe("grab");
  });
});
