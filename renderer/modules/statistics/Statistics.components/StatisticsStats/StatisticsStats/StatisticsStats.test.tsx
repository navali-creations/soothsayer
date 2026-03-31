import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { SessionHighlights } from "../../../Statistics.types";
import { StatisticsStats } from "./StatisticsStats";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
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
      Figure: ({ children, ...props }: any) => (
        <div data-testid="stat-figure" {...props}>
          {children}
        </div>
      ),
    },
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiInfo: (props: any) => <svg data-testid="icon-info" {...props} />,
}));

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName }: any) => (
    <a data-testid="card-name-link">{cardName}</a>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

const defaultHighlights: SessionHighlights = {
  mostProfitable: {
    sessionId: "s1",
    date: "2025-01-15T12:00:00Z",
    profit: 1234,
    league: "Settlers",
    chaosPerDivine: 0,
    totalDecksOpened: 100,
  },
  longestSession: {
    sessionId: "s2",
    date: "2025-01-16T12:00:00Z",
    durationMinutes: 90,
    totalDecksOpened: 75,
  },
  mostDecksOpened: {
    sessionId: "s3",
    date: "2025-01-17T12:00:00Z",
    totalDecksOpened: 500,
    durationMinutes: 45,
  },
  biggestLetdown: {
    sessionId: "s4",
    date: "2025-01-18T12:00:00Z",
    totalDecksOpened: 450,
    profit: -320,
    league: "Settlers",
    chaosPerDivine: 200,
  },
  luckyBreak: {
    sessionId: "s5",
    date: "2025-01-19T12:00:00Z",
    totalDecksOpened: 50,
    profit: 800,
    league: "Settlers",
    chaosPerDivine: 200,
  },
  totalDecksOpened: 1000,
  averages: {
    avgProfit: 500,
    avgDecksOpened: 250,
    avgDurationMinutes: 45,
    avgChaosPerDivine: 200,
    sessionCount: 10,
  },
  totalNetProfit: {
    totalProfit: 5000,
    avgChaosPerDivine: 200,
    avgDeckCost: 3,
  },
  totalTimeSpent: {
    totalMinutes: 450,
  },
  winRate: {
    profitableSessions: 7,
    totalSessions: 10,
    winRate: 0.7,
  },
  avgProfitPerDeck: {
    avgProfitPerDeck: 5,
    avgChaosPerDivine: 200,
    avgDeckCost: 3,
  },
  profitPerHour: {
    profitPerHour: 666.67,
    avgChaosPerDivine: 200,
  },
};

function setupStore(
  overrides: {
    statScope?: "all-time" | "league";
    selectedLeague?: string;
    sessionHighlights?: SessionHighlights | null;
    isLoadingHighlights?: boolean;
    stackedDeckCardCount?: number | null;
  } = {},
) {
  const fetchSessionHighlights = vi.fn();
  mockUseBoundStore.mockReturnValue({
    statistics: {
      statScope: overrides.statScope ?? "all-time",
      selectedLeague: overrides.selectedLeague ?? "",
      sessionHighlights:
        "sessionHighlights" in overrides
          ? overrides.sessionHighlights
          : defaultHighlights,
      stackedDeckCardCount: overrides.stackedDeckCardCount ?? null,
      isLoadingHighlights: overrides.isLoadingHighlights ?? false,
      fetchSessionHighlights,
    },
  } as any);
  return { fetchSessionHighlights };
}

// ─── StatisticsStats (container) ───────────────────────────────────────────

describe("StatisticsStats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading overlay ────────────────────────────────────────────────────

  it("shows loading overlay when isLoadingHighlights is true", () => {
    setupStore({ isLoadingHighlights: true });
    const { container } = renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    const spinner = container.querySelector(".loading.loading-spinner");
    expect(spinner).toBeTruthy();
  });

  it("shows loading overlay when isDataLoading is true", () => {
    setupStore({ isLoadingHighlights: false });
    const { container } = renderWithProviders(
      <StatisticsStats
        totalCount={100}
        uniqueCardCount={5}
        isDataLoading={true}
      />,
    );

    const spinner = container.querySelector(".loading.loading-spinner");
    expect(spinner).toBeTruthy();
  });

  it("does not show overlay when neither isLoadingHighlights nor isDataLoading", () => {
    setupStore({ isLoadingHighlights: false });
    const { container } = renderWithProviders(
      <StatisticsStats
        totalCount={100}
        uniqueCardCount={5}
        isDataLoading={false}
      />,
    );

    const overlay = container.querySelector(".backdrop-blur-\\[1px\\]");
    expect(overlay).toHaveClass("opacity-0");
  });

  it("still renders stat cards behind the overlay when loading", () => {
    setupStore({ isLoadingHighlights: true, statScope: "all-time" });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    // Row 1 — Decks
    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
    expect(screen.getByText("Avg. Decks Per Session")).toBeInTheDocument();
    expect(screen.getByText("Most Decks Opened")).toBeInTheDocument();
    expect(screen.getByText("Longest Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Session Duration")).toBeInTheDocument();

    // Row 2 — Profits
    expect(screen.getByText("Total Net Profit")).toBeInTheDocument();
    expect(screen.getByText("Most Profitable Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Profit Per Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Profit Per Deck")).toBeInTheDocument();
    expect(screen.getByText("Profit Per Hour")).toBeInTheDocument();

    // Row 3 — Misc
    expect(screen.getByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("Biggest Letdown")).toBeInTheDocument();
    expect(screen.getByText("Lucky Break")).toBeInTheDocument();
    expect(screen.getByText("Total Time Spent")).toBeInTheDocument();
  });

  // ── All-time scope ─────────────────────────────────────────────────────

  it("renders all stat cards for all-time scope", () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    // Row 1 — Decks
    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
    expect(screen.getByText("Avg. Decks Per Session")).toBeInTheDocument();
    expect(screen.getByText("Most Decks Opened")).toBeInTheDocument();
    expect(screen.getByText("Longest Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Session Duration")).toBeInTheDocument();

    // Row 2 — Profits
    expect(screen.getByText("Total Net Profit")).toBeInTheDocument();
    expect(screen.getByText("Most Profitable Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Profit Per Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Profit Per Deck")).toBeInTheDocument();
    expect(screen.getByText("Profit Per Hour")).toBeInTheDocument();

    // Row 3 — Misc
    expect(screen.getByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("Biggest Letdown")).toBeInTheDocument();
    expect(screen.getByText("Lucky Break")).toBeInTheDocument();
    expect(screen.getByText("Total Time Spent")).toBeInTheDocument();
  });

  it("does NOT render Unique Cards Collected in all-time scope", () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    expect(
      screen.queryByText("Unique Cards Collected"),
    ).not.toBeInTheDocument();
  });

  // ── League scope ───────────────────────────────────────────────────────

  it("renders all stat cards including Unique Cards Collected for league scope", () => {
    setupStore({ statScope: "league", selectedLeague: "Settlers" });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    // Row 1 — Decks
    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
    expect(screen.getByText("Avg. Decks Per Session")).toBeInTheDocument();
    expect(screen.getByText("Most Decks Opened")).toBeInTheDocument();
    expect(screen.getByText("Longest Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Session Duration")).toBeInTheDocument();

    // Row 2 — Profits
    expect(screen.getByText("Total Net Profit")).toBeInTheDocument();
    expect(screen.getByText("Most Profitable Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Profit Per Session")).toBeInTheDocument();
    expect(screen.getByText("Avg. Profit Per Deck")).toBeInTheDocument();
    expect(screen.getByText("Profit Per Hour")).toBeInTheDocument();

    // Row 3 — Misc (league includes Unique Cards Collected as last card)
    expect(screen.getByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("Biggest Letdown")).toBeInTheDocument();
    expect(screen.getByText("Lucky Break")).toBeInTheDocument();
    expect(screen.getByText("Total Time Spent")).toBeInTheDocument();
    expect(screen.getByText("Unique Cards Collected")).toBeInTheDocument();
  });

  // ── fetchSessionHighlights ─────────────────────────────────────────────

  it("calls fetchSessionHighlights on mount", () => {
    const { fetchSessionHighlights } = setupStore({ statScope: "all-time" });
    renderWithProviders(<StatisticsStats totalCount={0} uniqueCardCount={0} />);

    expect(fetchSessionHighlights).toHaveBeenCalledWith("poe1", undefined);
  });

  it("calls fetchSessionHighlights with league when in league scope", () => {
    const { fetchSessionHighlights } = setupStore({
      statScope: "league",
      selectedLeague: "Settlers",
    });
    renderWithProviders(<StatisticsStats totalCount={0} uniqueCardCount={0} />);

    expect(fetchSessionHighlights).toHaveBeenCalledWith("poe1", "Settlers");
  });

  // ── Data passed correctly ──────────────────────────────────────────────

  it("displays profit from session highlights", () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    // +1,234c from defaultHighlights
    expect(screen.getByText(/1.*234/)).toBeInTheDocument();
  });

  it("displays duration from session highlights", () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    // 90 minutes = 1h 30m
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  it("handles null session highlights gracefully", () => {
    setupStore({ statScope: "all-time", sessionHighlights: null });
    renderWithProviders(
      <StatisticsStats totalCount={100} uniqueCardCount={5} />,
    );

    // All stat cards should show N/A
    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(3);
  });

  it("passes totalCount to StatisticsOpenedDecksStat", () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(
      <StatisticsStats totalCount={999} uniqueCardCount={0} />,
    );

    expect(screen.getByText("999")).toBeInTheDocument();
  });

  it("passes uniqueCardCount to StatsUniqueCardsCollected in league scope", () => {
    setupStore({ statScope: "league", selectedLeague: "Settlers" });
    renderWithProviders(
      <StatisticsStats totalCount={0} uniqueCardCount={42} />,
    );

    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
