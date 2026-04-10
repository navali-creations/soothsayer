import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PriceSnapshotAlert from "./PriceSnapshotAlert";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => {
  const useBoundStore = vi.fn();
  return {
    useBoundStore,
    useCurrentSession: () => useBoundStore().currentSession,
    useSettings: () => useBoundStore().settings,
    usePoeNinja: () => useBoundStore().poeNinja,
    useSessionDetails: () => useBoundStore().sessionDetails,
    useOverlay: () => useBoundStore().overlay,
    useAppMenu: () => useBoundStore().appMenu,
    useSetup: () => useBoundStore().setup,
    useStorage: () => useBoundStore().storage,
    useGameInfo: () => useBoundStore().gameInfo,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useCardDetails: () => useBoundStore().cardDetails,
    useRootActions: () => {
      const s = useBoundStore();
      return {
        hydrate: s.hydrate,
        startListeners: s.startListeners,
        reset: s.reset,
      };
    },
    useSlice: (key: string) => useBoundStore()?.[key],
  };
});

vi.mock("~/renderer/components", () => ({
  Countdown: ({ timer }: any) => (
    <span data-testid="countdown">
      {String(timer.hours).padStart(2, "0")}:
      {String(timer.minutes).padStart(2, "0")}:
      {String(timer.seconds).padStart(2, "0")}
    </span>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

interface StoreOverrides {
  session?: any;
  sessionInfo?: any;
  priceSource?: "exchange" | "stash";
  currentSnapshot?: any;
  isAutoRefreshActive?: boolean;
  timeUntilNextRefresh?: number | null;
}

function createMockStore(overrides: StoreOverrides = {}) {
  return {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
      getSessionInfo: vi.fn(() => overrides.sessionInfo ?? null),
    },
    settings: {
      getActiveGameViewPriceSource: vi.fn(
        () => overrides.priceSource ?? "exchange",
      ),
    },
    poeNinja: {
      currentSnapshot: overrides.currentSnapshot ?? null,
      isAutoRefreshActive: vi.fn(() => overrides.isAutoRefreshActive ?? false),
      getTimeUntilNextRefresh: vi.fn(
        () => overrides.timeUntilNextRefresh ?? null,
      ),
    },
  } as any;
}

function setupStore(overrides: StoreOverrides = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Snapshot / session factories ──────────────────────────────────────────

const FIXED_TIMESTAMP = "2024-06-15T12:00:00.000Z";

function createSession(overrides: any = {}) {
  return {
    priceSnapshot: {
      timestamp: FIXED_TIMESTAMP,
      stash: { chaosToDivineRatio: 200 },
      exchange: { chaosToDivineRatio: 220 },
      ...overrides.priceSnapshot,
    },
    snapshotId: overrides.snapshotId ?? "snap-abcdef1234567890",
    totalCount: overrides.totalCount ?? 10,
    cards: overrides.cards ?? [],
    totals: {
      exchange: { chaosToDivineRatio: 220, totalValue: 500, netProfit: 300 },
      stash: { chaosToDivineRatio: 200, totalValue: 480, netProfit: 280 },
      totalDeckCost: 200,
      ...overrides.totals,
    },
    ...overrides,
  };
}

function createCurrentSnapshot(overrides: any = {}) {
  return {
    id: overrides.id ?? "live-snap-999",
    fetchedAt: overrides.fetchedAt ?? FIXED_TIMESTAMP,
    exchangeChaosToDivine: overrides.exchangeChaosToDivine ?? 220,
    stashChaosToDivine: overrides.stashChaosToDivine ?? 200,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PriceSnapshotAlert", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Null rendering ─────────────────────────────────────────────────────

  it("returns null when there is no snapshot data at all", () => {
    setupStore({
      session: null,
      currentSnapshot: null,
    });

    const { container } = renderWithProviders(<PriceSnapshotAlert />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when session has no priceSnapshot and currentSnapshot is null", () => {
    setupStore({
      session: { priceSnapshot: null, totals: null },
      currentSnapshot: null,
    });

    const { container } = renderWithProviders(<PriceSnapshotAlert />);

    expect(container.innerHTML).toBe("");
  });

  // ── Alert rendering with session snapshot ──────────────────────────────

  it("renders a success alert when session has a price snapshot", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-success");
  });

  it("renders a success alert when only currentSnapshot exists (no session snapshot)", () => {
    setupStore({
      session: null,
      currentSnapshot: createCurrentSnapshot(),
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-success");
  });

  // ── Price source label ─────────────────────────────────────────────────

  it('shows "exchange" pricing label when price source is exchange', () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      priceSource: "exchange",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(
      screen.getByText(/Using exchange pricing snapshot/),
    ).toBeInTheDocument();
  });

  it('shows "stash" pricing label when price source is stash', () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      priceSource: "stash",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(
      screen.getByText(/Using stash pricing snapshot/),
    ).toBeInTheDocument();
  });

  // ── Divine ratio display ───────────────────────────────────────────────

  it("displays chaos-to-divine ratio from session totals (exchange)", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: {
            chaosToDivineRatio: 220,
            totalValue: 500,
            netProfit: 300,
          },
          stash: { chaosToDivineRatio: 200, totalValue: 480, netProfit: 280 },
          totalDeckCost: 200,
        },
      }),
      sessionInfo: { league: "poe1:Settlers" },
      priceSource: "exchange",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 220\.00c/)).toBeInTheDocument();
  });

  it("displays chaos-to-divine ratio from session totals (stash)", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: {
            chaosToDivineRatio: 220,
            totalValue: 500,
            netProfit: 300,
          },
          stash: { chaosToDivineRatio: 200, totalValue: 480, netProfit: 280 },
          totalDeckCost: 200,
        },
      }),
      sessionInfo: { league: "poe1:Settlers" },
      priceSource: "stash",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 200\.00c/)).toBeInTheDocument();
  });

  it("falls back to currentSnapshot for divine ratio when session totals are missing (exchange)", () => {
    setupStore({
      session: null,
      currentSnapshot: createCurrentSnapshot({
        exchangeChaosToDivine: 215,
        stashChaosToDivine: 195,
      }),
      priceSource: "exchange",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 215\.00c/)).toBeInTheDocument();
  });

  it("falls back to currentSnapshot for divine ratio when session totals are missing (stash)", () => {
    setupStore({
      session: null,
      currentSnapshot: createCurrentSnapshot({
        exchangeChaosToDivine: 215,
        stashChaosToDivine: 195,
      }),
      priceSource: "stash",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 195\.00c/)).toBeInTheDocument();
  });

  it("does not show divine ratio text when ratio is 0", () => {
    setupStore({
      session: createSession({
        totals: {
          exchange: { chaosToDivineRatio: 0, totalValue: 0, netProfit: 0 },
          stash: { chaosToDivineRatio: 0, totalValue: 0, netProfit: 0 },
          totalDeckCost: 0,
        },
      }),
      currentSnapshot: null,
      sessionInfo: { league: "poe1:Settlers" },
      priceSource: "exchange",
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Divine =/)).not.toBeInTheDocument();
  });

  // ── Snapshot ID display ────────────────────────────────────────────────

  it("shows truncated snapshot ID from session", () => {
    setupStore({
      session: createSession({ snapshotId: "abcdef1234567890extra" }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Snapshot: abcdef12\.\.\./)).toBeInTheDocument();
  });

  // ── Checkbox hint ──────────────────────────────────────────────────────

  it("shows hint about hiding anomalous prices via checkboxes", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(
      screen.getByText("Use checkboxes to hide anomalous prices"),
    ).toBeInTheDocument();
  });

  // ── Countdown rendering ────────────────────────────────────────────────

  it("shows countdown when auto-refresh is active and time remaining > 0", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: true,
      // 1h 23m 45s in ms
      timeUntilNextRefresh: (1 * 3600 + 23 * 60 + 45) * 1000,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Next refresh in:/)).toBeInTheDocument();
    expect(screen.getByTestId("countdown")).toBeInTheDocument();
  });

  it('shows "Refreshing soon..." when auto-refresh active but countdown is 0', () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: true,
      timeUntilNextRefresh: 0,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Refreshing soon\.\.\./)).toBeInTheDocument();
  });

  it('shows "Refreshing soon..." when auto-refresh active and timeUntilNextRefresh is null', () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: true,
      timeUntilNextRefresh: null,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Refreshing soon\.\.\./)).toBeInTheDocument();
  });

  it("does not show countdown or refreshing text when auto-refresh is not active", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: false,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Next refresh in:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Refreshing soon/)).not.toBeInTheDocument();
  });

  // ── Stale snapshot detection ───────────────────────────────────────────

  it("shows rarities-updated notice when currentSnapshot is >60s newer than session snapshot", () => {
    const sessionTime = "2024-06-15T12:00:00.000Z";
    const liveTime = "2024-06-15T12:05:00.000Z"; // 5 minutes later

    setupStore({
      session: createSession({
        priceSnapshot: { timestamp: sessionTime },
      }),
      currentSnapshot: createCurrentSnapshot({ fetchedAt: liveTime }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Rarities updated/)).toBeInTheDocument();
  });

  it("does not show rarities-updated notice when timestamps are within 60s", () => {
    const sessionTime = "2024-06-15T12:00:00.000Z";
    const liveTime = "2024-06-15T12:00:30.000Z"; // 30 seconds later

    setupStore({
      session: createSession({
        priceSnapshot: { timestamp: sessionTime },
      }),
      currentSnapshot: createCurrentSnapshot({ fetchedAt: liveTime }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Rarities updated/)).not.toBeInTheDocument();
  });

  it("does not show rarities-updated notice when currentSnapshot is null", () => {
    setupStore({
      session: createSession(),
      currentSnapshot: null,
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Rarities updated/)).not.toBeInTheDocument();
  });

  // ── League parsing ─────────────────────────────────────────────────────

  it("parses game and league from sessionInfo.league format 'poe1:LeagueName'", () => {
    const mockIsAutoRefreshActive = vi.fn(() => true);

    const store = {
      currentSession: {
        getSession: vi.fn(() => createSession()),
        getSessionInfo: vi.fn(() => ({ league: "poe2:Dawn" })),
      },
      settings: {
        getActiveGameViewPriceSource: vi.fn(() => "exchange"),
      },
      poeNinja: {
        currentSnapshot: null,
        isAutoRefreshActive: mockIsAutoRefreshActive,
        getTimeUntilNextRefresh: vi.fn(() => 60000),
      },
    } as any;

    mockUseBoundStore.mockReturnValue(store);

    renderWithProviders(<PriceSnapshotAlert />);

    expect(mockIsAutoRefreshActive).toHaveBeenCalledWith("poe2", "Dawn");
  });

  it("handles missing sessionInfo.league gracefully (no auto-refresh calls)", () => {
    const mockIsAutoRefreshActive = vi.fn(() => false);

    const store = {
      currentSession: {
        getSession: vi.fn(() => createSession()),
        getSessionInfo: vi.fn(() => null),
      },
      settings: {
        getActiveGameViewPriceSource: vi.fn(() => "exchange"),
      },
      poeNinja: {
        currentSnapshot: null,
        isAutoRefreshActive: mockIsAutoRefreshActive,
        getTimeUntilNextRefresh: vi.fn(() => null),
      },
    } as any;

    mockUseBoundStore.mockReturnValue(store);

    renderWithProviders(<PriceSnapshotAlert />);

    // isAutoRefreshActive should not be called with valid game/league
    // since sessionInfo is null, game and league are undefined
    // The component checks `game && league ? isAutoRefreshActive(game, league) : false`
    expect(mockIsAutoRefreshActive).not.toHaveBeenCalled();
  });

  // ── Snapshot timestamp display ─────────────────────────────────────────

  it("displays the session snapshot timestamp in the alert", () => {
    const timestamp = "2024-01-15T10:30:00.000Z";

    setupStore({
      session: createSession({
        priceSnapshot: { timestamp },
      }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    // The timestamp is rendered via new Date(timestamp).toLocaleString()
    const expectedText = new Date(timestamp).toLocaleString();
    expect(
      screen.getByText(
        new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    ).toBeInTheDocument();
  });
});
