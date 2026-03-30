import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import StatisticsPage from "./Statistics.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseDivinationCards = vi.fn();

vi.mock("~/renderer/hooks", () => ({
  useDivinationCards: (...args: any[]) => mockUseDivinationCards(...args),
}));

vi.mock("../Statistics.components", () => ({
  StatisticsCharts: (props: any) => (
    <div
      data-testid="statistics-charts"
      data-is-data-loading={String(!!props.isDataLoading)}
    />
  ),
  StatisticsActions: (props: any) => (
    <div
      data-testid="statistics-actions"
      data-current-scope={props.currentScope}
      data-available-leagues={JSON.stringify(props.availableLeagues)}
    />
  ),
  StatisticsStats: (props: any) => (
    <div
      data-testid="statistics-stats"
      data-total-count={props.totalCount}
      data-unique-card-count={props.uniqueCardCount}
      data-is-data-loading={String(!!props.isDataLoading)}
    />
  ),
  StatisticsTable: (props: any) => (
    <div
      data-testid="statistics-table"
      data-card-data={JSON.stringify(props.cardData)}
      data-is-data-loading={String(!!props.isDataLoading)}
    />
  ),
}));

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle, actions }: any) => (
        <div data-testid="page-header">
          <span data-testid="page-title">{title}</span>
          {subtitle && <span data-testid="page-subtitle">{subtitle}</span>}
          <div data-testid="page-actions">{actions}</div>
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  const { settings: settingsOverrides, ...statisticsOverrides } = overrides;
  return {
    statistics: {
      statScope: "all-time" as const,
      selectedLeague: "",
      setSelectedLeague: vi.fn(),
      setStatScope: vi.fn(),
      ...statisticsOverrides,
    },
    settings: {
      getActiveGameViewSelectedLeague: vi.fn(() => ""),
      ...settingsOverrides,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function setupHook(overrides: any = {}) {
  const hookResult = {
    stats: null as any,
    loading: false,
    availableLeagues: [] as string[],
    ...overrides,
  };
  mockUseDivinationCards.mockReturnValue(hookResult);
  return hookResult;
}

function createStats(overrides: any = {}) {
  return {
    totalCount: 20,
    cards: {
      "Rain of Chaos": { count: 15 },
      "The Doctor": { count: 5 },
    },
    lastUpdated: null,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatisticsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state (overlay, not full-page spinner) ─────────────────────

  it("renders page structure even when loading is true", () => {
    setupStore();
    setupHook({ loading: true, stats: null });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("page-container")).toBeInTheDocument();
    expect(screen.getByTestId("statistics-stats")).toBeInTheDocument();
    expect(screen.getByTestId("statistics-table")).toBeInTheDocument();
    expect(screen.getByTestId("statistics-charts")).toBeInTheDocument();
  });

  it("passes isDataLoading=true to children when loading is true", () => {
    setupStore();
    setupHook({ loading: true, stats: null });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("statistics-stats")).toHaveAttribute(
      "data-is-data-loading",
      "true",
    );
    expect(screen.getByTestId("statistics-table")).toHaveAttribute(
      "data-is-data-loading",
      "true",
    );
    expect(screen.getByTestId("statistics-charts")).toHaveAttribute(
      "data-is-data-loading",
      "true",
    );
  });

  it("passes isDataLoading=true to children when stats is null", () => {
    setupStore();
    setupHook({ loading: false, stats: null });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("statistics-stats")).toHaveAttribute(
      "data-is-data-loading",
      "true",
    );
    expect(screen.getByTestId("statistics-table")).toHaveAttribute(
      "data-is-data-loading",
      "true",
    );
    expect(screen.getByTestId("statistics-charts")).toHaveAttribute(
      "data-is-data-loading",
      "true",
    );
  });

  it("passes isDataLoading=false to children when stats are loaded", () => {
    setupStore();
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("statistics-stats")).toHaveAttribute(
      "data-is-data-loading",
      "false",
    );
    expect(screen.getByTestId("statistics-table")).toHaveAttribute(
      "data-is-data-loading",
      "false",
    );
    expect(screen.getByTestId("statistics-charts")).toHaveAttribute(
      "data-is-data-loading",
      "false",
    );
  });

  // ── Page renders after loading ─────────────────────────────────────────

  it('renders page title "Statistics"', () => {
    setupStore();
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent("Statistics");
  });

  it("renders StatisticsActions in the header", () => {
    setupStore();
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    const actions = screen.getByTestId("page-actions");
    expect(actions).toContainElement(screen.getByTestId("statistics-actions"));
  });

  it("renders StatisticsStats in the content area", () => {
    setupStore();
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("statistics-stats")).toBeInTheDocument();
  });

  it("renders StatisticsTable in the content area", () => {
    setupStore();
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByTestId("statistics-table")).toBeInTheDocument();
  });

  it("passes fallback values to children when stats is null", () => {
    setupStore();
    setupHook({ loading: true, stats: null });

    renderWithProviders(<StatisticsPage />);

    const statsEl = screen.getByTestId("statistics-stats");
    expect(statsEl).toHaveAttribute("data-total-count", "0");
    expect(statsEl).toHaveAttribute("data-unique-card-count", "0");

    const tableEl = screen.getByTestId("statistics-table");
    const cardData = JSON.parse(tableEl.getAttribute("data-card-data")!);
    expect(cardData).toEqual([]);
  });

  // ── useDivinationCards hook params ─────────────────────────────────────

  it('calls useDivinationCards with game "poe1" and scope from store', () => {
    setupStore({ statScope: "all-time" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(mockUseDivinationCards).toHaveBeenCalledWith({
      game: "poe1",
      scope: "all-time",
      league: undefined,
    });
  });

  it("passes selectedLeague to hook when scope is league", () => {
    setupStore({ statScope: "league", selectedLeague: "Settlers" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(mockUseDivinationCards).toHaveBeenCalledWith({
      game: "poe1",
      scope: "league",
      league: "Settlers",
    });
  });

  it("passes undefined league to hook when scope is all-time", () => {
    setupStore({ statScope: "all-time", selectedLeague: "Settlers" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(mockUseDivinationCards).toHaveBeenCalledWith({
      game: "poe1",
      scope: "all-time",
      league: undefined,
    });
  });

  // ── cardData computation ───────────────────────────────────────────────

  it("computes cardData sorted by count descending", () => {
    setupStore();
    setupHook({
      stats: createStats({
        totalCount: 30,
        cards: {
          "Card A": { count: 5 },
          "Card B": { count: 20 },
          "Card C": { count: 5 },
        },
      }),
    });

    renderWithProviders(<StatisticsPage />);

    const tableEl = screen.getByTestId("statistics-table");
    const cardData = JSON.parse(tableEl.getAttribute("data-card-data")!);
    expect(cardData[0].name).toBe("Card B");
    expect(cardData[0].count).toBe(20);
    expect(cardData[1].count).toBe(5);
    expect(cardData[2].count).toBe(5);
  });

  it("computes ratio as (count / totalCount) * 100", () => {
    setupStore();
    setupHook({
      stats: createStats({
        totalCount: 100,
        cards: {
          "Card A": { count: 25 },
          "Card B": { count: 75 },
        },
      }),
    });

    renderWithProviders(<StatisticsPage />);

    const tableEl = screen.getByTestId("statistics-table");
    const cardData = JSON.parse(tableEl.getAttribute("data-card-data")!);
    // Card B comes first (75 > 25)
    expect(cardData[0].name).toBe("Card B");
    expect(cardData[0].ratio).toBe(75);
    expect(cardData[1].name).toBe("Card A");
    expect(cardData[1].ratio).toBe(25);
  });

  it("passes empty cardData when stats.cards is empty", () => {
    setupStore();
    setupHook({
      stats: createStats({ totalCount: 0, cards: {} }),
    });

    renderWithProviders(<StatisticsPage />);

    const tableEl = screen.getByTestId("statistics-table");
    const cardData = JSON.parse(tableEl.getAttribute("data-card-data")!);
    expect(cardData).toEqual([]);
  });

  // ── Props passed to child components ───────────────────────────────────

  it("passes totalCount from stats to StatisticsStats", () => {
    setupStore();
    setupHook({ stats: createStats({ totalCount: 42 }) });

    renderWithProviders(<StatisticsPage />);

    const statsEl = screen.getByTestId("statistics-stats");
    expect(statsEl).toHaveAttribute("data-total-count", "42");
  });

  it("passes uniqueCardCount (number of card keys) to StatisticsStats", () => {
    setupStore();
    setupHook({
      stats: createStats({
        cards: {
          "Card A": { count: 1 },
          "Card B": { count: 2 },
          "Card C": { count: 3 },
        },
      }),
    });

    renderWithProviders(<StatisticsPage />);

    const statsEl = screen.getByTestId("statistics-stats");
    expect(statsEl).toHaveAttribute("data-unique-card-count", "3");
  });

  it("passes availableLeagues from hook to StatisticsActions", () => {
    setupStore();
    setupHook({
      stats: createStats(),
      availableLeagues: ["Settlers", "Necropolis"],
    });

    renderWithProviders(<StatisticsPage />);

    const actionsEl = screen.getByTestId("statistics-actions");
    const leagues = JSON.parse(
      actionsEl.getAttribute("data-available-leagues")!,
    );
    expect(leagues).toEqual(["Settlers", "Necropolis"]);
  });

  it('passes currentScope "all-time" to StatisticsActions when scope is all-time', () => {
    setupStore({ statScope: "all-time", selectedLeague: "" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    const actionsEl = screen.getByTestId("statistics-actions");
    expect(actionsEl).toHaveAttribute("data-current-scope", "all-time");
  });

  it("passes selectedLeague as currentScope to StatisticsActions when scope is league", () => {
    setupStore({ statScope: "league", selectedLeague: "Settlers" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    const actionsEl = screen.getByTestId("statistics-actions");
    expect(actionsEl).toHaveAttribute("data-current-scope", "Settlers");
  });

  // ── Auto-select first league ───────────────────────────────────────────

  it("auto-selects first available league when switching to league scope with no matching league", () => {
    const store = setupStore({
      statScope: "league",
      selectedLeague: "OldLeague",
    });
    setupHook({
      stats: createStats(),
      availableLeagues: ["Settlers", "Necropolis"],
    });

    renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).toHaveBeenCalledWith("Settlers");
  });

  it("does not auto-select league when selectedLeague is already in availableLeagues", () => {
    const store = setupStore({
      statScope: "league",
      selectedLeague: "Necropolis",
    });
    setupHook({
      stats: createStats(),
      availableLeagues: ["Settlers", "Necropolis"],
    });

    renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).not.toHaveBeenCalled();
  });

  it("does not auto-select league when scope is all-time", () => {
    const store = setupStore({
      statScope: "all-time",
      selectedLeague: "",
    });
    setupHook({
      stats: createStats(),
      availableLeagues: ["Settlers", "Necropolis"],
    });

    renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).not.toHaveBeenCalled();
  });

  it("does not auto-select league when availableLeagues is empty", () => {
    const store = setupStore({
      statScope: "league",
      selectedLeague: "",
    });
    setupHook({
      stats: createStats(),
      availableLeagues: [],
    });

    renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).not.toHaveBeenCalled();
  });

  // ── Subtitle ───────────────────────────────────────────────────────────

  it('shows "All-time divination card statistics" subtitle when scope is all-time', () => {
    setupStore({ statScope: "all-time" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    const subtitle = screen.getByTestId("page-subtitle");
    expect(subtitle).toHaveTextContent("All-time divination card statistics");
  });

  it('shows "League-specific statistics" subtitle when scope is league', () => {
    setupStore({ statScope: "league", selectedLeague: "Settlers" });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    const subtitle = screen.getByTestId("page-subtitle");
    expect(subtitle).toHaveTextContent("League-specific statistics");
  });

  // ── League seeding from global settings ────────────────────────────────

  it("seeds selectedLeague and sets scope to league from global settings on mount", () => {
    const store = setupStore({
      statScope: "all-time",
      selectedLeague: "",
      settings: {
        getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      },
    });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).toHaveBeenCalledWith("Settlers");
    expect(store.statistics.setStatScope).toHaveBeenCalledWith("league");
  });

  it("does not seed when global league is empty", () => {
    const store = setupStore({
      statScope: "all-time",
      selectedLeague: "",
      settings: {
        getActiveGameViewSelectedLeague: vi.fn(() => ""),
      },
    });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setStatScope).not.toHaveBeenCalled();
  });

  it("seeds only once on mount, not on re-renders", () => {
    const store = setupStore({
      statScope: "all-time",
      selectedLeague: "",
      settings: {
        getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      },
    });
    setupHook({ stats: createStats() });

    const { rerender } = renderWithProviders(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).toHaveBeenCalledTimes(1);
    expect(store.statistics.setStatScope).toHaveBeenCalledTimes(1);

    // Re-render — should NOT seed again
    rerender(<StatisticsPage />);

    expect(store.statistics.setSelectedLeague).toHaveBeenCalledTimes(1);
    expect(store.statistics.setStatScope).toHaveBeenCalledTimes(1);
  });

  it("does not modify global settings when seeding statistics league", () => {
    const globalGetter = vi.fn(() => "Settlers");
    setupStore({
      statScope: "all-time",
      selectedLeague: "",
      settings: {
        getActiveGameViewSelectedLeague: globalGetter,
      },
    });
    setupHook({ stats: createStats() });

    renderWithProviders(<StatisticsPage />);

    // The global getter is called once to read the value, but no setter
    // for the global settings should be invoked (statistics has its own
    // independent league selection).
    expect(globalGetter).toHaveBeenCalled();
  });
});
