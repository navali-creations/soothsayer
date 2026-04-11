import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionNetProfitStat from "./CurrentSessionNetProfitStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

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

vi.mock("react-icons/fi", () => ({
  FiInfo: () => <span />,
  FiMaximize2: () => <span />,
  FiMinimize2: () => <span />,
}));

vi.mock("react-icons/gi", () => ({
  GiReceiveMoney: (_props: any) => <span data-testid="icon-receive-money" />,
}));

vi.mock(
  "../../SessionProfitTimeline/MiniProfitSparkline/MiniProfitSparkline",
  () => ({
    default: (_props: any) => <div data-testid="mini-profit-sparkline" />,
  }),
);

vi.mock("../../SessionProfitTimeline/timeline-buffer/timeline-buffer", () => ({
  timelineBuffer: {
    totalDrops: 0,
    chartData: [],
    linePoints: [],
    subscribe: (_cb: any) => () => {},
  },
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: any = {}) {
  const store = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
      getIsCurrentSessionActive: vi.fn(() => overrides.isActive ?? false),
      ...overrides.currentSession,
    },
    settings: {
      getActiveGameViewPriceSource: vi.fn(
        () => overrides.priceSource ?? "exchange",
      ),
      ...overrides.settings,
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function createSession(overrides: any = {}) {
  return {
    totalCount: overrides.totalCount ?? 10,
    cards: overrides.cards ?? [],
    priceSnapshot: overrides.priceSnapshot ?? {
      timestamp: "2024-06-15T12:00:00.000Z",
      stash: { chaosToDivineRatio: 200 },
      exchange: { chaosToDivineRatio: 220 },
    },
    totals: overrides.totals ?? {
      exchange: {
        chaosToDivineRatio: 220,
        totalValue: 500,
        netProfit: 300,
      },
      stash: {
        chaosToDivineRatio: 200,
        totalValue: 480,
        netProfit: 280,
      },
      totalDeckCost: 200,
    },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CurrentSessionNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Net Profit" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
  });

  it('shows "N/A" when session has no priceSnapshot', () => {
    setupStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it('shows "No pricing data" description when no priceSnapshot', () => {
    setupStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it('shows "N/A" when session is null', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it("shows net profit in divines when |netProfit| >= chaosToDivineRatio", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 500 },
          stash: { chaosToDivineRatio: 200, netProfit: 480 },
          totalDeckCost: 200,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const divineValue = numbers.find(
      (el) =>
        el.textContent?.includes("d") &&
        el.closest('[data-testid="stat-value"]'),
    );
    expect(divineValue).toBeDefined();
  });

  it("shows net profit in chaos when |netProfit| < chaosToDivineRatio", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 50 },
          stash: { chaosToDivineRatio: 200, netProfit: 40 },
          totalDeckCost: 100,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const chaosValue = numbers.find(
      (el) =>
        el.textContent?.includes("c") &&
        el.closest('[data-testid="stat-value"]'),
    );
    expect(chaosValue).toBeDefined();
  });

  it("applies text-error class when netProfit is negative (divine display)", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: -500 },
          stash: { chaosToDivineRatio: 200, netProfit: -400 },
          totalDeckCost: 700,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const errorValue = numbers.find((el) =>
      el.className?.includes("text-error"),
    );
    expect(errorValue).toBeDefined();
  });

  it("applies text-error class when netProfit is negative (chaos display)", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: -50 },
          stash: { chaosToDivineRatio: 200, netProfit: -30 },
          totalDeckCost: 100,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const errorValue = numbers.find((el) =>
      el.className?.includes("text-error"),
    );
    expect(errorValue).toBeDefined();
  });

  it("does not apply text-error class when netProfit is positive", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 50 },
          stash: { chaosToDivineRatio: 200, netProfit: 40 },
          totalDeckCost: 100,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const valueNumbers = numbers.filter((el) =>
      el.closest('[data-testid="stat-value"]'),
    );
    for (const n of valueNumbers) {
      expect(n.className).not.toContain("text-error");
    }
  });

  it('shows "No deck cost data" when totalDeckCost is 0', () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 50 },
          stash: { chaosToDivineRatio: 200, netProfit: 40 },
          totalDeckCost: 0,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("No deck cost data")).toBeInTheDocument();
  });

  it("shows deck cost in description when totalDeckCost > 0 and showing divine", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 500 },
          stash: { chaosToDivineRatio: 200, netProfit: 400 },
          totalDeckCost: 200,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const desc = screen.getByTestId("stat-desc");
    expect(desc).toHaveTextContent(/≈/);
    expect(desc).toHaveTextContent(/chaos/);
    expect(desc).toHaveTextContent(/decks/);
  });

  it("shows deck cost in description when totalDeckCost > 0 and showing chaos", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 50 },
          stash: { chaosToDivineRatio: 200, netProfit: 40 },
          totalDeckCost: 100,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const desc = screen.getByTestId("stat-desc");
    expect(desc).toHaveTextContent(/≈/);
    expect(desc).toHaveTextContent(/divine/);
    expect(desc).toHaveTextContent(/decks/);
  });

  it("renders GiReceiveMoney icon", () => {
    setupStore({
      session: createSession(),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("icon-receive-money")).toBeInTheDocument();
  });

  it("renders mini sparkline when session is active", () => {
    setupStore({
      session: createSession(),
      isActive: true,
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("does not render mini sparkline when session is inactive", () => {
    setupStore({
      session: createSession(),
      isActive: false,
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(
      screen.queryByTestId("mini-profit-sparkline"),
    ).not.toBeInTheDocument();
  });

  it("renders both icon and sparkline when active", () => {
    setupStore({
      session: createSession(),
      isActive: true,
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("icon-receive-money")).toBeInTheDocument();
    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("uses stash totals when priceSource is stash", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, netProfit: 9999 },
          stash: { chaosToDivineRatio: 200, netProfit: 50 },
          totalDeckCost: 100,
        },
      }),
      priceSource: "stash",
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    // netProfit (50) < chaosToDivineRatio (200) → displayed in chaos
    const numbers = screen.getAllByTestId("animated-number");
    const chaosInValue = numbers.find(
      (el) =>
        el.textContent?.includes("c") &&
        el.closest('[data-testid="stat-value"]'),
    );
    expect(chaosInValue).toBeDefined();
  });

  it("renders tooltip title on Net Profit text", () => {
    setupStore({ session: createSession() });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const profitLabel = screen.getByText("Net Profit");
    expect(profitLabel).toHaveAttribute(
      "title",
      expect.stringContaining("Total Value minus the cost"),
    );
  });
});
