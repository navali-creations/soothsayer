import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../CardDetails.components/CardDetailsDropTimeline/helpers", () => ({
  formatAxisDate: (_time: number) => "Jan 1",
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children, data }: any) => (
    <div data-testid="composed-chart" data-count={data?.length}>
      {children}
    </div>
  ),
  AreaChart: ({ children }: any) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: (props: any) => <div data-testid={`area-${props.dataKey}`} />,
  Bar: (props: any) => <div data-testid={`bar-${props.dataKey}`} />,
  Brush: ({ children }: any) => <div data-testid="brush">{children}</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  ReferenceLine: (props: any) => <div data-testid={`ref-line-${props.x}`} />,
  Tooltip: () => <div data-testid="tooltip" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: (props: any) => (
    <div data-testid={`y-axis-${props.yAxisId || "default"}`} />
  ),
}));

vi.mock("~/renderer/hooks", () => ({
  useChartColors: () => ({
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
  }),
}));

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card">{card.name}</div>
  ),
}));

// ─── Component imports (after mocks) ───────────────────────────────────────

import {
  MainBarShape,
  OverviewBarShape,
} from "../CardDetails.components/CardDetailsDropTimeline/BarShapes";
import DropTimelineTooltip from "../CardDetails.components/CardDetailsDropTimeline/DropTimelineTooltip";
import MainChart from "../CardDetails.components/CardDetailsDropTimeline/MainChart";
import OverviewChart from "../CardDetails.components/CardDetailsDropTimeline/OverviewChart";
import type {
  ChartDataPoint,
  LeagueMarker,
} from "../CardDetails.components/CardDetailsDropTimeline/types";
import CardDetailsVisual from "../CardDetails.components/CardDetailsVisual";

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
// MainBarShape
// ═══════════════════════════════════════════════════════════════════════════

