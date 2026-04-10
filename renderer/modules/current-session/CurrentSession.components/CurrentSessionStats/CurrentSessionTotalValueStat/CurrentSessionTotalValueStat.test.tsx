import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionTotalValueStat from "./CurrentSessionTotalValueStat";

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
  GiCardExchange: (_props: any) => <span data-testid="icon-card-exchange" />,
  GiLockedChest: (_props: any) => <span data-testid="icon-locked-chest" />,
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

describe("CurrentSessionTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
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

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("N/A");
  });

  it("shows total value in divines when totalValue >= chaosToDivineRatio (exchange)", () => {
    setupStore({
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
    setupStore({
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
    setupStore({
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
    setupStore({
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
    setupStore({
      session: createSession(),
      priceSource: "exchange",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("icon-card-exchange")).toBeInTheDocument();
  });

  it("renders stash icon when price source is stash", () => {
    setupStore({
      session: createSession(),
      priceSource: "stash",
    });
    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("icon-locked-chest")).toBeInTheDocument();
  });

  it("uses stash totals when priceSource is stash", () => {
    setupStore({
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
