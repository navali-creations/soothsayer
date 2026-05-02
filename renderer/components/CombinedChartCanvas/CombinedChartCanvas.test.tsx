import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CombinedChartCanvas } from "./CombinedChartCanvas";
import type {
  BrushRange,
  ChartColors,
  ChartDataPoint,
} from "./chart-types/chart-types";
import * as drawFunctions from "./draw-functions/draw-functions";

// We need to access the tooltip mock to override it per-test
const useTooltipPositionMock = vi.hoisted(() => vi.fn());

// ─── Mocks ─────────────────────────────────────────────────────────────────

let mockLayout = {
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
};

vi.mock("./canvas-chart-utils/canvas-chart-utils", () => ({
  CLIP_BLEED: 2,
  computeDomains: () => ({
    profit: { min: -100, max: 100 },
    decks: { min: 0, max: 500 },
  }),
  computeLayout: () => mockLayout,
  DPR: () => 1,
  sumProfitDivine: (chartData: ChartDataPoint[]) =>
    chartData.reduce((sum, point) => sum + point.profitDivine, 0),
  resolveLeagueStartMarkerIndex: ({
    chartData,
    leagueStartMarker,
  }: {
    chartData: ChartDataPoint[];
    leagueStartMarker: { time: number } | null;
  }) => {
    if (!leagueStartMarker || chartData.length < 2) return null;
    return 1;
  },
  resolveVisibleLeagueStartMarker: ({
    brushRange,
    leagueStartMarker,
    leagueStartMarkerIndex,
  }: {
    brushRange: BrushRange;
    leagueStartMarker: { label: string } | null;
    leagueStartMarkerIndex: number | null;
  }) => {
    if (leagueStartMarkerIndex === null || !leagueStartMarker) return null;
    if (
      leagueStartMarkerIndex < brushRange.startIndex ||
      leagueStartMarkerIndex > brushRange.endIndex
    ) {
      return null;
    }
    return {
      label: leagueStartMarker.label,
      visibleIndex: leagueStartMarkerIndex - brushRange.startIndex,
      fullIndex: leagueStartMarkerIndex,
    };
  },
}));

const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  clearRect: vi.fn(),
  setTransform: vi.fn(),
};

vi.mock("./draw-functions/draw-functions", () => ({
  drawBrush: vi.fn(),
  drawDecksScatter: vi.fn(),
  drawGrid: vi.fn(),
  drawHoverHighlight: vi.fn(),
  drawLeagueStartMarker: vi.fn(),
  drawProfitArea: vi.fn(),
  drawXAxis: vi.fn(),
  drawYAxisDecks: vi.fn(),
  drawYAxisProfit: vi.fn(),
}));

const mockCanvasRef = { current: null as HTMLCanvasElement | null };

vi.mock("./hooks/useCanvasResize/useCanvasResize", () => ({
  useCanvasResize: () => ({
    containerRef: vi.fn(),
    containerElRef: { current: null },
    canvasRef: mockCanvasRef,
    canvasSize: { width: 800, height: 450 },
  }),
}));

let mockSetupCanvasReturn: any; // undefined means use default behavior

