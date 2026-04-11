import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionDetailsDurationStat } from "./SessionDetailsDurationStat/SessionDetailsDurationStat";
import { SessionDetailsNetProfitStat } from "./SessionDetailsNetProfitStat/SessionDetailsNetProfitStat";
import { SessionDetailsOpenedDecksStat } from "./SessionDetailsOpenedDecksStat/SessionDetailsOpenedDecksStat";
import SessionDetailsStats from "./SessionDetailsStats";
import { SessionDetailsTotalValueStat } from "./SessionDetailsTotalValueStat/SessionDetailsTotalValueStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

// Mock the barrel index that the *container* component imports from.
// This does NOT affect the direct file-level imports above, so the real
// sub-components are still available for individual unit tests.
vi.mock("./", () => ({
  SessionDetailsDurationStat: (_props: any) => (
    <div data-testid="duration-stat" />
  ),
  SessionDetailsOpenedDecksStat: (_props: any) => (
    <div data-testid="opened-decks-stat" />
  ),
  SessionDetailsTotalValueStat: (_props: any) => (
    <div data-testid="total-value-stat" />
  ),
  SessionDetailsNetProfitStat: (props: any) => (
    <div
      data-testid="net-profit-stat"
      data-expanded={String(props.expanded ?? "")}
      data-on-toggle={props.onToggleExpanded ? "true" : ""}
    />
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiInfo: (props: any) => <span data-testid="icon-info" {...props} />,
  FiMaximize2: (props: any) => <span data-testid="icon-maximize" {...props} />,
  FiMinimize2: (props: any) => <span data-testid="icon-minimize" {...props} />,
}));

vi.mock("~/renderer/components", () => ({
  GroupedStats: ({ children, ...props }: any) => (
    <div data-testid="grouped-stats" {...props}>
      {children}
    </div>
  ),
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

function createMockSessionDetails(overrides: Record<string, any> = {}) {
  return {
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
}

function setupMockStore(overrides: Record<string, any> = {}) {
  const sessionDetails = createMockSessionDetails(overrides);
  mockUseBoundStore.mockReturnValue({ sessionDetails } as any);
  return sessionDetails;
}

const defaultContainerProps = {
  expanded: false,
  onToggleExpanded: vi.fn(),
};

// ─── SessionDetailsStats (Container) ───────────────────────────────────────

describe("SessionDetailsStats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders GroupedStats wrapper", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("grouped-stats")).toBeInTheDocument();
  });

  it("renders the duration stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("duration-stat")).toBeInTheDocument();
  });

  it("renders the opened decks stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("opened-decks-stat")).toBeInTheDocument();
  });

  it("renders the total value stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("total-value-stat")).toBeInTheDocument();
  });

  it("renders the net profit stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("net-profit-stat")).toBeInTheDocument();
  });

  it("renders all 4 stat components inside GroupedStats", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    const wrapper = screen.getByTestId("grouped-stats");

    expect(wrapper).toContainElement(screen.getByTestId("duration-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("opened-decks-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("total-value-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("net-profit-stat"));
  });

  it("passes expanded prop to NetProfitStat", () => {
    renderWithProviders(
      <SessionDetailsStats expanded={true} onToggleExpanded={vi.fn()} />,
    );

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-expanded",
      "true",
    );
  });

  it("defaults expanded to undefined when not provided", () => {
    renderWithProviders(<SessionDetailsStats />);

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-expanded",
      "",
    );
  });
});

// ─── SessionDetailsDurationStat ────────────────────────────────────────────

describe("SessionDetailsDurationStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupMockStore();
  });

  it('shows "Duration" as the title', () => {
    setupMockStore({ getDuration: vi.fn().mockReturnValue("2h 15m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("displays the duration value", () => {
    setupMockStore({ getDuration: vi.fn().mockReturnValue("2h 15m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
  });

  it('shows "Session length" as the description', () => {
    setupMockStore({ getDuration: vi.fn().mockReturnValue("2h 15m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("Session length")).toBeInTheDocument();
  });

  it("handles a minutes-only duration", () => {
    setupMockStore({ getDuration: vi.fn().mockReturnValue("45m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("45m")).toBeInTheDocument();
  });

  it('handles "—" dash duration', () => {
    setupMockStore({ getDuration: vi.fn().mockReturnValue("—") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

// ─── SessionDetailsOpenedDecksStat ─────────────────────────────────────────

describe("SessionDetailsOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupMockStore();
  });

  it('shows "Stacked Decks Opened" as the title', () => {
    setupMockStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 50 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("displays the total count value", () => {
    setupMockStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 50 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it('shows "Total decks" as the description', () => {
    setupMockStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 50 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("Total decks")).toBeInTheDocument();
  });

  it("handles zero count", () => {
    setupMockStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 0 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles large count", () => {
    setupMockStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 9999 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("9999")).toBeInTheDocument();
  });
});

// ─── SessionDetailsTotalValueStat ──────────────────────────────────────────

describe("SessionDetailsTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupMockStore();
  });

  it('shows "Total Value" as the title', () => {
    setupMockStore({
      getTotalProfit: vi.fn().mockReturnValue(5000),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("Total Value")).toBeInTheDocument();
  });

  it("displays formatted currency value in chaos for small amounts", () => {
    setupMockStore({
      getTotalProfit: vi.fn().mockReturnValue(100),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("100.00c")).toBeInTheDocument();
  });

  it("displays formatted currency value in divine for large amounts", () => {
    setupMockStore({
      getTotalProfit: vi.fn().mockReturnValue(300),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("2.00d")).toBeInTheDocument();
  });

  it('shows "Session profit" as the description', () => {
    setupMockStore({
      getTotalProfit: vi.fn().mockReturnValue(5000),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("Session profit")).toBeInTheDocument();
  });

  it("applies text-success class to the value", () => {
    setupMockStore({
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
    setupMockStore({
      getTotalProfit: vi.fn().mockReturnValue(0),
      getPriceData: vi
        .fn()
        .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    });
    renderWithProviders(<SessionDetailsTotalValueStat />);

    expect(screen.getByText("0.00c")).toBeInTheDocument();
  });
});

// ─── SessionDetailsNetProfitStat ───────────────────────────────────────────

describe("SessionDetailsNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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

    // The FiInfo mock renders an element — look for the tooltip data-tip
    const tooltipDiv = document.querySelector('[data-tip*="sparkline"]');
    expect(tooltipDiv).not.toBeNull();
  });

  it("does not render expand button when hasTimeline is false", () => {
    setupMockStore({
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
    setupMockStore({
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
    setupMockStore({
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
