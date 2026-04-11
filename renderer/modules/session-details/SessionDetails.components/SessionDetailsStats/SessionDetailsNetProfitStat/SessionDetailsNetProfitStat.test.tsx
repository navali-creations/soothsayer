import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionDetailsNetProfitStat } from "./SessionDetailsNetProfitStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("react-icons/fi", () => ({
  FiInfo: (props: any) => <span data-testid="icon-info" {...props} />,
  FiMaximize2: (props: any) => <span data-testid="icon-maximize" {...props} />,
  FiMinimize2: (props: any) => <span data-testid="icon-minimize" {...props} />,
}));

vi.mock("~/renderer/components", () => ({
  Stat: Object.assign(
    ({ children, className, ...props }: any) => (
      <div data-testid="stat" className={className} {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, className, ...props }: any) => (
        <div data-testid="stat-value" className={className} {...props}>
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
      Actions: ({ children, ...props }: any) => (
        <div data-testid="stat-actions" {...props}>
          {children}
        </div>
      ),
    },
  ),
  StaticProfitSparkline: (_props: any) => <div data-testid="sparkline" />,
}));

vi.mock("~/renderer/utils", () => ({
  formatCurrency: vi.fn((chaosValue: number, chaosToDivineRatio: number) => {
    if (Math.abs(chaosValue) >= chaosToDivineRatio && chaosToDivineRatio > 0) {
      const divineValue = chaosValue / chaosToDivineRatio;
      return `${divineValue.toFixed(2)}d`;
    }
    return `${chaosValue.toFixed(2)}c`;
  }),
}));

vi.mock(
  "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/utils/utils",
  () => ({
    buildLinePoints: vi.fn().mockReturnValue(undefined),
  }),
);

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStore(overrides: Record<string, any> = {}) {
  const sessionDetails = {
    getDuration: vi.fn().mockReturnValue("1h 30m"),
    getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
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
  mockUseBoundStore.mockReturnValue({ sessionDetails } as any);
  return sessionDetails;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 100, totalDeckCost: 50 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
  });

  it('shows "Net Profit" as the title', () => {
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
  });

  it("applies text-success class when netProfit is positive", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 500, totalDeckCost: 100 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-success"));
    expect(valueEl).toBeDefined();
    expect(valueEl!.className).not.toContain("text-error");
  });

  it("applies text-error class when netProfit is negative", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: -200, totalDeckCost: 300 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-error"));
    expect(valueEl).toBeDefined();
    expect(valueEl!.className).not.toContain("text-success");
  });

  it("applies text-success class when netProfit is zero", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 0, totalDeckCost: 100 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-success"));
    expect(valueEl).toBeDefined();
  });

  it("shows deck cost in description when totalDeckCost > 0", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 400, totalDeckCost: 100 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("After 100c deck cost")).toBeInTheDocument();
  });

  it("floors the deck cost in description", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 400, totalDeckCost: 123.7 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("After 123c deck cost")).toBeInTheDocument();
  });

  it('shows "No deck cost data" when totalDeckCost is 0', () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 500, totalDeckCost: 0 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("No deck cost data")).toBeInTheDocument();
  });

  it("displays formatted currency value for positive net profit in chaos", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 100, totalDeckCost: 50 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("100.00c")).toBeInTheDocument();
  });

  it("displays formatted currency value for positive net profit in divine", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 300, totalDeckCost: 50 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("2.00d")).toBeInTheDocument();
  });

  it("displays formatted currency value for negative net profit", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: -50, totalDeckCost: 100 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    expect(screen.getByText("-50.00c")).toBeInTheDocument();
  });

  it("has a tooltip title explaining net profit", () => {
    renderWithProviders(<SessionDetailsNetProfitStat />);

    const titleSpan = screen.getByText("Net Profit");
    expect(titleSpan).toHaveAttribute("title");
    expect(titleSpan.getAttribute("title")).toContain("Stacked Decks");
  });

  it("renders info icon button", () => {
    renderWithProviders(<SessionDetailsNetProfitStat />);

    const tooltipDiv = document.querySelector('[data-tip*="sparkline"]');
    expect(tooltipDiv).not.toBeNull();
  });

  it("does not render expand button when hasTimeline is false", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 100, totalDeckCost: 50 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(false),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(<SessionDetailsNetProfitStat />);

    const expandTooltip = document.querySelector(
      '[data-tip*="Expand timeline"]',
    );
    expect(expandTooltip).toBeNull();
  });

  it("renders expand button when hasTimeline is true and onToggleExpanded is provided", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 100, totalDeckCost: 50 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(true),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(
      <SessionDetailsNetProfitStat onToggleExpanded={vi.fn()} />,
    );

    const expandTooltip = document.querySelector(
      '[data-tip*="Expand timeline"]',
    );
    expect(expandTooltip).not.toBeNull();
  });

  it("renders collapse tooltip when expanded is true", () => {
    setupStore({
      getNetProfit: vi
        .fn()
        .mockReturnValue({ netProfit: 100, totalDeckCost: 50 }),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
      getHasTimeline: vi.fn().mockReturnValue(true),
      getTimeline: vi.fn().mockReturnValue(null),
      getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    });
    renderWithProviders(
      <SessionDetailsNetProfitStat
        onToggleExpanded={vi.fn()}
        expanded={true}
      />,
    );

    const collapseTooltip = document.querySelector(
      '[data-tip*="Collapse timeline"]',
    );
    expect(collapseTooltip).not.toBeNull();
  });
});
