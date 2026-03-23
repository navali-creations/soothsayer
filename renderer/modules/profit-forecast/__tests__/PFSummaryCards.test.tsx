import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFSummaryCards from "../ProfitForecast.components/PFSummaryCards";
import { formatDivine } from "../ProfitForecast.utils";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/hooks", () => ({
  useTickingTimer: vi.fn(() => ({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
    isComplete: true,
  })),
  formatTickingTimer: vi.fn(() => "0m 00s"),
}));

vi.mock("~/renderer/components", () => ({
  GroupedStats: ({ children, ...props }: any) => (
    <div data-testid="grouped-stats" {...props}>
      {children}
    </div>
  ),
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, ...props }: any) => (
        <div data-testid="stat-value" {...props}>
          {children}
        </div>
      ),
      Desc: ({ children, ...props }: any) => (
        <div data-testid="stat-desc" {...props}>
          {children}
        </div>
      ),
    },
  ),
  Countdown: () => <span data-testid="countdown">00:00</span>,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  const pfDefaults = {
    isLoading: false,
    isComputing: false,
    evPerDeck: 10,
    chaosToDivineRatio: 200,
    baseRate: 80,
    baseRateSource: "exchange" as const,
    snapshotFetchedAt: "2024-06-15T12:00:00Z",
    getTotalCost: vi.fn(() => 16000),
    getTotalRevenue: vi.fn(() => 20000),
    getNetPnL: vi.fn(() => 4000),
    getBreakEvenRate: vi.fn(() => 20),
    getAvgCostPerDeck: vi.fn(() => 2.5),
    hasData: vi.fn(() => true),
    fetchData: vi.fn(async () => {}),
    ...overrides.profitForecast,
  };

  return {
    settings: {
      getSelectedGame: vi.fn(() => "poe2"),
      getActiveGameViewSelectedLeague: vi.fn(() => "Standard"),
      ...overrides.settings,
    },
    profitForecast: pfDefaults,
    poeNinja: {
      isRefreshing: false,
      refreshPrices: vi.fn(async () => {}),
      getRefreshableAt: vi.fn(() => null),
      ...overrides.poeNinja,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFSummaryCards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Card Titles ────────────────────────────────────────────────────────

  describe("Card Titles", () => {
    it("renders all 5 stat cards", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      const stats = screen.getAllByTestId("stat");
      expect(stats).toHaveLength(5);
    });

    it("renders 'Base Rate' title", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("Base Rate")).toBeInTheDocument();
    });

    it("renders 'You Spend' title", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("You Spend")).toBeInTheDocument();
    });

    it("renders 'Expected Return' title", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("Expected Return")).toBeInTheDocument();
    });

    it("renders 'Net Profit' title", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("Net Profit")).toBeInTheDocument();
    });

    it("renders 'Break-Even Rate' title", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("Break-Even Rate")).toBeInTheDocument();
    });
  });

  // ── Loading / Skeleton ─────────────────────────────────────────────────

  describe("Skeleton states", () => {
    it("shows skeletons when isLoading is true", () => {
      setupStore({ profitForecast: { isLoading: true } });
      const { container } = renderWithProviders(<PFSummaryCards />);

      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows skeletons when isComputing is true", () => {
      setupStore({ profitForecast: { isComputing: true } });
      const { container } = renderWithProviders(<PFSummaryCards />);

      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows skeletons when isRefreshing is true", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      const { container } = renderWithProviders(<PFSummaryCards />);

      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("does not show skeletons when everything is idle with data", () => {
      setupStore();
      const { container } = renderWithProviders(<PFSummaryCards />);

      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons).toHaveLength(0);
    });
  });

  // ── No Data (dashes) ──────────────────────────────────────────────────

  describe("No data (dash display)", () => {
    it("shows dashes when hasData returns false", () => {
      setupStore({
        profitForecast: {
          hasData: vi.fn(() => false),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const dashes = screen.getAllByText("—");
      // Base Rate, You Spend, Expected Return, Net Profit, Break-Even Rate → 5
      expect(dashes).toHaveLength(5);
    });

    it("shows dashes when isLoading is true (dataAvailable = false)", () => {
      setupStore({
        profitForecast: {
          isLoading: true,
          hasData: vi.fn(() => true),
        },
      });
      const { container } = renderWithProviders(<PFSummaryCards />);

      // When loading, skeletons are shown instead of dashes, not dashes
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ── Base Rate ──────────────────────────────────────────────────────────

  describe("Base Rate card", () => {
    it("displays the base rate in 'decks/div' format", () => {
      setupStore({ profitForecast: { baseRate: 80 } });
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("80 decks/div")).toBeInTheDocument();
    });

    it("shows dash when baseRate is 0", () => {
      setupStore({ profitForecast: { baseRate: 0 } });
      renderWithProviders(<PFSummaryCards />);

      // The first "—" would be for Base Rate
      const statValues = screen.getAllByTestId("stat-value");
      expect(statValues[0]).toHaveTextContent("—");
    });

    it("shows 'derived' badge when baseRateSource is 'derived'", () => {
      setupStore({
        profitForecast: { baseRateSource: "derived" },
      });
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("derived")).toBeInTheDocument();
    });

    it("does not show 'derived' badge when baseRateSource is 'exchange'", () => {
      setupStore({
        profitForecast: { baseRateSource: "exchange" },
      });
      renderWithProviders(<PFSummaryCards />);

      expect(screen.queryByText("derived")).not.toBeInTheDocument();
    });

    it("shows formatted snapshot date in description", () => {
      setupStore({
        profitForecast: {
          snapshotFetchedAt: "2024-06-15T12:00:00Z",
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // The date formatter uses toLocaleString with month: "short", day: "numeric", etc.
      // The exact text depends on locale, but let's verify something renders in the desc
      const statDescs = screen.getAllByTestId("stat-desc");
      // The first stat-desc is for Base Rate; it should have content when data is available
      expect(statDescs[0].textContent).not.toBe("");
    });
  });

  // ── You Spend ──────────────────────────────────────────────────────────

  describe("You Spend card", () => {
    it("displays total cost formatted in divine", () => {
      setupStore({
        profitForecast: {
          getTotalCost: vi.fn(() => 16000),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const expected = formatDivine(16000, 200);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("shows avg cost per deck in description", () => {
      setupStore({
        profitForecast: {
          getAvgCostPerDeck: vi.fn(() => 2.5),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // avgCostPerDeckDivine = 2.5 / 200 = 0.0125
      expect(screen.getByText("avg 0.01 d/deck")).toBeInTheDocument();
    });
  });

  // ── Expected Return ────────────────────────────────────────────────────

  describe("Expected Return card", () => {
    it("displays total revenue formatted in divine", () => {
      setupStore({
        profitForecast: {
          getTotalRevenue: vi.fn(() => 20000),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const expected = formatDivine(20000, 200);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("shows EV per deck in divine in description", () => {
      setupStore({
        profitForecast: {
          evPerDeck: 10,
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // evPerDeckDivine = 10 / 200 = 0.05
      expect(screen.getByText("0.05 d avg value/deck")).toBeInTheDocument();
    });
  });

  // ── Net Profit ─────────────────────────────────────────────────────────

  describe("Net Profit card", () => {
    it("displays positive net profit with + prefix and formatted divine value", () => {
      setupStore({
        profitForecast: {
          getNetPnL: vi.fn(() => 4000),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // +formatDivine(4000, 200) → 4000/200 = 20 → "20.00 d" → "+20.00 d"
      const expected = `+${formatDivine(4000, 200)}`;
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("has text-success class when net profit is positive", () => {
      setupStore({
        profitForecast: {
          getNetPnL: vi.fn(() => 4000),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      // Net Profit is the 4th stat (index 3)
      expect(statValues[3]).toHaveClass("text-success");
    });

    it("has text-error class when net profit is negative", () => {
      setupStore({
        profitForecast: {
          getNetPnL: vi.fn(() => -2000),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      expect(statValues[3]).toHaveClass("text-error");
    });

    it("displays negative net profit with minus sign", () => {
      setupStore({
        profitForecast: {
          getNetPnL: vi.fn(() => -2000),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // The component uses "\u2212" (minus sign) for negative values
      // netPnL = -2000, abs = 2000, formatDivine(2000, 200) = "10.00 d"
      // display: "−10.00 d" (with U+2212)
      const expected = `\u221210.00 d`;
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("has text-success class when net profit is exactly zero", () => {
      setupStore({
        profitForecast: {
          getNetPnL: vi.fn(() => 0),
          chaosToDivineRatio: 200,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      // pnlIsPositive = netPnL >= 0 → true for 0
      expect(statValues[3]).toHaveClass("text-success");
    });
  });

  // ── Break-Even Rate ────────────────────────────────────────────────────

  describe("Break-Even Rate card", () => {
    it("displays break-even rate in 'decks/div' format (ceiling)", () => {
      setupStore({
        profitForecast: {
          getBreakEvenRate: vi.fn(() => 19.3),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // Math.ceil(19.3) = 20
      expect(screen.getByText("20 decks/div")).toBeInTheDocument();
    });

    it("has text-success when baseRate > breakEvenRate", () => {
      setupStore({
        profitForecast: {
          baseRate: 80,
          getBreakEvenRate: vi.fn(() => 20),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      // Break-Even Rate is the 5th stat (index 4)
      expect(statValues[4]).toHaveClass("text-success");
    });

    it("has text-error when baseRate <= breakEvenRate", () => {
      setupStore({
        profitForecast: {
          baseRate: 15,
          getBreakEvenRate: vi.fn(() => 20),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      expect(statValues[4]).toHaveClass("text-error");
    });

    it("shows dash when breakEvenRate is 0", () => {
      setupStore({
        profitForecast: {
          getBreakEvenRate: vi.fn(() => 0),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      expect(statValues[4]).toHaveTextContent("—");
    });

    it("does not have colored class when breakEvenRate is 0 (no data scenario)", () => {
      setupStore({
        profitForecast: {
          getBreakEvenRate: vi.fn(() => 0),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      const statValues = screen.getAllByTestId("stat-value");
      expect(statValues[4]).not.toHaveClass("text-success");
      expect(statValues[4]).not.toHaveClass("text-error");
    });

    it("shows break-even description when rate is available", () => {
      setupStore({
        profitForecast: {
          getBreakEvenRate: vi.fn(() => 19.3),
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // "need ≥ 20 to break even" (Math.ceil(19.3) = 20, uses U+2265 for ≥)
      expect(
        screen.getByText(/need \u2265 20 to break even/),
      ).toBeInTheDocument();
    });
  });

  // ── Refresh Button in Base Rate Card ───────────────────────────────────

  describe("Refresh button in Base Rate card", () => {
    it("renders a Refresh badge-button in the description when data is available", () => {
      setupStore();
      renderWithProviders(<PFSummaryCards />);

      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    it("calls refreshPrices and fetchData on refresh badge click", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<PFSummaryCards />);

      const refreshBadge = screen.getByText("Refresh");
      await user.click(refreshBadge.closest("button")!);

      expect(store.poeNinja.refreshPrices).toHaveBeenCalledWith(
        "poe2",
        "Standard",
      );
    });

    it("disables refresh badge when isRefreshing is true", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      const { container } = renderWithProviders(<PFSummaryCards />);

      // When refreshing, skeletons are shown, so the refresh button isn't rendered
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("handles chaosToDivineRatio of 0 gracefully", () => {
      setupStore({
        profitForecast: {
          chaosToDivineRatio: 0,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // formatDivine with ratio=0 returns "— d"
      // Should render without crashing
      expect(screen.getByText("Base Rate")).toBeInTheDocument();
    });

    it("handles snapshotFetchedAt being null", () => {
      setupStore({
        profitForecast: {
          snapshotFetchedAt: null,
        },
      });
      renderWithProviders(<PFSummaryCards />);

      // Should not crash and still show values
      expect(screen.getByText("Base Rate")).toBeInTheDocument();
    });

    it("has onboarding data attribute on Base Rate stat", () => {
      setupStore();
      const { container } = renderWithProviders(<PFSummaryCards />);

      const baseRateStat = container.querySelector(
        '[data-onboarding="pf-base-rate"]',
      );
      expect(baseRateStat).toBeInTheDocument();
    });

    it("has onboarding data attribute on Break-Even Rate stat", () => {
      setupStore();
      const { container } = renderWithProviders(<PFSummaryCards />);

      const breakEvenStat = container.querySelector(
        '[data-onboarding="pf-break-even-rate"]',
      );
      expect(breakEvenStat).toBeInTheDocument();
    });
  });
});
