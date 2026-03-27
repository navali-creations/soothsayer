import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFBreakevenChart from "./PFBreakevenChart";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

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

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data, ...props }: any) => (
    <div data-testid="area-chart" data-points={data?.length ?? 0} {...props}>
      {children}
    </div>
  ),
  Area: (props: any) => <div data-testid={`area-${props.dataKey}`} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    profitForecast: {
      chaosToDivineRatio: 200,
      isLoading: false,
      hasData: vi.fn(() => true),
      getPnLCurve: vi.fn(() => [
        { deckCount: 1000, estimated: 200, optimistic: 1000 },
        { deckCount: 5000, estimated: 1500, optimistic: 4000 },
        { deckCount: 10000, estimated: 5000, optimistic: 12000 },
      ]),
      ...overrides.profitForecast,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFBreakevenChart", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chart container when data is available", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(screen.getByTestId("pf-breakeven-chart")).toBeInTheDocument();
  });

  it("renders responsive container and area chart", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("passes correct number of data points to chart", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    const chart = screen.getByTestId("area-chart");
    expect(chart).toHaveAttribute("data-points", "3");
  });

  it("renders estimated and optimistic area layers", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(screen.getByTestId("area-optimistic")).toBeInTheDocument();
    expect(screen.getByTestId("area-estimated")).toBeInTheDocument();
  });

  it("renders reference line for break-even", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(screen.getByTestId("reference-line")).toBeInTheDocument();
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
      profitForecast: { getPnLCurve: vi.fn(() => []) },
    });
    renderWithProviders(<PFBreakevenChart />);
    expect(screen.getByTestId("pf-breakeven-empty")).toBeInTheDocument();
  });
});
