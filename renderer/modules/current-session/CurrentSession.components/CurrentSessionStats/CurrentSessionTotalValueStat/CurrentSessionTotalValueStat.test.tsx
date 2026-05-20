import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionTotalValueStat from "./CurrentSessionTotalValueStat";

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

vi.mock("react-icons/gi", () => ({
  GiCardExchange: (_props: any) => <span data-testid="icon-card-exchange" />,
  GiLockedChest: (_props: any) => <span data-testid="icon-locked-chest" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStore(overrides: any = {}) {
  const store = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
      getIsCurrentSessionActive: vi.fn(() => overrides.isActive ?? false),
      ...overrides.currentSession,
    },
    settings: {
      ...overrides.settings,
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function createSession(overrides: any = {}) {
  return {
    priceSnapshot: {
      timestamp: "2024-06-15T12:00:00.000Z",
      chaosToDivineRatio: 200,
      cardPrices: {},
    },
    totals: {
      chaosToDivineRatio: 200,
      totalValue: 500,
      netProfit: 300,
      totalDeckCost: 200,
      stackedDeckChaosCost: 3,
    },
    ...overrides,
  };
}

describe("CurrentSessionTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows total value in divines when value exceeds the divine ratio", () => {
    setupStore({ session: createSession() });

    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("Total Value")).toBeInTheDocument();
    expect(screen.getByText("2.50d")).toBeInTheDocument();
    expect(screen.getByText("500", { exact: false })).toBeInTheDocument();
  });

  it("shows unavailable pricing when there is no current session", () => {
    setupStore({ session: null });

    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("Total Value")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it("shows total value in chaos when below the divine ratio", () => {
    setupStore({
      session: createSession({
        totals: {
          chaosToDivineRatio: 200,
          totalValue: 50,
          netProfit: 0,
          totalDeckCost: 0,
          stackedDeckChaosCost: 3,
        },
      }),
    });

    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("50.00c")).toBeInTheDocument();
    expect(screen.getByText("0.25 divine")).toBeInTheDocument();
  });

  it("shows divine-rate unavailable when the snapshot has no usable ratio", () => {
    setupStore({
      session: createSession({
        priceSnapshot: {
          timestamp: "2024-06-15T12:00:00.000Z",
          chaosToDivineRatio: 0,
          cardPrices: {},
        },
        totals: {
          chaosToDivineRatio: 0,
          totalValue: 50,
          netProfit: 0,
          totalDeckCost: 0,
          stackedDeckChaosCost: 3,
        },
      }),
    });

    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("50.00c")).toBeInTheDocument();
    expect(screen.getByText("Divine rate unavailable")).toBeInTheDocument();
  });

  it("shows unavailable pricing without a snapshot", () => {
    setupStore({ session: createSession({ priceSnapshot: null }) });

    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("No pricing data")).toBeInTheDocument();
  });

  it("renders exchange icon for the single price source", () => {
    setupStore({ session: createSession() });

    renderWithProviders(<CurrentSessionTotalValueStat />);

    expect(screen.getByTestId("icon-card-exchange")).toBeInTheDocument();
  });
});
