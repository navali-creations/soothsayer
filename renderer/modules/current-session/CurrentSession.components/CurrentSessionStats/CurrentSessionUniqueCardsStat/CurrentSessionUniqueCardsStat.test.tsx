import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionUniqueCardsStat from "./CurrentSessionUniqueCardsStat";

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

describe("CurrentSessionUniqueCardsStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Unique Cards" title', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByText("Unique Cards")).toBeInTheDocument();
  });

  it("renders 0 when session is null", () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("0");
  });

  it("renders the count of unique cards (cards.length)", () => {
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

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("3");
  });

  it("renders 0 when session has empty cards array", () => {
    setupStore({
      session: createSession({ cards: [] }),
    });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    const value = screen.getByTestId("stat-value");
    expect(value).toHaveTextContent("0");
  });

  it('renders "Different cards found" description', () => {
    setupStore({ session: null });
    renderWithProviders(<CurrentSessionUniqueCardsStat />);

    expect(screen.getByText("Different cards found")).toBeInTheDocument();
  });
});
