import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionNetProfitStat from "./CurrentSessionNetProfitStat";

const timelineBufferMock = vi.hoisted(() => ({
  totalDrops: 0,
  chartData: [] as any[],
  linePoints: [] as any[],
  subscribe: vi.fn((_cb: any) => () => {}),
}));

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  AnimatedNumber: ({ value, decimals, suffix, className }: any) => (
    <span data-testid="animated-number" className={className}>
      {decimals != null ? Number(value).toFixed(decimals) : value}
      {suffix ?? ""}
    </span>
  ),
  Stat: Object.assign(
    ({ children, className }: any) => (
      <div data-testid="stat" className={className}>
        {children}
      </div>
    ),
    {
      Title: ({ children }: any) => (
        <div data-testid="stat-title">{children}</div>
      ),
      Value: ({ children }: any) => (
        <div data-testid="stat-value">{children}</div>
      ),
      Desc: ({ children, className }: any) => (
        <div data-testid="stat-desc" className={className}>
          {children}
        </div>
      ),
      Figure: ({ children, className }: any) => (
        <div data-testid="stat-figure" className={className}>
          {children}
        </div>
      ),
    },
  ),
}));

vi.mock("react-icons/gi", () => ({
  GiReceiveMoney: (_props: any) => <span data-testid="icon-receive-money" />,
}));

vi.mock("react-icons/fi", () => ({
  FiInfo: () => <span />,
  FiMaximize2: () => <span data-testid="expand-icon" />,
  FiMinimize2: () => <span data-testid="collapse-icon" />,
}));

vi.mock(
  "../../SessionProfitTimeline/MiniProfitSparkline/MiniProfitSparkline",
  () => ({
    default: (_props: any) => <div data-testid="mini-profit-sparkline" />,
  }),
);

vi.mock("../../SessionProfitTimeline/timeline-buffer/timeline-buffer", () => ({
  timelineBuffer: timelineBufferMock,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStore(overrides: any = {}) {
  const store = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
      getIsCurrentSessionActive: vi.fn(() => overrides.isActive ?? false),
      ...overrides.currentSession,
    },
    settings: {
      ...overrides.settings,
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function createSession(overrides: any = {}) {
  return {
    priceSnapshot: {
      timestamp: "2024-06-15T12:00:00.000Z",
      chaosToDivineRatio: 200,
      cardPrices: {},
    },
    totals: {
      chaosToDivineRatio: 200,
      totalValue: 500,
      netProfit: 300,
      totalDeckCost: 200,
      stackedDeckChaosCost: 3,
    },
    ...overrides,
  };
}

describe("CurrentSessionNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    timelineBufferMock.totalDrops = 0;
    timelineBufferMock.chartData = [];
    timelineBufferMock.linePoints = [];
  });

  it("shows net profit in divines when value exceeds the divine ratio", () => {
    setupStore({ session: createSession() });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
    expect(screen.getByText("1.50d")).toBeInTheDocument();
    expect(screen.getByText(/decks/)).toBeInTheDocument();
  });

  it("shows unavailable pricing when there is no current session", () => {
    setupStore({ session: null });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it("shows net profit in chaos when the value is below the divine ratio", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 100,
          netProfit: 50,
          totalDeckCost: 50,
          stackedDeckChaosCost: 3,
        },
      }),
    });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("50.00c")).toBeInTheDocument();
    expect(screen.getByText("0.25 divine")).toBeInTheDocument();
  });

  it("marks negative net profit as an error value", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 100,
          netProfit: -50,
          totalDeckCost: 150,
          stackedDeckChaosCost: 3,
        },
      }),
    });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("-50.00c")).toHaveClass("text-error");
  });

  it("marks negative divine net profit as an error value", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 0,
          netProfit: -300,
          totalDeckCost: 300,
          stackedDeckChaosCost: 3,
        },
      }),
    });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("-1.50d")).toHaveClass("text-error");
  });

  it("does not mark positive net profit as an error value", () => {
    setupStore({ session: createSession() });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("1.50d")).not.toHaveClass("text-error");
  });

  it("shows missing deck-cost and divine-rate descriptions", () => {
    const store = setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 100,
          netProfit: 100,
          totalDeckCost: 0,
          stackedDeckChaosCost: 0,
        },
      }),
    });

    const { rerender } = renderWithProviders(<CurrentSessionNetProfitStat />);
    expect(screen.getByText("No deck cost data")).toBeInTheDocument();

    store.currentSession.getSession.mockReturnValue(
      createSession({
        totals: {
          chaosToDivineRatio: 0,
          totalValue: 100,
          netProfit: 100,
          totalDeckCost: 50,
          stackedDeckChaosCost: 3,
        },
      }),
    );

    rerender(<CurrentSessionNetProfitStat />);
    expect(screen.getByText("Divine rate unavailable")).toBeInTheDocument();
  });

  it("shows unavailable pricing without a snapshot", () => {
    setupStore({ session: createSession({ priceSnapshot: null }) });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it("renders timeline controls when timeline expansion is available", () => {
    const onToggleExpanded = vi.fn();
    setupStore({ session: createSession(), isActive: true });

    renderWithProviders(
      <CurrentSessionNetProfitStat
        hasTimeline
        onToggleExpanded={onToggleExpanded}
      />,
    );

    expect(screen.getByTestId("expand-icon")).toBeInTheDocument();
    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("calls the timeline toggle when the expand button is clicked", async () => {
    const onToggleExpanded = vi.fn();
    setupStore({ session: createSession(), isActive: true });

    const { user } = renderWithProviders(
      <CurrentSessionNetProfitStat
        hasTimeline
        onToggleExpanded={onToggleExpanded}
      />,
    );

    await user.click(screen.getAllByRole("button")[1]);

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("renders the collapse icon when expanded", () => {
    setupStore({ session: createSession(), isActive: true });

    renderWithProviders(
      <CurrentSessionNetProfitStat
        expanded
        hasTimeline
        onToggleExpanded={vi.fn()}
      />,
    );

    expect(screen.getByTestId("collapse-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("expand-icon")).not.toBeInTheDocument();
  });

  it("does not render timeline controls when the timeline cannot expand", () => {
    setupStore({ session: createSession(), isActive: true });

    renderWithProviders(<CurrentSessionNetProfitStat hasTimeline={false} />);

    expect(screen.queryByTestId("expand-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("does not render the sparkline when the session is inactive", () => {
    setupStore({ session: createSession(), isActive: false });

    renderWithProviders(
      <CurrentSessionNetProfitStat hasTimeline onToggleExpanded={vi.fn()} />,
    );

    expect(
      screen.queryByTestId("mini-profit-sparkline"),
    ).not.toBeInTheDocument();
  });

  it("renders the explanatory tooltip title on the stat label", () => {
    setupStore({ session: createSession() });

    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Net Profit")).toHaveAttribute(
      "title",
      "Total Value minus the cost of Stacked Decks opened. Represents actual profit if you purchased the decks.",
    );
  });
});
