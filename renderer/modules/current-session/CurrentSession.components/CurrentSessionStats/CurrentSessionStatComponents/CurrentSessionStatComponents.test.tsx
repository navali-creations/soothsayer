import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionMostValuableStat from "../CurrentSessionMostValueableCardStat/CurrentSessionMostValueableCardStat";
import CurrentSessionNetProfitStat from "../CurrentSessionNetProfitStat/CurrentSessionNetProfitStat";
import CurrentSessionOpenedDecksStat from "../CurrentSessionOpenedDecksStat/CurrentSessionOpenedDecksStat";
import CurrentSessionTotalValueStat from "../CurrentSessionTotalValueStat/CurrentSessionTotalValueStat";
import CurrentSessionUniqueCardsStat from "../CurrentSessionUniqueCardsStat/CurrentSessionUniqueCardsStat";

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

/**
 * Setup store for components that destructure useBoundStore() directly
 * (OpenedDecks, UniqueCards, TotalValue, NetProfit).
 */
function setupDestructuredStore(overrides: any = {}) {
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

/**
 * Setup store for MostValuableStat which uses selector-based useBoundStore(selector).
 */
function setupSelectorStore(overrides: any = {}) {
  const state = {
    currentSession: {
      getSession: () => overrides.session ?? null,
    },
    settings: {
      getActiveGameViewPriceSource: () => overrides.priceSource ?? "exchange",
    },
  } as any;

  mockUseBoundStore.mockImplementation((selector?: any) => {
    return selector ? selector(state) : state;
  });

  return state;
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

function createCard(overrides: any = {}) {
  return {
    name: overrides.name ?? "The Doctor",
    count: overrides.count ?? 1,
    stashPrice: {
      chaosValue: overrides.stashChaos ?? 100,
      hidePrice: overrides.stashHide ?? false,
    },
    exchangePrice: {
      chaosValue: overrides.exchangeChaos ?? 120,
      hidePrice: overrides.exchangeHide ?? false,
    },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

// ============================================================================
// CurrentSessionOpenedDecksStat
// ============================================================================

describe("CurrentSessionOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Stacked Decks Opened" title', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("renders 0 when session is null", () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("0");
  });

  it("renders totalCount from session data", () => {
    setupDestructuredStore({
      session: createSession({ totalCount: 42 }),
    });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("42");
  });

  it('renders "This session" description', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("This session")).toBeInTheDocument();
  });
});

// ============================================================================
// CurrentSessionUniqueCardsStat
// ============================================================================

describe("CurrentSessionUniqueCardsStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Unique Cards" title', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByText("Unique Cards")).toBeInTheDocument();
  });

  it("renders 0 when session is null", () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("0");
  });

  it("renders the count of unique cards (cards.length)", () => {
    setupDestructuredStore({
      session: createSession({
        cards: [
          createCard({ name: "The Doctor" }),
          createCard({ name: "Rain of Chaos" }),
          createCard({ name: "House of Mirrors" }),
        ],
      }),
    });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("3");
  });

  it("renders 0 when session has empty cards array", () => {
    setupDestructuredStore({
      session: createSession({ cards: [] }),
    });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("0");
  });

  it('renders "Different cards found" description', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByText("Different cards found")).toBeInTheDocument();
  });
});

// ============================================================================
// CurrentSessionMostValuableStat
// ============================================================================

describe("CurrentSessionMostValuableStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Most Valuable" title', () => {
    setupSelectorStore({ session: null });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("Most Valuable")).toBeInTheDocument();
  });

  it('shows "—" when session is null', () => {
    setupSelectorStore({ session: null });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("—");
  });

  it('shows "No pricing data" when session has no priceSnapshot', () => {
    setupSelectorStore({
      session: createSession({ priceSnapshot: null, cards: [] }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it('shows "—" value when there are no cards even with snapshot', () => {
    setupSelectorStore({
      session: createSession({ cards: [] }),
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("—");
  });

  it("finds the most valuable card by chaosValue (exchange)", () => {
    setupSelectorStore({
      session: createSession({
        cards: [
          createCard({ name: "Rain of Chaos", exchangeChaos: 5 }),
          createCard({ name: "The Doctor", exchangeChaos: 5000 }),
          createCard({ name: "Humility", exchangeChaos: 10 }),
        ],
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByTestId("card-name-link")).toHaveTextContent(
      "The Doctor",
    );
  });

  it("finds the most valuable card by chaosValue (stash)", () => {
    setupSelectorStore({
      session: createSession({
        cards: [
          createCard({ name: "Rain of Chaos", stashChaos: 3 }),
          createCard({ name: "House of Mirrors", stashChaos: 8000 }),
          createCard({ name: "The Doctor", stashChaos: 4500 }),
        ],
      }),
      priceSource: "stash",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByTestId("card-name-link")).toHaveTextContent(
      "House of Mirrors",
    );
  });

  it("filters out cards with hidePrice flag (exchange)", () => {
    setupSelectorStore({
      session: createSession({
        cards: [
          createCard({
            name: "Hidden Expensive Card",
            exchangeChaos: 9999,
            exchangeHide: true,
          }),
          createCard({
            name: "Visible Card",
            exchangeChaos: 50,
            exchangeHide: false,
          }),
        ],
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByTestId("card-name-link")).toHaveTextContent(
      "Visible Card",
    );
  });

  it("filters out cards with hidePrice flag (stash)", () => {
    setupSelectorStore({
      session: createSession({
        cards: [
          createCard({
            name: "Hidden Stash Card",
            stashChaos: 9999,
            stashHide: true,
          }),
          createCard({
            name: "Visible Stash Card",
            stashChaos: 30,
            stashHide: false,
          }),
        ],
      }),
      priceSource: "stash",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByTestId("card-name-link")).toHaveTextContent(
      "Visible Stash Card",
    );
  });

  it('shows "—" when all cards are hidden', () => {
    setupSelectorStore({
      session: createSession({
        cards: [
          createCard({
            name: "Hidden1",
            exchangeChaos: 100,
            exchangeHide: true,
          }),
          createCard({
            name: "Hidden2",
            exchangeChaos: 200,
            exchangeHide: true,
          }),
        ],
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("—");
  });

  it("displays value in divines when chaosValue >= chaosToDivineRatio", () => {
    setupSelectorStore({
      session: createSession({
        cards: [createCard({ name: "Expensive", exchangeChaos: 500 })],
        priceSnapshot: {
          timestamp: "2024-06-15T12:00:00.000Z",
          stash: { chaosToDivineRatio: 200 },
          exchange: { chaosToDivineRatio: 220 },
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    const numbers = screen.getAllByTestId("animated-number");
    // 500 / 220 ≈ 2.27 → displayed with "d" suffix
    const divineValue = numbers.find((el) => el.textContent?.includes("d"));
    expect(divineValue).toBeDefined();
  });

  it("displays value in chaos when chaosValue < chaosToDivineRatio", () => {
    setupSelectorStore({
      session: createSession({
        cards: [createCard({ name: "Cheap", exchangeChaos: 50 })],
        priceSnapshot: {
          timestamp: "2024-06-15T12:00:00.000Z",
          stash: { chaosToDivineRatio: 200 },
          exchange: { chaosToDivineRatio: 220 },
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionMostValuableStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const chaosValue = numbers.find((el) => el.textContent?.includes("c"));
    expect(chaosValue).toBeDefined();
  });
});

// ============================================================================
// CurrentSessionTotalValueStat
// ============================================================================

describe("CurrentSessionTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Total Value" title', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("Total Value")).toBeInTheDocument();
  });

  it('shows "N/A" when session has no priceSnapshot', () => {
    setupDestructuredStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it('shows "No pricing data" description when no priceSnapshot', () => {
    setupDestructuredStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it('shows "N/A" when session is null', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it("shows total value in divines when totalValue >= chaosToDivineRatio (exchange)", () => {
    setupDestructuredStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, totalValue: 500 },
          stash: { chaosToDivineRatio: 200, totalValue: 480 },
          totalDeckCost: 200,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    const numbers = screen.getAllByTestId("animated-number");
    // 500 / 220 ≈ 2.27d in stat-value
    const divineValue = numbers.find((el) => el.textContent?.includes("d"));
    expect(divineValue).toBeDefined();
  });

  it("shows total value in chaos when totalValue < chaosToDivineRatio", () => {
    setupDestructuredStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, totalValue: 100 },
          stash: { chaosToDivineRatio: 200, totalValue: 80 },
          totalDeckCost: 50,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    const numbers = screen.getAllByTestId("animated-number");
    const chaosValue = numbers.find((el) => el.textContent?.includes("c"));
    expect(chaosValue).toBeDefined();
  });

  it("shows approximate chaos in description when value displayed in divines", () => {
    setupDestructuredStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, totalValue: 500 },
          stash: { chaosToDivineRatio: 200, totalValue: 480 },
          totalDeckCost: 200,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    const desc = screen.getByTestId("stat-desc");
    expect(desc).toHaveTextContent(/≈/);
    expect(desc).toHaveTextContent(/chaos/);
  });

  it("shows approximate divine in description when value displayed in chaos", () => {
    setupDestructuredStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, totalValue: 100 },
          stash: { chaosToDivineRatio: 200, totalValue: 80 },
          totalDeckCost: 50,
        },
      }),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    const desc = screen.getByTestId("stat-desc");
    expect(desc).toHaveTextContent(/≈/);
    expect(desc).toHaveTextContent(/divine/);
  });

  it("renders exchange icon when price source is exchange", () => {
    setupDestructuredStore({
      session: createSession(),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("icon-card-exchange")).toBeInTheDocument();
  });

  it("renders stash icon when price source is stash", () => {
    setupDestructuredStore({
      session: createSession(),
      priceSource: "stash",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("icon-locked-chest")).toBeInTheDocument();
  });

  it("uses stash totals when priceSource is stash", () => {
    setupDestructuredStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 220, totalValue: 9999 },
          stash: { chaosToDivineRatio: 200, totalValue: 50 },
          totalDeckCost: 200,
        },
      }),
      priceSource: "stash",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    // totalValue (50) < chaosToDivineRatio (200) → should display in chaos
    const numbers = screen.getAllByTestId("animated-number");
    const chaosInValue = numbers.find(
      (el) =>
        el.textContent?.includes("c") &&
        el.closest('[data-testid="stat-value"]'),
    );
    expect(chaosInValue).toBeDefined();
  });
});

// ============================================================================
// CurrentSessionNetProfitStat
// ============================================================================

describe("CurrentSessionNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Net Profit" title', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
  });

  it('shows "N/A" when session has no priceSnapshot', () => {
    setupDestructuredStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it('shows "No pricing data" description when no priceSnapshot', () => {
    setupDestructuredStore({
      session: createSession({ priceSnapshot: null }),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it('shows "N/A" when session is null', () => {
    setupDestructuredStore({ session: null });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it("shows net profit in divines when |netProfit| >= chaosToDivineRatio", () => {
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
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
    setupDestructuredStore({
      session: createSession(),
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("icon-receive-money")).toBeInTheDocument();
  });

  it("renders mini sparkline when session is active", () => {
    setupDestructuredStore({
      session: createSession(),
      isActive: true,
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("does not render mini sparkline when session is inactive", () => {
    setupDestructuredStore({
      session: createSession(),
      isActive: false,
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(
      screen.queryByTestId("mini-profit-sparkline"),
    ).not.toBeInTheDocument();
  });

  it("renders both icon and sparkline when active", () => {
    setupDestructuredStore({
      session: createSession(),
      isActive: true,
    });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    expect(screen.getByTestId("icon-receive-money")).toBeInTheDocument();
    expect(screen.getByTestId("mini-profit-sparkline")).toBeInTheDocument();
  });

  it("uses stash totals when priceSource is stash", () => {
    setupDestructuredStore({
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
    setupDestructuredStore({ session: createSession() });
    renderWithProviders(<CurrentSessionNetProfitStat />);

    const profitLabel = screen.getByText("Net Profit");
    expect(profitLabel).toHaveAttribute(
      "title",
      expect.stringContaining("Total Value minus the cost"),
    );
  });
});
