import React from "react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFBreakevenChart from "./PFBreakevenChart";

// ─── Mocks ─────────────────────────────────────────────────────────────────

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

// We store captured props from mocked recharts components so tests can
// exercise internal callbacks (tooltip content, tick formatters, etc.)
// without needing the components to be exported.
let capturedTooltipContent: any = null;
let capturedYAxisTickFormatter: ((v: number) => string) | null = null;

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
  YAxis: ({ tickFormatter }: any) => {
    // Capture the tickFormatter so tests can call it directly
    capturedYAxisTickFormatter = tickFormatter ?? null;
    return <div data-testid="y-axis" />;
  },
  ReferenceLine: () => <div data-testid="reference-line" />,
  Tooltip: ({ content }: any) => {
    // Capture the content element so tests can render it with custom props
    capturedTooltipContent = content ?? null;
    if (!content) return <div data-testid="tooltip" />;
    // Render the content element as-is (without active/payload it returns null)
    // Tests will clone it with the needed props separately.
    return <div data-testid="tooltip">{content}</div>;
  },
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    chaosToDivineRatio: 200,
    isLoading: false,
    hasData: vi.fn(() => true),
    getPnLCurve: vi.fn(() => [
      { deckCount: 1000, estimated: 200, optimistic: 1000 },
      { deckCount: 5000, estimated: 1500, optimistic: 4000 },
      { deckCount: 10000, estimated: 5000, optimistic: 12000 },
    ]),
    ...overrides.profitForecast,
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue({ profitForecast: store } as any);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFBreakevenChart", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    capturedTooltipContent = null;
    capturedYAxisTickFormatter = null;
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

// ─── PFBreakevenTooltip (internal) ─────────────────────────────────────────

describe("PFBreakevenTooltip (via Tooltip mock)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    capturedTooltipContent = null;
    capturedYAxisTickFormatter = null;
  });

  it("captures the tooltip content element after render", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedTooltipContent).not.toBeNull();
  });

  it("returns null when active is false", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    // Clone the captured tooltip content with active=false
    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: false,
          payload: [
            {
              payload: { deckCount: 1000, estimated: 200, optimistic: 500 },
            },
          ],
        })}
      </div>,
    );

    // The tooltip should render nothing (null) — the wrapper div should be empty
    expect(container.querySelector(".bg-base-300")).toBeNull();
  });

  it("returns null when payload is empty", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [],
        })}
      </div>,
    );

    expect(container.querySelector(".bg-base-300")).toBeNull();
  });

  it("returns null when payload is undefined", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: undefined,
        })}
      </div>,
    );

    expect(container.querySelector(".bg-base-300")).toBeNull();
  });

  it("returns null when payload[0].payload is undefined", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [{ payload: undefined }],
        })}
      </div>,
    );

    expect(container.querySelector(".bg-base-300")).toBeNull();
  });

  it("renders tooltip content when active with valid payload", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [
            {
              payload: { deckCount: 1000, estimated: 200, optimistic: 500 },
            },
          ],
        })}
      </div>,
    );

    const tooltipDiv = container.querySelector(".bg-base-300");
    expect(tooltipDiv).not.toBeNull();
    expect(tooltipDiv!.textContent).toContain("1,000 decks");
    expect(tooltipDiv!.textContent).toContain("Optimistic:");
    expect(tooltipDiv!.textContent).toContain("Estimated:");
  });

  it("formats deck count with locale separators", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [
            {
              payload: {
                deckCount: 50000,
                estimated: 10000,
                optimistic: 25000,
              },
            },
          ],
        })}
      </div>,
    );

    const tooltipDiv = container.querySelector(".bg-base-300");
    expect(tooltipDiv).not.toBeNull();
    expect(tooltipDiv!.textContent).toContain("50,000 decks");
  });

  it("displays divine-formatted values using chaosToDivineRatio", () => {
    // ratio = 200 → 200 chaos / 200 = 1.00 d for estimated, 500 / 200 = 2.50 d for optimistic
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [
            {
              payload: { deckCount: 100, estimated: 200, optimistic: 500 },
            },
          ],
        })}
      </div>,
    );

    const tooltipDiv = container.querySelector(".bg-base-300");
    expect(tooltipDiv).not.toBeNull();
    // formatDivine(500, 200) → 500/200 = 2.5 → "2.50 d"
    expect(tooltipDiv!.textContent).toContain("2.50 d");
    // formatDivine(200, 200) → 200/200 = 1.0 → "1.00 d"
    expect(tooltipDiv!.textContent).toContain("1.00 d");
  });

  it("handles large divine values with k suffix in tooltip", () => {
    // ratio = 200, optimistic = 300000 → 300000/200 = 1500 → "1.5k d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [
            {
              payload: {
                deckCount: 5000,
                estimated: 300000,
                optimistic: 300000,
              },
            },
          ],
        })}
      </div>,
    );

    const tooltipDiv = container.querySelector(".bg-base-300");
    expect(tooltipDiv).not.toBeNull();
    expect(tooltipDiv!.textContent).toContain("1.5k d");
  });

  it("shows '— d' when chaosToDivineRatio is 0", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 0 } });
    renderWithProviders(<PFBreakevenChart />);

    const { container } = renderWithProviders(
      <div>
        {React.cloneElement(capturedTooltipContent, {
          active: true,
          payload: [
            {
              payload: { deckCount: 100, estimated: 200, optimistic: 500 },
            },
          ],
        })}
      </div>,
    );

    const tooltipDiv = container.querySelector(".bg-base-300");
    expect(tooltipDiv).not.toBeNull();
    // formatDivine with ratio 0 returns "— d"
    expect(tooltipDiv!.textContent).toContain("— d");
  });
});