describe("MainBarShape", () => {
  it("returns null when x is undefined", () => {
    const { container } = renderWithProviders(
      <svg>
        <MainBarShape y={10} width={20} height={30} payload={makeDataPoint()} />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("returns null when y is undefined", () => {
    const { container } = renderWithProviders(
      <svg>
        <MainBarShape x={10} width={20} height={30} payload={makeDataPoint()} />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("returns null when width or height is null", () => {
    const { container } = renderWithProviders(
      <svg>
        <MainBarShape x={10} y={10} payload={makeDataPoint()} />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("returns null when payload is undefined", () => {
    const { container } = renderWithProviders(
      <svg>
        <MainBarShape x={10} y={10} width={20} height={30} />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("returns null when payload.count is 0", () => {
    const { container } = renderWithProviders(
      <svg>
        <MainBarShape
          x={10}
          y={10}
          width={20}
          height={30}
          payload={makeDataPoint({ count: 0 })}
        />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("renders rect with correct attributes for valid data", () => {
    const { container } = renderWithProviders(
      <svg>
        <MainBarShape
          x={10}
          y={20}
          width={20}
          height={40}
          fill="#aabbcc"
          payload={makeDataPoint({ count: 5 })}
          radius={3}
        />
      </svg>,
    );
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    // cx = x + width/2 - BAR_WIDTH/2 = 10 + 10 - 2 = 18
    expect(rect).toHaveAttribute("x", "18");
    expect(rect).toHaveAttribute("y", "20");
    expect(rect).toHaveAttribute("width", "4"); // BAR_WIDTH
    expect(rect).toHaveAttribute("height", "40");
    expect(rect).toHaveAttribute("fill", "url(#dropTimelineBarGradient)");
    expect(rect).toHaveAttribute("stroke", "#aabbcc");
    expect(rect).toHaveAttribute("rx", "3");
    expect(rect).toHaveAttribute("ry", "3");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverviewBarShape
// ═══════════════════════════════════════════════════════════════════════════

describe("OverviewBarShape", () => {
  it("returns null for missing coordinates", () => {
    const { container } = renderWithProviders(
      <svg>
        <OverviewBarShape payload={makeDataPoint()} />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("returns null when x is null", () => {
    const { container } = renderWithProviders(
      <svg>
        <OverviewBarShape
          y={10}
          width={20}
          height={30}
          payload={makeDataPoint()}
        />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("returns null for zero count", () => {
    const { container } = renderWithProviders(
      <svg>
        <OverviewBarShape
          x={10}
          y={10}
          width={20}
          height={30}
          payload={makeDataPoint({ count: 0 })}
        />
      </svg>,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("renders rect with semi-transparent white fill for valid data", () => {
    const { container } = renderWithProviders(
      <svg>
        <OverviewBarShape
          x={10}
          y={20}
          width={20}
          height={40}
          fill="#112233"
          payload={makeDataPoint({ count: 2 })}
        />
      </svg>,
    );
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect).toHaveAttribute("fill", "rgba(255, 255, 255, 0.5)");
  });

  it("uses correct BAR_WIDTH and positioning", () => {
    const { container } = renderWithProviders(
      <svg>
        <OverviewBarShape
          x={10}
          y={20}
          width={20}
          height={40}
          fill="#112233"
          payload={makeDataPoint({ count: 2 })}
        />
      </svg>,
    );
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    // cx = x + width/2 - BAR_WIDTH/2 = 10 + 10 - 2 = 18
    expect(rect).toHaveAttribute("x", "18");
    expect(rect).toHaveAttribute("width", "4"); // BAR_WIDTH
    expect(rect).toHaveAttribute("rx", "1");
    expect(rect).toHaveAttribute("ry", "1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DropTimelineTooltip
// ═══════════════════════════════════════════════════════════════════════════

describe("DropTimelineTooltip", () => {
  it("returns null when active is false", () => {
    const { container } = renderWithProviders(
      <DropTimelineTooltip
        active={false}
        payload={[{ payload: makeDataPoint() } as any]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when payload is empty", () => {
    const { container } = renderWithProviders(
      <DropTimelineTooltip active={true} payload={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when payload is undefined", () => {
    const { container } = renderWithProviders(
      <DropTimelineTooltip active={true} payload={undefined} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when data point is a gap", () => {
    const { container } = renderWithProviders(
      <DropTimelineTooltip
        active={true}
        payload={[{ payload: makeDataPoint({ isGap: true }) } as any]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when data point is a boundary", () => {
    const { container } = renderWithProviders(
      <DropTimelineTooltip
        active={true}
        payload={[{ payload: makeDataPoint({ isBoundary: true }) } as any]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders date, league, dropped count, cumulative count, and decks opened for valid data", () => {
    const dataPoint = makeDataPoint({
      count: 3,
      cumulativeCount: 10,
      totalDecksOpened: 500,
      league: "Affliction",
      sessionStartedAt: "2024-01-01T12:00:00.000Z",
      sessionCount: 1,
    });

    renderWithProviders(
      <DropTimelineTooltip
        active={true}
        payload={[{ payload: dataPoint } as any]}
      />,
    );

    // Date is formatted via toLocaleDateString, check the league and stats
    expect(screen.getByText("Affliction")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // dropped count
    expect(screen.getByText("10")).toBeInTheDocument(); // cumulative
    expect(screen.getByText("500")).toBeInTheDocument(); // decks opened
    expect(screen.getByText("League")).toBeInTheDocument();
    expect(screen.getByText("Dropped")).toBeInTheDocument();
    expect(screen.getByText("Cumulative")).toBeInTheDocument();
    expect(screen.getByText("Decks Opened")).toBeInTheDocument();
  });

  it("shows Sessions row only when sessionCount > 1", () => {
    const dataPointSingle = makeDataPoint({ sessionCount: 1 });
    const { unmount } = renderWithProviders(
      <DropTimelineTooltip
        active={true}
        payload={[{ payload: dataPointSingle } as any]}
      />,
    );
    expect(screen.queryByText("Sessions")).not.toBeInTheDocument();
    unmount();

    const dataPointMulti = makeDataPoint({ sessionCount: 4 });
    renderWithProviders(
      <DropTimelineTooltip
        active={true}
        payload={[{ payload: dataPointMulti } as any]}
      />,
    );
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

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

  it("renders without errors with valid data", () => {
    renderWithProviders(
      <MainChart
        visibleData={visibleData}
        visibleMaxCumulative={6}
        visibleMaxPerSession={3}
        visibleMarkers={[]}
        c={makeChartColors() as any}
      />,
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("renders league marker reference lines", () => {
    renderWithProviders(
      <MainChart
        visibleData={visibleData}
        visibleMaxCumulative={6}
        visibleMaxPerSession={3}
        visibleMarkers={visibleMarkers}
        c={makeChartColors() as any}
      />,
    );
    expect(
      screen.getByTestId(`ref-line-${visibleMarkers[0].time}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`ref-line-${visibleMarkers[1].time}`),
    ).toBeInTheDocument();
  });

  it("contains expected chart elements", () => {
    renderWithProviders(
      <MainChart
        visibleData={visibleData}
        visibleMaxCumulative={6}
        visibleMaxPerSession={3}
        visibleMarkers={[]}
        c={makeChartColors() as any}
      />,
    );
    expect(screen.getByTestId("cartesian-grid")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("bar-count")).toBeInTheDocument();
    expect(screen.getByTestId("area-cumulativeCount")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis-cumulative")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis-per-session")).toBeInTheDocument();
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

  it("renders without errors with valid data", () => {
    renderWithProviders(
      <OverviewChart
        chartData={chartData}
        maxPerSession={3}
        brushStartIndex={0}
        brushEndIndex={2}
        handleBrushChange={handleBrushChange}
        c={makeChartColors() as any}
      />,
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("contains brush component", () => {
    renderWithProviders(
      <OverviewChart
        chartData={chartData}
        maxPerSession={3}
        brushStartIndex={0}
        brushEndIndex={2}
        handleBrushChange={handleBrushChange}
        c={makeChartColors() as any}
      />,
    );
    expect(screen.getByTestId("brush")).toBeInTheDocument();
  });

  it("renders bar and area chart elements", () => {
    renderWithProviders(
      <OverviewChart
        chartData={chartData}
        maxPerSession={3}
        brushStartIndex={0}
        brushEndIndex={2}
        handleBrushChange={handleBrushChange}
        c={makeChartColors() as any}
      />,
    );
    expect(screen.getByTestId("bar-count")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-cumulativeCount")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CardDetailsVisual
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsVisual", () => {
  const mockCard = {
    name: "The Doctor",
    artFilename: "TheDoctor",
    stackSize: 8,
    flavourText: "A doctor a day keeps the mirror away.",
  } as any;

  it("renders DivinationCard with correct card prop", () => {
    renderWithProviders(<CardDetailsVisual card={mockCard} />);
    const divCard = screen.getByTestId("divination-card");
    expect(divCard).toBeInTheDocument();
    expect(divCard).toHaveTextContent("The Doctor");
  });

  it("wraps in a centered container", () => {
    const { container } = renderWithProviders(
      <CardDetailsVisual card={mockCard} />,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass("flex", "justify-center");
  });
});
