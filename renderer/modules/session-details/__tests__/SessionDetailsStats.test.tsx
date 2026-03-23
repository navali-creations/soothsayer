import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { SessionDetailsDurationStat } from "../SessionDetails.components/SessionDetailsStats/SessionDetailsDurationStat";
import { SessionDetailsMostCommonCardStat } from "../SessionDetails.components/SessionDetailsStats/SessionDetailsMostCommonCardStat";
import { SessionDetailsNetProfitStat } from "../SessionDetails.components/SessionDetailsStats/SessionDetailsNetProfitStat";
import { SessionDetailsOpenedDecksStat } from "../SessionDetails.components/SessionDetailsStats/SessionDetailsOpenedDecksStat";
import SessionDetailsStats from "../SessionDetails.components/SessionDetailsStats/SessionDetailsStats";
import { SessionDetailsTotalValueStat } from "../SessionDetails.components/SessionDetailsStats/SessionDetailsTotalValueStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock the barrel index that the *container* component imports from.
// This does NOT affect the direct file-level imports above, so the real
// sub-components are still available for individual unit tests.
vi.mock("../SessionDetails.components/SessionDetailsStats/", () => ({
  SessionDetailsDurationStat: (props: any) => (
    <div data-testid="duration-stat" data-duration={props.duration} />
  ),
  SessionDetailsOpenedDecksStat: (props: any) => (
    <div data-testid="opened-decks-stat" data-total-count={props.totalCount} />
  ),
  SessionDetailsMostCommonCardStat: (props: any) => (
    <div
      data-testid="most-common-card-stat"
      data-card={JSON.stringify(props.mostCommonCard)}
    />
  ),
  SessionDetailsTotalValueStat: (props: any) => (
    <div data-testid="total-value-stat" data-total-profit={props.totalProfit} />
  ),
  SessionDetailsNetProfitStat: (props: any) => (
    <div data-testid="net-profit-stat" data-net-profit={props.netProfit} />
  ),
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

// ─── Helpers ───────────────────────────────────────────────────────────────

const defaultContainerProps = {
  duration: "1h 30m",
  totalCount: 100,
  mostCommonCard: { name: "Rain of Chaos", count: 30, ratio: 30 },
  totalProfit: 5000,
  netProfit: 4500,
  totalDeckCost: 500,
  chaosToDivineRatio: 150,
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

  it("renders the most common card stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("most-common-card-stat")).toBeInTheDocument();
  });

  it("renders the total value stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("total-value-stat")).toBeInTheDocument();
  });

  it("renders the net profit stat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("net-profit-stat")).toBeInTheDocument();
  });

  it("renders all 5 stat components inside GroupedStats", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    const wrapper = screen.getByTestId("grouped-stats");

    expect(wrapper).toContainElement(screen.getByTestId("duration-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("opened-decks-stat"));
    expect(wrapper).toContainElement(
      screen.getByTestId("most-common-card-stat"),
    );
    expect(wrapper).toContainElement(screen.getByTestId("total-value-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("net-profit-stat"));
  });

  it("passes duration prop to DurationStat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("duration-stat")).toHaveAttribute(
      "data-duration",
      "1h 30m",
    );
  });

  it("passes totalCount prop to OpenedDecksStat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("opened-decks-stat")).toHaveAttribute(
      "data-total-count",
      "100",
    );
  });

  it("passes mostCommonCard prop to MostCommonCardStat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("most-common-card-stat")).toHaveAttribute(
      "data-card",
      JSON.stringify({ name: "Rain of Chaos", count: 30, ratio: 30 }),
    );
  });

  it("passes totalProfit prop to TotalValueStat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("total-value-stat")).toHaveAttribute(
      "data-total-profit",
      "5000",
    );
  });

  it("passes netProfit prop to NetProfitStat", () => {
    renderWithProviders(<SessionDetailsStats {...defaultContainerProps} />);

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-net-profit",
      "4500",
    );
  });
});

// ─── SessionDetailsDurationStat ────────────────────────────────────────────

