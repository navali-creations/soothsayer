import {
  cleanup,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionMostValuableStat from "../CurrentSessionMostValueableCardStat/CurrentSessionMostValueableCardStat";
import CurrentSessionNetProfitStat from "../CurrentSessionNetProfitStat/CurrentSessionNetProfitStat";
import CurrentSessionOpenedDecksStat from "../CurrentSessionOpenedDecksStat/CurrentSessionOpenedDecksStat";
import CurrentSessionTotalValueStat from "../CurrentSessionTotalValueStat/CurrentSessionTotalValueStat";
import CurrentSessionUniqueCardsStat from "../CurrentSessionUniqueCardsStat/CurrentSessionUniqueCardsStat";

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

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName }: any) => (
    <span data-testid="card-name-link">{cardName}</span>
  ),
}));

vi.mock("react-icons/gi", () => ({
  GiCardExchange: (_props: any) => <span data-testid="icon-card-exchange" />,
  GiLockedChest: (_props: any) => <span data-testid="icon-locked-chest" />,
  GiReceiveMoney: (_props: any) => <span data-testid="icon-receive-money" />,
}));

vi.mock("react-icons/fi", () => ({
  FiInfo: () => <span />,
  FiMaximize2: () => <span />,
  FiMinimize2: () => <span />,
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

function createCard(overrides: any = {}) {
  return {
    name: overrides.name ?? "The Doctor",
    count: overrides.count ?? 1,
    price: {
      chaosValue: overrides.chaosValue ?? 100,
      totalValue: overrides.totalValue ?? overrides.chaosValue ?? 100,
      hidePrice: overrides.hidePrice ?? false,
      ...overrides.price,
    },
    ...overrides,
  };
}

function createSession(overrides: any = {}) {
  return {
    totalCount: overrides.totalCount ?? 10,
    cards: overrides.cards ?? [
      createCard({
        name: "The Doctor",
        count: 1,
        price: { chaosValue: 500, totalValue: 500, hidePrice: false },
      }),
      createCard({
        name: "Rain of Chaos",
        count: 3,
        price: { chaosValue: 2, totalValue: 6, hidePrice: false },
      }),
    ],
    priceSnapshot: overrides.priceSnapshot ?? {
      timestamp: "2024-06-15T12:00:00.000Z",
      chaosToDivineRatio: 200,
      cardPrices: {},
      stackedDeckChaosCost: 3,
    },
    totals: overrides.totals ?? {
      chaosToDivineRatio: 200,
      totalValue: 506,
      netProfit: 306,
      totalDeckCost: 200,
      stackedDeckChaosCost: 3,
    },
    ...overrides,
  };
}

function setupStore(overrides: any = {}) {
  const state = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
      getIsCurrentSessionActive: vi.fn(() => overrides.isActive ?? false),
      ...overrides.currentSession,
    },
    settings: {
      ...overrides.settings,
    },
  } as any;
  mockUseBoundStore.mockImplementation((selector?: any) =>
    selector ? selector(state) : state,
  );
  return state;
}

describe("CurrentSessionOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders "Stacked Decks Opened" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("renders 0 when session is null", () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("0");
  });

  it("renders totalCount from session data", () => {
    setupStore({
      session: createSession({ totalCount: 42 }),
    });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("42");
  });

  it('renders "This session" description', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("This session")).toBeInTheDocument();
  });
});

describe("CurrentSessionUniqueCardsStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders "Unique Cards" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByText("Unique Cards")).toBeInTheDocument();
  });

  it("renders 0 when session is null", () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("0");
  });

  it("renders the count of unique cards", () => {
    setupStore({
      session: createSession({
        cards: [
          createCard({ name: "The Doctor" }),
          createCard({ name: "Rain of Chaos" }),
          createCard({ name: "House of Mirrors" }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("3");
  });

  it("renders 0 when session has empty cards array", () => {
    setupStore({
      session: createSession({ cards: [] }),
    });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("0");
  });

  it('renders "Different cards found" description', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByText("Different cards found")).toBeInTheDocument();
  });
});

describe("CurrentSessionMostValuableStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders "Most Valuable" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("Most Valuable")).toBeInTheDocument();
  });

  it('shows "—" when session is null', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("—");
  });

  it('shows "No pricing data" when session has no priceSnapshot', () => {
    setupStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it('shows "—" value when there are no cards even with snapshot', () => {
    setupStore({
      session: createSession({ cards: [] }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("finds the most valuable visible card by chaosValue", () => {
    setupStore({
      session: createSession({
        cards: [
          createCard({
            name: "Rain of Chaos",
            price: { chaosValue: 2, hidePrice: false },
          }),
          createCard({
            name: "The Doctor",
            price: { chaosValue: 500, hidePrice: false },
          }),
          createCard({
            name: "The Fiend",
            price: { chaosValue: 300, hidePrice: false },
          }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("2.50d")).toBeInTheDocument();
    expect(screen.getByTestId("card-name-link")).toHaveTextContent(
      "The Doctor",
    );
  });

  it("filters out cards with hidePrice flag", () => {
    setupStore({
      session: createSession({
        cards: [
          createCard({
            name: "Hidden Doctor",
            price: { chaosValue: 5000, hidePrice: true },
          }),
          createCard({
            name: "Visible Rain",
            price: { chaosValue: 25, hidePrice: false },
          }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("25.00c")).toBeInTheDocument();
    expect(screen.getByTestId("card-name-link")).toHaveTextContent(
      "Visible Rain",
    );
  });

  it('shows "—" when all cards are hidden', () => {
    setupStore({
      session: createSession({
        cards: [
          createCard({
            name: "Hidden Doctor",
            price: { chaosValue: 5000, hidePrice: true },
          }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("displays value in divines when chaosValue >= chaosToDivineRatio", () => {
    setupStore({
      session: createSession({
        priceSnapshot: { chaosToDivineRatio: 200 },
        cards: [
          createCard({
            name: "The Doctor",
            price: { chaosValue: 500, hidePrice: false },
          }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("2.50d")).toBeInTheDocument();
  });

  it("displays value in chaos when chaosValue < chaosToDivineRatio", () => {
    setupStore({
      session: createSession({
        priceSnapshot: { chaosToDivineRatio: 200 },
        cards: [
          createCard({
            name: "Small Card",
            price: { chaosValue: 50, hidePrice: false },
          }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("50.00c")).toBeInTheDocument();
  });
});

describe("CurrentSessionTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders "Total Value" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("Total Value")).toBeInTheDocument();
  });

  it('shows "N/A" when session has no priceSnapshot', () => {
    setupStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "No pricing data" description when no priceSnapshot', () => {
    setupStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it('shows "N/A" when session is null', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it("shows total value in divines when totalValue >= chaosToDivineRatio", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 500,
          netProfit: 300,
          totalDeckCost: 200,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("2.50d");
  });

  it("shows total value in chaos when totalValue < chaosToDivineRatio", () => {
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
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("100.00c");
  });

  it("shows approximate chaos in description when value displayed in divines", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 500,
          netProfit: 300,
          totalDeckCost: 200,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/≈/);
    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/500 chaos/);
  });

  it("shows approximate divine in description when value displayed in chaos", () => {
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
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/≈/);
    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/0.50 divine/);
  });

  it("shows divine-rate unavailable when chaosToDivineRatio is zero", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 0,
          totalValue: 100,
          netProfit: 100,
          totalDeckCost: 50,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("100.00c")).toBeInTheDocument();
    expect(screen.getByText("Divine rate unavailable")).toBeInTheDocument();
  });

  it("renders exchange icon for the single price source", () => {
    setupStore({ session: createSession() });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("icon-card-exchange")).toBeInTheDocument();
  });
});

describe("CurrentSessionNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
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

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
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

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it("shows net profit in divines when |netProfit| >= chaosToDivineRatio", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 500,
          netProfit: 500,
          totalDeckCost: 200,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("2.50d");
  });

  it("shows net profit in chaos when |netProfit| < chaosToDivineRatio", () => {
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

    expect(screen.getByTestId("stat-value")).toHaveTextContent("50.00c");
  });

  it("applies text-error class when netProfit is negative in divine display", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 0,
          netProfit: -500,
          totalDeckCost: 500,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("-2.50d")).toHaveClass("text-error");
  });

  it("applies text-error class when netProfit is negative in chaos display", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 0,
          netProfit: -50,
          totalDeckCost: 50,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("-50.00c")).toHaveClass("text-error");
  });

  it("does not apply text-error class when netProfit is positive", () => {
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

    expect(screen.getByText("50.00c")).not.toHaveClass("text-error");
  });

  it('shows "No deck cost data" when totalDeckCost is 0', () => {
    setupStore({
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
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("No deck cost data")).toBeInTheDocument();
  });

  it("shows divine-rate unavailable when chaosToDivineRatio is zero", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 0,
          totalValue: 100,
          netProfit: 100,
          totalDeckCost: 50,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Divine rate unavailable")).toBeInTheDocument();
  });

  it("shows deck cost in description when totalDeckCost > 0 and showing divine", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 500,
          netProfit: 500,
          totalDeckCost: 200,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/500 chaos/);
    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/200c/);
    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/decks/);
  });

  it("shows deck cost in description when totalDeckCost > 0 and showing chaos", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 100,
          netProfit: 50,
          totalDeckCost: 12,
          stackedDeckChaosCost: 3,
        },
      }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/0.25 divine/);
    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/12c/);
    expect(screen.getByTestId("stat-desc")).toHaveTextContent(/decks/);
  });

  it("renders GiReceiveMoney icon", () => {
    setupStore({ session: createSession() });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("icon-receive-money")).toBeInTheDocument();
  });

  it("renders mini sparkline when session is active", () => {
    setupStore({ session: createSession(), isActive: true });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("does not render mini sparkline when session is inactive", () => {
    setupStore({ session: createSession(), isActive: false });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(
      screen.queryByTestId("mini-profit-sparkline"),
    ).not.toBeInTheDocument();
  });

  it("renders both icon and sparkline when active", () => {
    setupStore({ session: createSession(), isActive: true });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("icon-receive-money")).toBeInTheDocument();
    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("renders tooltip title on Net Profit text", () => {
    setupStore({ session: createSession() });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Net Profit")).toHaveAttribute(
      "title",
      "Total Value minus the cost of Stacked Decks opened. Represents actual profit if you purchased the decks.",
    );
  });
});
