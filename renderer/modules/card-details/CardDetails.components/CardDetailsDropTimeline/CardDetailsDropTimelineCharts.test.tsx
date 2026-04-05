import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("./helpers", () => ({
  formatAxisDate: (_time: number) => "Jan 1",
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children, height }: any) => (
    <div data-testid="responsive-container" data-height={height}>
      {children}
    </div>
  ),
  ComposedChart: ({ children, data }: any) => (
    <div data-testid="composed-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  Area: (props: any) => <div data-testid={`area-${props.dataKey}`} />,
  AreaChart: ({ children }: any) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Bar: (props: any) => <div data-testid={`bar-${props.dataKey}`} />,
  Brush: () => <div data-testid="brush" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  ReferenceLine: (props: any) => (
    <div data-testid="reference-line" data-label={props.label?.value} />
  ),
  Tooltip: () => <div data-testid="tooltip" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: (props: any) => (
    <div data-testid={`y-axis-${props.yAxisId || "default"}`} />
  ),
}));

vi.mock("~/renderer/hooks", () => ({
  useChartColors: vi.fn(() => ({
    primary: "#ff0000",
    primary15: "rgba(255,0,0,0.15)",
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
  })),
}));

vi.mock("./BarShapes", () => ({
  MainBarShape: () => <div data-testid="main-bar-shape" />,
  OverviewBarShape: () => <div data-testid="overview-bar-shape" />,
}));

vi.mock("./DropTimelineTooltip", () => ({
  default: () => <div data-testid="drop-timeline-tooltip" />,
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import { CHART_HEIGHT, OVERVIEW_HEIGHT } from "./constants";
import MainChart from "./MainChart";
import OverviewChart from "./OverviewChart";
import type { ChartDataPoint, LeagueMarker } from "./types";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeDataPoint(
  overrides: Partial<ChartDataPoint> = {},
): ChartDataPoint {
  return {
    time: 1704067200000, // 2024-01-01
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
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MainChart
// ═══════════════════════════════════════════════════════════════════════════

describe("MainChart", () => {
  const visibleData: ChartDataPoint[] = [
    makeDataPoint({ time: 1704067200000, count: 2, cumulativeCount: 2 }),
    makeDataPoint({ time: 1704153600000, count: 3, cumulativeCount: 5 }),
    makeDataPoint({ time: 1704240000000, count: 1, cumulativeCount: 6 }),
  ];

  const visibleMarkers: LeagueMarker[] = [
    { time: 1704067200000, label: "Affliction Start", type: "start" },
    { time: 1714521600000, label: "Affliction End", type: "end" },
  ];

  function renderMainChart(
    overrides: Partial<Parameters<typeof MainChart>[0]> = {},
  ) {
    return renderWithProviders(
      <MainChart
        visibleData={visibleData}
        visibleMaxCumulative={6}
        visibleMaxPerSession={3}
        visibleMarkers={[]}
        c={makeChartColors() as any}
        {...overrides}
      />,
    );
  }

  it("renders ResponsiveContainer and ComposedChart", () => {
    renderMainChart();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("renders CartesianGrid", () => {
    renderMainChart();
    expect(screen.getByTestId("cartesian-grid")).toBeInTheDocument();
  });

  it("renders XAxis", () => {
    renderMainChart();
    expect(screen.getByTestId("x-axis")).toBeInTheDocument();
  });

  it("renders left Y-axis (cumulative) and right Y-axis (per-session)", () => {
    renderMainChart();
    expect(screen.getByTestId("y-axis-cumulative")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis-per-session")).toBeInTheDocument();
  });

  it("renders cumulative area", () => {
    renderMainChart();
    expect(screen.getByTestId("area-cumulativeCount")).toBeInTheDocument();
  });

  it("renders count bar", () => {
    renderMainChart();
    expect(screen.getByTestId("bar-count")).toBeInTheDocument();
  });

  it("renders tooltip", () => {
    renderMainChart();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
  });

  it("renders reference lines for each league marker", () => {
    renderMainChart({ visibleMarkers });
    const refLines = screen.getAllByTestId("reference-line");
    expect(refLines).toHaveLength(2);
    expect(refLines[0]).toHaveAttribute("data-label", "Affliction Start");
    expect(refLines[1]).toHaveAttribute("data-label", "Affliction End");
  });

  it("renders no reference lines when visibleMarkers is empty", () => {
    renderMainChart({ visibleMarkers: [] });
    expect(screen.queryByTestId("reference-line")).not.toBeInTheDocument();
  });

  it("sets container height to CHART_HEIGHT", () => {
    const { container } = renderMainChart();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe(`${CHART_HEIGHT}px`);
    expect(CHART_HEIGHT).toBe(220);
  });

  it("passes correct number of data points", () => {
    renderMainChart();
    const chart = screen.getByTestId("composed-chart");
    expect(chart).toHaveAttribute("data-points", String(visibleData.length));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverviewChart
// ═══════════════════════════════════════════════════════════════════════════

describe("OverviewChart", () => {
  const chartData: ChartDataPoint[] = [
    makeDataPoint({ time: 1704067200000, count: 2, cumulativeCount: 2 }),
    makeDataPoint({ time: 1704153600000, count: 3, cumulativeCount: 5 }),
    makeDataPoint({ time: 1704240000000, count: 1, cumulativeCount: 6 }),
  ];

  const handleBrushChange = vi.fn();

  function renderOverviewChart(
    overrides: Partial<Parameters<typeof OverviewChart>[0]> = {},
  ) {
    return renderWithProviders(
      <OverviewChart
        chartData={chartData}
        maxPerSession={3}
        brushStartIndex={0}
        brushEndIndex={2}
        handleBrushChange={handleBrushChange}
        c={makeChartColors() as any}
        {...overrides}
      />,
    );
  }

  it("renders ResponsiveContainer and ComposedChart", () => {
    renderOverviewChart();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("renders bars with count data key", () => {
    renderOverviewChart();
    expect(screen.getByTestId("bar-count")).toBeInTheDocument();
  });

  it("renders Brush component", () => {
    renderOverviewChart();
    expect(screen.getByTestId("brush")).toBeInTheDocument();
  });

  it("passes correct data point count", () => {
    renderOverviewChart();
    const chart = screen.getByTestId("composed-chart");
    expect(chart).toHaveAttribute("data-points", String(chartData.length));
  });

  it("sets container height to OVERVIEW_HEIGHT", () => {
    const { container } = renderOverviewChart();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe(`${OVERVIEW_HEIGHT}px`);
    expect(OVERVIEW_HEIGHT).toBe(80);
  });
});
