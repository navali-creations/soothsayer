import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useCardDetails: vi.fn() }));

// ─── Hook mocks ────────────────────────────────────────────────────────────

vi.mock("~/renderer/hooks", () => ({
  useChartColors: () => ({
    primary: "#ff0000",
    b1: "#1a1a2e",
    b2: "#16213e",
    bc05: "rgba(255,255,255,0.05)",
    bc06: "rgba(255,255,255,0.06)",
    bc10: "rgba(255,255,255,0.1)",
    bc15: "rgba(255,255,255,0.15)",
    bc35: "rgba(255,255,255,0.35)",
  }),
}));

// ─── Recharts mocks ────────────────────────────────────────────────────────

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children, data }: any) => (
    <div data-testid="composed-chart" data-count={data?.length}>
      {children}
    </div>
  ),
  Area: (props: any) => <div data-testid={`area-${props.dataKey}`} />,
  Bar: (props: any) => <div data-testid={`bar-${props.dataKey}`} />,
  Brush: () => <div data-testid="brush" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: (props: any) => (
    <div data-testid={`y-axis-${props.yAxisId || "default"}`} />
  ),
}));

// ─── react-icons mocks ─────────────────────────────────────────────────────

vi.mock("react-icons/fi", () => ({
  FiClock: (props: any) => <span data-testid="fi-clock" {...props} />,
  FiAlertCircle: (props: any) => <span data-testid="fi-alert" {...props} />,
}));

// ─── Sub-component stubs (only used by CardDetailsPriceChart) ──────────────

vi.mock("./PriceChartEmpty", () => ({
  default: () => <div data-testid="price-chart-empty" />,
}));

vi.mock("./PriceChartError", () => ({
  default: () => <div data-testid="price-chart-error" />,
}));

// ─── Helpers mock ──────────────────────────────────────────────────────────

