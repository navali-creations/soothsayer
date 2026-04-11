import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionOpenedDecksStat from "./CurrentSessionOpenedDecksStat";

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

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: any = {}) {
  const store = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
    },
    settings: {
      getActiveGameViewPriceSource: vi.fn(() => "exchange"),
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

describe("CurrentSessionOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Stacked Decks Opened" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("renders 0 when session is null", () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("0");
  });

  it("renders totalCount from session data", () => {
    setupStore({
      session: createSession({ totalCount: 42 }),
    });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("42");
  });

  it('renders "This session" description', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("This session")).toBeInTheDocument();
  });
});