vi.mock("~/renderer/lib/canvas-core", () => ({
  createLinearMapper: (
    domainMin: number,
    domainMax: number,
    rangeMin: number,
    rangeMax: number,
  ) => {
    const fn = (v: number) => {
      if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
      return (
        rangeMin +
        ((v - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin)
      );
    };
    fn.inverse = (px: number) => {
      if (rangeMax === rangeMin) return domainMin;
      return (
        domainMin +
        ((px - rangeMin) / (rangeMax - rangeMin)) * (domainMax - domainMin)
      );
    };
    return fn;
  },
  setupCanvas: (canvas: HTMLCanvasElement | null) => {
    if (mockSetupCanvasReturn !== undefined) return mockSetupCanvasReturn;
    if (!canvas) return null;
    return {
      ctx: mockCtx,
      width: canvas.width || 800,
      height: canvas.height || 450,
    };
  },
  nearestPointHitTest: () => ({ index: -1 }),
}));

vi.mock("./hooks/useChartInteractions/useChartInteractions", () => ({
  useChartInteractions: vi.fn(),
}));

vi.mock("./hooks/useScrollZoom/useScrollZoom", () => ({
  useScrollZoom: vi.fn(),
}));

vi.mock("./hooks/useTooltipPosition/useTooltipPosition", () => ({
  useTooltipPosition: useTooltipPositionMock.mockReturnValue({
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
    mockSetupCanvasReturn = undefined;
    mockLayout = {
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
    };
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

  describe("draw callback", () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 450;
      mockCanvasRef.current = canvas;
    });

    afterEach(() => {
      mockCanvasRef.current = null;
    });

    it("invokes all draw functions when draw is triggered via useEffect", () => {
      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      // draw() is called in useEffect(() => { draw() }, [draw])
      // With canvasRef.current set and setupCanvas returning a ctx, draw body executes
      expect(drawFunctions.drawGrid).toHaveBeenCalled();
      expect(drawFunctions.drawYAxisDecks).toHaveBeenCalled();
      expect(drawFunctions.drawYAxisProfit).toHaveBeenCalled();
      expect(drawFunctions.drawXAxis).toHaveBeenCalled();
      expect(drawFunctions.drawProfitArea).toHaveBeenCalled();
      expect(drawFunctions.drawDecksScatter).toHaveBeenCalled();
      expect(drawFunctions.drawHoverHighlight).toHaveBeenCalled();
    });

    it("clips to chart area before drawing data", () => {
      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.clip).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    describe("tooltip DOM", () => {
      it("renders tooltip with session info when tooltip is visible with a valid point", () => {
        const tp = {
          sessionIndex: 5,
          sessionDate: "2024-03-15",
          rawDecks: 250,
          profitDivine: 12.5,
          chaosPerDivine: 150,
          league: "Settlers",
        };

        useTooltipPositionMock.mockReturnValue({
          tooltipRef: { current: null },
          tooltip: { visible: true, x: 100, y: 200, dataPoint: tp },
          setTooltip: vi.fn(),
          tooltipStyle: { position: "absolute", left: 100, top: 200 },
        });

        renderWithProviders(<CombinedChartCanvas {...defaultProps} />);

        expect(screen.getByText("Session 5")).toBeInTheDocument();
        expect(screen.getByText("Decks")).toBeInTheDocument();
        expect(screen.getByText("Profit")).toBeInTheDocument();
        expect(screen.getByText("250")).toBeInTheDocument();
        expect(screen.getByText("12.5 div")).toBeInTheDocument();
      });

      it("renders tooltip date formatted correctly", () => {
        const tp = {
          sessionIndex: 2,
          sessionDate: "2024-01-15",
          rawDecks: 100,
          profitDivine: 5.0,
          chaosPerDivine: 150,
          league: "Settlers",
        };

        useTooltipPositionMock.mockReturnValue({
          tooltipRef: { current: null },
          tooltip: { visible: true, x: 100, y: 200, dataPoint: tp },
          setTooltip: vi.fn(),
          tooltipStyle: { position: "absolute", left: 100, top: 200 },
        });

        renderWithProviders(<CombinedChartCanvas {...defaultProps} />);

        expect(screen.getByText("Session 2")).toBeInTheDocument();
        // Date formatted as "Jan 15, 2024"
        expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
      });

      it("hides decks metric in tooltip when decks is hidden", () => {
        const tp = {
          sessionIndex: 1,
          sessionDate: "2024-01-01",
          rawDecks: 100,
          profitDivine: 5.0,
          chaosPerDivine: 150,
          league: "Settlers",
        };

        useTooltipPositionMock.mockReturnValue({
          tooltipRef: { current: null },
          tooltip: { visible: true, x: 100, y: 200, dataPoint: tp },
          setTooltip: vi.fn(),
          tooltipStyle: { position: "absolute", left: 100, top: 200 },
        });

        renderWithProviders(
          <CombinedChartCanvas
            {...defaultProps}
            hiddenMetrics={new Set(["decks"]) as Set<any>}
          />,
        );

        expect(screen.queryByText("Decks")).not.toBeInTheDocument();
        expect(screen.getByText("Profit")).toBeInTheDocument();
      });

      it("renders tooltip with league badge when statScope is all-time and tp.league is set", () => {
        const tp = {
          sessionIndex: 3,
          sessionDate: "2024-02-10",
          rawDecks: 200,
          profitDivine: 8.0,
          chaosPerDivine: 150,
          league: "Settlers",
        };

        useTooltipPositionMock.mockReturnValue({
          tooltipRef: { current: null },
          tooltip: { visible: true, x: 100, y: 200, dataPoint: tp },
          setTooltip: vi.fn(),
          tooltipStyle: { position: "absolute", left: 100, top: 200 },
        });

        renderWithProviders(
          <CombinedChartCanvas {...defaultProps} statScope="all-time" />,
        );

        // League badge should be rendered
        expect(screen.getByText("Settlers")).toBeInTheDocument();
        // Ratio footer should also be present
        expect(screen.getByText("150c : 1div")).toBeInTheDocument();
      });

      it("does not render league badge when statScope is league", () => {
        const tp = {
          sessionIndex: 3,
          sessionDate: "2024-02-10",
          rawDecks: 200,
          profitDivine: 8.0,
          chaosPerDivine: 150,
          league: "Settlers",
        };

        useTooltipPositionMock.mockReturnValue({
          tooltipRef: { current: null },
          tooltip: { visible: true, x: 100, y: 200, dataPoint: tp },
          setTooltip: vi.fn(),
          tooltipStyle: { position: "absolute", left: 100, top: 200 },
        });

        renderWithProviders(
          <CombinedChartCanvas {...defaultProps} statScope="league" />,
        );

        // League badge should NOT be rendered
        expect(screen.queryByText("Settlers")).not.toBeInTheDocument();
        // Ratio footer should still be present
        expect(screen.getByText("150c : 1div")).toBeInTheDocument();
      });
    });

    it("draws brush when showBrush is true and chartData is non-empty", () => {
      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          showBrush={true}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      expect(drawFunctions.drawBrush).toHaveBeenCalled();
    });

    it("passes markerIndex to brush even when marker is outside visible brush window", () => {
      vi.mocked(drawFunctions.drawBrush).mockClear();
      const chartData = [
        makeChartData(1)[0],
        {
          ...makeChartData(1)[0],
          sessionIndex: 2,
          sessionDate: "2024-01-02",
        },
        {
          ...makeChartData(1)[0],
          sessionIndex: 3,
          sessionDate: "2024-01-03",
        },
      ];

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          showBrush={true}
          chartData={chartData}
          brushRange={{ startIndex: 2, endIndex: 2 }}
          leagueStartMarker={{
            time: new Date("2024-01-01T12:00:00.000Z").getTime(),
            label: "Mirage",
          }}
        />,
      );

      const brushContext = vi.mocked(drawFunctions.drawBrush).mock.calls[0][0];
      expect(brushContext.markerIndex).not.toBeNull();
    });

    it("does not draw brush when showBrush is false", () => {
      vi.mocked(drawFunctions.drawBrush).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          showBrush={false}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      expect(drawFunctions.drawBrush).not.toHaveBeenCalled();
    });

    it("does not draw brush when chartData is empty", () => {
      vi.mocked(drawFunctions.drawBrush).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          showBrush={true}
          chartData={[]}
          brushRange={{ startIndex: 0, endIndex: 0 }}
        />,
      );

      expect(drawFunctions.drawBrush).not.toHaveBeenCalled();
    });

    it("exits early when setupCanvas returns null", () => {
      mockSetupCanvasReturn = null;
      vi.mocked(drawFunctions.drawGrid).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      expect(drawFunctions.drawGrid).not.toHaveBeenCalled();
    });

    it("exits early when layout has zero chartWidth", () => {
      mockLayout = { ...mockLayout, chartWidth: 0 };
      vi.mocked(drawFunctions.drawGrid).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      expect(drawFunctions.drawGrid).not.toHaveBeenCalled();
    });

    it("exits early when layout has zero chartHeight", () => {
      mockLayout = { ...mockLayout, chartHeight: 0 };
      vi.mocked(drawFunctions.drawGrid).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      expect(drawFunctions.drawGrid).not.toHaveBeenCalled();
    });

    it("passes correct DrawContext colors to draw functions", () => {
      vi.mocked(drawFunctions.drawGrid).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          chartData={makeChartData(5)}
          brushRange={makeBrushRange(5)}
        />,
      );

      // Verify drawGrid was called with a DrawContext that includes the color info
      const dc = vi.mocked(drawFunctions.drawGrid).mock.calls[0][0];
      expect(dc.colors).toBeDefined();
      expect(dc.colors.c).toEqual(defaultProps.c);
      expect(dc.layout).toBeDefined();
    });

    it("uses midpoint mappers for single-point chart and brush data", () => {
      vi.mocked(drawFunctions.drawGrid).mockClear();
      vi.mocked(drawFunctions.drawBrush).mockClear();

      renderWithProviders(
        <CombinedChartCanvas
          {...defaultProps}
          showBrush={true}
          chartData={makeChartData(1)}
          brushRange={makeBrushRange(1)}
        />,
      );

      const dc = vi.mocked(drawFunctions.drawGrid).mock.calls[0][0];
      expect(dc.mapX(0)).toBe(mockLayout.chartLeft + mockLayout.chartWidth / 2);
      expect(dc.mapX.inverse(123)).toBe(0);

      const bdc = vi.mocked(drawFunctions.drawBrush).mock.calls[0][0];
      expect(bdc.mapBrushX(0)).toBe(
        mockLayout.brushLeft +
          (mockLayout.brushRight - mockLayout.brushLeft) / 2,
      );
      expect(bdc.mapBrushX.inverse(123)).toBe(0);
    });
  });
});