describe("SessionDetailsDurationStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Duration" as the title', () => {
    renderWithProviders(<SessionDetailsDurationStat duration="2h 15m" />);

    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("displays the duration value", () => {
    renderWithProviders(<SessionDetailsDurationStat duration="2h 15m" />);

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
  });

  it('shows "Session length" as the description', () => {
    renderWithProviders(<SessionDetailsDurationStat duration="2h 15m" />);

    expect(screen.getByText("Session length")).toBeInTheDocument();
  });

  it("handles a minutes-only duration", () => {
    renderWithProviders(<SessionDetailsDurationStat duration="45m" />);

    expect(screen.getByText("45m")).toBeInTheDocument();
  });

  it('handles "—" dash duration', () => {
    renderWithProviders(<SessionDetailsDurationStat duration="—" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

// ─── SessionDetailsOpenedDecksStat ─────────────────────────────────────────

describe("SessionDetailsOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Stacked Decks Opened" as the title', () => {
    renderWithProviders(<SessionDetailsOpenedDecksStat totalCount={50} />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("displays the total count value", () => {
    renderWithProviders(<SessionDetailsOpenedDecksStat totalCount={50} />);

    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it('shows "Total decks" as the description', () => {
    renderWithProviders(<SessionDetailsOpenedDecksStat totalCount={50} />);

    expect(screen.getByText("Total decks")).toBeInTheDocument();
  });

  it("handles zero count", () => {
    renderWithProviders(<SessionDetailsOpenedDecksStat totalCount={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles large count", () => {
    renderWithProviders(<SessionDetailsOpenedDecksStat totalCount={9999} />);

    expect(screen.getByText("9999")).toBeInTheDocument();
  });
});

// ─── SessionDetailsMostCommonCardStat ──────────────────────────────────────

describe("SessionDetailsMostCommonCardStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Most Common Card" as the title', () => {
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={null} />,
    );

    expect(screen.getByText("Most Common Card")).toBeInTheDocument();
  });

  it('shows "—" when mostCommonCard is null', () => {
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={null} />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it('shows "No cards yet" description when mostCommonCard is null', () => {
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={null} />,
    );

    expect(screen.getByText("No cards yet")).toBeInTheDocument();
  });

  it("shows the card name when mostCommonCard is provided", () => {
    const card = { name: "Rain of Chaos", count: 30, ratio: 30.5 };
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={card} />,
    );

    expect(screen.getByText("Rain of Chaos")).toBeInTheDocument();
  });

  it("shows count and ratio in description when mostCommonCard is provided", () => {
    const card = { name: "Rain of Chaos", count: 30, ratio: 30.5 };
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={card} />,
    );

    expect(screen.getByText("30x (30.5%)")).toBeInTheDocument();
  });

  it("formats ratio to 1 decimal place", () => {
    const card = { name: "The Doctor", count: 2, ratio: 4.1666 };
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={card} />,
    );

    expect(screen.getByText("2x (4.2%)")).toBeInTheDocument();
  });

  it("handles zero ratio", () => {
    const card = { name: "The Nurse", count: 1, ratio: 0 };
    renderWithProviders(
      <SessionDetailsMostCommonCardStat mostCommonCard={card} />,
    );

    expect(screen.getByText("1x (0.0%)")).toBeInTheDocument();
  });
});

// ─── SessionDetailsTotalValueStat ──────────────────────────────────────────

describe("SessionDetailsTotalValueStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Total Value" as the title', () => {
    renderWithProviders(
      <SessionDetailsTotalValueStat
        totalProfit={5000}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("Total Value")).toBeInTheDocument();
  });

  it("displays formatted currency value in chaos for small amounts", () => {
    renderWithProviders(
      <SessionDetailsTotalValueStat
        totalProfit={100}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("100.00c")).toBeInTheDocument();
  });

  it("displays formatted currency value in divine for large amounts", () => {
    renderWithProviders(
      <SessionDetailsTotalValueStat
        totalProfit={300}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("2.00d")).toBeInTheDocument();
  });

  it('shows "Session profit" as the description', () => {
    renderWithProviders(
      <SessionDetailsTotalValueStat
        totalProfit={5000}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("Session profit")).toBeInTheDocument();
  });

  it("applies text-success class to the value", () => {
    renderWithProviders(
      <SessionDetailsTotalValueStat
        totalProfit={5000}
        chaosToDivineRatio={150}
      />,
    );

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-success"));
    expect(valueEl).toBeDefined();
  });

  it("handles zero profit", () => {
    renderWithProviders(
      <SessionDetailsTotalValueStat totalProfit={0} chaosToDivineRatio={150} />,
    );

    expect(screen.getByText("0.00c")).toBeInTheDocument();
  });
});

// ─── SessionDetailsNetProfitStat ───────────────────────────────────────────

describe("SessionDetailsNetProfitStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Net Profit" as the title', () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={100}
        totalDeckCost={50}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
  });

  it("applies text-success class when netProfit is positive", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={500}
        totalDeckCost={100}
        chaosToDivineRatio={150}
      />,
    );

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-success"));
    expect(valueEl).toBeDefined();
    expect(valueEl!.className).not.toContain("text-error");
  });

  it("applies text-error class when netProfit is negative", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={-200}
        totalDeckCost={300}
        chaosToDivineRatio={150}
      />,
    );

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-error"));
    expect(valueEl).toBeDefined();
    expect(valueEl!.className).not.toContain("text-success");
  });

  it("applies text-success class when netProfit is zero", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={0}
        totalDeckCost={100}
        chaosToDivineRatio={150}
      />,
    );

    const values = screen.getAllByTestId("stat-value");
    const valueEl = values.find((el) => el.className.includes("text-success"));
    expect(valueEl).toBeDefined();
  });

  it("shows deck cost in description when totalDeckCost > 0", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={400}
        totalDeckCost={100}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("After 100c deck cost")).toBeInTheDocument();
  });

  it("floors the deck cost in description", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={400}
        totalDeckCost={123.7}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("After 123c deck cost")).toBeInTheDocument();
  });

  it('shows "No deck cost data" when totalDeckCost is 0', () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={500}
        totalDeckCost={0}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("No deck cost data")).toBeInTheDocument();
  });

  it("displays formatted currency value for positive net profit in chaos", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={100}
        totalDeckCost={50}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("100.00c")).toBeInTheDocument();
  });

  it("displays formatted currency value for positive net profit in divine", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={300}
        totalDeckCost={50}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("2.00d")).toBeInTheDocument();
  });

  it("displays formatted currency value for negative net profit", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={-50}
        totalDeckCost={100}
        chaosToDivineRatio={150}
      />,
    );

    expect(screen.getByText("-50.00c")).toBeInTheDocument();
  });

  it("has a tooltip title explaining net profit", () => {
    renderWithProviders(
      <SessionDetailsNetProfitStat
        netProfit={100}
        totalDeckCost={50}
        chaosToDivineRatio={150}
      />,
    );

    const titleSpan = screen.getByText("Net Profit");
    expect(titleSpan).toHaveAttribute("title");
    expect(titleSpan.getAttribute("title")).toContain("Stacked Decks");
  });
});
