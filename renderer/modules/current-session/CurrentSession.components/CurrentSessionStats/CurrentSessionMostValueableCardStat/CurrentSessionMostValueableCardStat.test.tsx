import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionMostValuableStat from "./CurrentSessionMostValueableCardStat";

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

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStore(overrides: any = {}) {
  const state = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
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

function createSession(overrides: any = {}) {
  return {
    cards: [
      {
        name: "Rain of Chaos",
        count: 3,
        price: { chaosValue: 2, hidePrice: false },
      },
      {
        name: "The Doctor",
        count: 1,
        price: { chaosValue: 500, hidePrice: false },
      },
    ],
    priceSnapshot: {
      timestamp: "2024-06-15T12:00:00.000Z",
      chaosToDivineRatio: 200,
      cardPrices: {},
    },
    ...overrides,
  };
}

describe("CurrentSessionMostValuableStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the highest visible single-card price", () => {
    setupStore({ session: createSession() });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("Most Valuable")).toBeInTheDocument();
    expect(screen.getByText("2.50d")).toBeInTheDocument();
    expect(screen.getByText("The Doctor")).toBeInTheDocument();
  });

  it("shows dash values when there is no current session", () => {
    setupStore({ session: null });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("Most Valuable")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it("shows dash values when the session has no cards", () => {
    setupStore({ session: createSession({ cards: [] }) });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("ignores hidden card prices", () => {
    setupStore({
      session: createSession({
        cards: [
          {
            name: "Hidden Card",
            count: 1,
            price: { chaosValue: 5000, hidePrice: true },
          },
          {
            name: "Visible Card",
            count: 1,
            price: { chaosValue: 30, hidePrice: false },
          },
        ],
      }),
    });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("30.00c")).toBeInTheDocument();
    expect(screen.getByText("Visible Card")).toBeInTheDocument();
  });

  it("shows dash values when every card price is hidden", () => {
    setupStore({
      session: createSession({
        cards: [
          {
            name: "Hidden Card",
            count: 1,
            price: { chaosValue: 5000, hidePrice: true },
          },
        ],
      }),
    });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("displays chaos when the most valuable card is below the divine ratio", () => {
    setupStore({
      session: createSession({
        cards: [
          {
            name: "Small Card",
            count: 1,
            price: { chaosValue: 50, hidePrice: false },
          },
        ],
      }),
    });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("50.00c")).toBeInTheDocument();
    expect(screen.getByText("Small Card")).toBeInTheDocument();
  });

  it("falls back to chaos display when the divine ratio is unavailable", () => {
    setupStore({
      session: createSession({
        priceSnapshot: {
          timestamp: "2024-06-15T12:00:00.000Z",
          chaosToDivineRatio: 0,
          cardPrices: {},
        },
      }),
    });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("500.00c")).toBeInTheDocument();
  });

  it("shows no pricing data without a snapshot", () => {
    setupStore({ session: createSession({ priceSnapshot: null }) });

    renderWithProviders(<CurrentSessionMostValuableStat />);

    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });
});