vi.mock("./helpers", () => ({
  formatAxisDate: (_time: number) => "Jan 1",
  mapHistoryToChartData: (history: any[]) =>
    history.map((h: any, i: number) => ({
      time: h.time ?? Date.now() + i * 86400000,
      dateLabel: `Jan ${i + 1}`,
      rate: h.divineValue ?? 1,
      volume: h.volume ?? 100,
    })),
  formatDateFull: (_iso: string) => "January 1, 2024",
  formatRate: (value: number) => value.toFixed(1),
  formatVolume: (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return String(value);
  },
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import CardDetailsPriceChart from "./CardDetailsPriceChart";
import ChartTooltip from "./ChartTooltip";
import { BRUSH_HEIGHT, CHART_HEIGHT } from "./constants";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// constants.ts
// ═══════════════════════════════════════════════════════════════════════════

describe("constants", () => {
  it("exports CHART_HEIGHT equal to 320", () => {
    expect(CHART_HEIGHT).toBe(320);
  });

  it("exports BRUSH_HEIGHT equal to 40", () => {
    expect(BRUSH_HEIGHT).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceChartEmpty (uses importActual to bypass the stub mock)
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceChartEmpty", () => {
  let RealPriceChartEmpty: React.ComponentType;

  beforeEach(async () => {
    const mod = await vi.importActual<{ default: React.ComponentType }>(
      "./PriceChartEmpty",
    );
    RealPriceChartEmpty = mod.default;
  });

  it('renders "Price History" heading', () => {
    renderWithProviders(<RealPriceChartEmpty />);
    expect(screen.getByText("Price History")).toBeInTheDocument();
  });

  it("renders the empty message text", () => {
    renderWithProviders(<RealPriceChartEmpty />);
    expect(
      screen.getByText("No price history available for this card."),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceChartError (uses importActual to bypass the stub mock)
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceChartError", () => {
  let RealPriceChartError: React.ComponentType;

  beforeEach(async () => {
    const mod = await vi.importActual<{ default: React.ComponentType }>(
      "./PriceChartError",
    );
    RealPriceChartError = mod.default;
  });

  it('renders "Price History" heading', () => {
    renderWithProviders(<RealPriceChartError />);
    expect(screen.getByText("Price History")).toBeInTheDocument();
  });

  it("renders error message about poe.ninja", () => {
    renderWithProviders(<RealPriceChartError />);
    expect(
      screen.getByText(
        "Failed to load price history. poe.ninja may be unreachable.",
      ),
    ).toBeInTheDocument();
  });

  it("renders an alert icon", () => {
    renderWithProviders(<RealPriceChartError />);
    expect(screen.getByTestId("fi-alert")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ChartTooltip
// ═══════════════════════════════════════════════════════════════════════════

describe("ChartTooltip", () => {
  const validPayload = [
    {
      value: 1.23,
      dataKey: "rate",
      color: "#ff0000",
      payload: {
        time: 1704067200000, // 2024-01-01
        dateLabel: "Jan 1",
        rate: 1.23,
        volume: 45678,
      },
    },
  ];

  it("returns null when active is false", () => {
    const { container } = renderWithProviders(
      <ChartTooltip active={false} payload={validPayload} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when payload is undefined", () => {
    const { container } = renderWithProviders(
      <ChartTooltip active={true} payload={undefined} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when payload array is empty", () => {
    const { container } = renderWithProviders(
      <ChartTooltip active={true} payload={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when payload[0] has no payload object", () => {
    const emptyPayloadEntry = [
      {
        value: 1.23,
        dataKey: "rate",
        color: "#ff0000",
        payload: undefined as any,
      },
    ];
    const { container } = renderWithProviders(
      <ChartTooltip active={true} payload={emptyPayloadEntry} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders date, rate formatted to 2 decimal places with 'div', and volume", () => {
    renderWithProviders(<ChartTooltip active={true} payload={validPayload} />);
    expect(screen.getByText("January 1, 2024")).toBeInTheDocument();
    expect(screen.getByText(/1\.23/)).toBeInTheDocument();
    expect(screen.getByText(/div/)).toBeInTheDocument();
  });

  it("renders volume with toLocaleString formatting", () => {
    renderWithProviders(<ChartTooltip active={true} payload={validPayload} />);
    const formattedVolume = (45678).toLocaleString();
    expect(
      screen.getByText(new RegExp(`Vol:.*${formattedVolume}`)),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CardDetailsPriceChart
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPriceChart", () => {
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
      divineValue: 1.5 + i * 0.1,
      volume: 100 + i * 50,
    }));
  }

  it("renders loading skeleton when isLoadingPriceHistory is true", () => {
    renderComponent({ isLoadingPriceHistory: true });
    expect(screen.getByText("Loading chart data…")).toBeInTheDocument();
    expect(screen.getByText("Price History")).toBeInTheDocument();
  });

  it("renders PriceChartError when priceHistoryError exists", () => {
    renderComponent({ priceHistoryError: "Network error" });
    expect(screen.getByTestId("price-chart-error")).toBeInTheDocument();
  });

  it("renders PriceChartEmpty when priceHistory is null", () => {
    renderComponent({ priceHistory: null });
    expect(screen.getByTestId("price-chart-empty")).toBeInTheDocument();
  });

  it("renders PriceChartEmpty when priceHistory has empty history array", () => {
    renderComponent({
      priceHistory: {
        priceHistory: [],
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.getByTestId("price-chart-empty")).toBeInTheDocument();
  });

  it("renders chart with data when valid priceHistory exists", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-rate")).toBeInTheDocument();
    expect(screen.getByTestId("bar-volume")).toBeInTheDocument();
  });

  it("shows date range in header (firstDate – lastDate) and data point count", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(5),
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 5/)).toBeInTheDocument();
    expect(screen.getByText(/5 data points/)).toBeInTheDocument();
  });

  it('shows "Cached" badge when isFromCache and fetchedAt are set', () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(3),
        isFromCache: true,
        fetchedAt: "2024-01-15T12:00:00Z",
      },
    });
    expect(screen.getByText("Cached")).toBeInTheDocument();
    expect(screen.getByTestId("fi-clock")).toBeInTheDocument();
  });

  it('hides "Cached" badge when isFromCache is false', () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(3),
        isFromCache: false,
        fetchedAt: "2024-01-15T12:00:00Z",
      },
    });
    expect(screen.queryByText("Cached")).not.toBeInTheDocument();
  });

  it('hides "Cached" badge when cache timestamp is missing', () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(3),
        isFromCache: true,
        fetchedAt: null,
      },
    });
    expect(screen.queryByText("Cached")).not.toBeInTheDocument();
  });

  it("handles a flat non-zero rate domain", () => {
    renderComponent({
      priceHistory: {
        priceHistory: [
          {
            timestamp: "2024-01-01T00:00:00Z",
            divineValue: 2,
            volume: 100,
          },
          {
            timestamp: "2024-01-02T00:00:00Z",
            divineValue: 2,
            volume: 200,
          },
        ],
        isFromCache: false,
        fetchedAt: null,
      },
    });

    expect(screen.getByTestId("composed-chart")).toHaveAttribute(
      "data-count",
      "2",
    );
  });

  it("handles all-zero rate and volume domains", () => {
    renderComponent({
      priceHistory: {
        priceHistory: [
          {
            timestamp: "2024-01-01T00:00:00Z",
            divineValue: 0,
            volume: 0,
          },
        ],
        isFromCache: false,
        fetchedAt: null,
      },
    });

    expect(screen.getByTestId("composed-chart")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders Brush only when data points exceed 14", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(15),
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.getByTestId("brush")).toBeInTheDocument();
  });

  it("does not render Brush when data points are 14 or fewer", () => {
    renderComponent({
      priceHistory: {
        priceHistory: makeHistoryPoints(10),
        isFromCache: false,
        fetchedAt: null,
      },
    });
    expect(screen.queryByTestId("brush")).not.toBeInTheDocument();
  });
});
