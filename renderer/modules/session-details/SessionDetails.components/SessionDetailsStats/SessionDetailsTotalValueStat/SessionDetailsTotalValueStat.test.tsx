import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionDetailsTotalValueStat } from "./SessionDetailsTotalValueStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
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
      Value: ({ children, className }: any) => (
        <div data-testid="stat-value" className={className}>
          {children}
        </div>
      ),
      Desc: ({ children }: any) => (
        <div data-testid="stat-desc">{children}</div>
      ),
      Figure: ({ children }: any) => (
        <div data-testid="stat-figure">{children}</div>
      ),
    },
  ),
  StaticProfitSparkline: (_props: any) => <div data-testid="sparkline" />,
}));

vi.mock("~/renderer/utils", () => ({
  formatCurrency: vi.fn((chaosValue: number, chaosToDivineRatio: number) => {
    if (Math.abs(chaosValue) >= chaosToDivineRatio && chaosToDivineRatio > 0) {
      return `${(chaosValue / chaosToDivineRatio).toFixed(2)}d`;
    }
    return `${chaosValue.toFixed(2)}c`;
  }),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: Record<string, any> = {}) {
  const sessionDetails = {
    getDuration: vi.fn().mockReturnValue("1h 30m"),
    getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    getMostCommonCard: vi
      .fn()
      .mockReturnValue({ name: "Rain of Chaos", count: 30, ratio: 30 }),
    getTotalProfit: vi.fn().mockReturnValue(5000),
    getPriceData: vi
      .fn()
      .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    getNetProfit: vi
      .fn()
      .mockReturnValue({ netProfit: 4500, totalDeckCost: 500 }),
    getHasTimeline: vi.fn().mockReturnValue(false),
    getTimeline: vi.fn().mockReturnValue(null),
    ...overrides,
  };
  vi.mocked(useBoundStore).mockReturnValue({ sessionDetails } as any);
  return sessionDetails;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupStore();
  });

  it('shows "Total Value" as the title', () => {
    setupStore({
      getTotalProfit: vi.fn().mockReturnValue(5000),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("Total Value")).toBeInTheDocument();
  });

  it("displays formatted currency value in chaos for small amounts", () => {
    setupStore({
      getTotalProfit: vi.fn().mockReturnValue(100),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("100.00c")).toBeInTheDocument();
  });

  it("displays formatted currency value in divine for large amounts", () => {
    setupStore({
      getTotalProfit: vi.fn().mockReturnValue(300),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("2.00d")).toBeInTheDocument();
  });

  it('shows "Session profit" as the description', () => {
    setupStore({
      getTotalProfit: vi.fn().mockReturnValue(5000),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("Session profit")).toBeInTheDocument();
  });

  it("applies text-success class to the value", () => {
    setupStore({
      getTotalProfit: vi.fn().mockReturnValue(5000),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-success"));
    expect(valueEl).toBeDefined();
  });

  it("handles zero profit", () => {
    setupStore({
      getTotalProfit: vi.fn().mockReturnValue(0),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("0.00c")).toBeInTheDocument();
  });
});
