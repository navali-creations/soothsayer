import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionMostValuableStat from "./CurrentSessionMostValueableCardStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

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

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

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