// ─── YAxis tickFormatter ───────────────────────────────────────────────────

describe("YAxis tickFormatter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    capturedTooltipContent = null;
    capturedYAxisTickFormatter = null;
  });

  it("captures the tickFormatter after render", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter).toBeInstanceOf(Function);
  });

  it("formats small values as fractional divine with 1 decimal", () => {
    // ratio = 200, v = 100 → d = 0.5 → "0.5 d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(100)).toBe("0.5 d");
  });

  it("formats values >= 100 divine as integer divine", () => {
    // ratio = 200, v = 20000 → d = 100 → "100 d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(20000)).toBe("100 d");
  });

  it("formats values >= 1000 divine with k suffix", () => {
    // ratio = 200, v = 200000 → d = 1000 → "1k d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(200000)).toBe("1k d");
  });

  it("formats large values with k suffix", () => {
    // ratio = 200, v = 1000000 → d = 5000 → "5k d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(1000000)).toBe("5k d");
  });

  it("returns chaos format when ratio is 0", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 0 } });
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(500)).toBe("500c");
  });

  it("returns chaos format when ratio is negative", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: -10 } });
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(1234)).toBe("1234c");
  });

  it("handles negative values correctly for divine formatting", () => {
    // ratio = 200, v = -200000 → d = -1000 → abs >= 1000 → "-1k d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(-200000)).toBe("-1k d");
  });

  it("handles negative values in the medium range", () => {
    // ratio = 200, v = -30000 → d = -150 → abs >= 100 → "-150 d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(-30000)).toBe("-150 d");
  });

  it("handles negative values in the small range", () => {
    // ratio = 200, v = -100 → d = -0.5 → "-0.5 d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(-100)).toBe("-0.5 d");
  });

  it("handles zero value", () => {
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(0)).toBe("0.0 d");
  });

  it("handles exact boundary at 100 divine", () => {
    // ratio = 200, v = 19999 → d = 99.995 → abs < 100 → "100.0 d" (toFixed(1))
    // Actually 19999/200 = 99.995, toFixed(1) = "100.0" — this is the small branch
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    // 99.995 rounds to 100.0 with toFixed(1), but abs(99.995) < 100 so it uses toFixed(1)
    expect(capturedYAxisTickFormatter!(19999)).toBe("100.0 d");
  });

  it("formats value just at 1000 divine boundary", () => {
    // ratio = 200, v = 200000 → d = 1000 → abs >= 1000 → "1k d"
    setupStore();
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(200000)).toBe("1k d");
  });

  it("works with different chaosToDivineRatio", () => {
    // ratio = 100, v = 5000 → d = 50 → "50.0 d"
    setupStore({ profitForecast: { chaosToDivineRatio: 100 } });
    renderWithProviders(<PFBreakevenChart />);
    expect(capturedYAxisTickFormatter!(5000)).toBe("50.0 d");
  });
});
