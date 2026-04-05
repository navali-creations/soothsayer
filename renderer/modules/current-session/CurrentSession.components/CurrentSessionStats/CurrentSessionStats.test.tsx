import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import CurrentSessionStats from "./CurrentSessionStats";

vi.mock("~/renderer/components", () => ({
  GroupedStats: ({ children, ...props }: any) => (
    <div data-testid="grouped-stats" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("./", () => ({
  CurrentSessionMostValueableCardStat: () => (
    <div data-testid="most-valuable-stat" />
  ),
  CurrentSessionNetProfitStat: (props: any) => (
    <div
      data-testid="net-profit-stat"
      data-expanded={String(props.expanded ?? "")}
      data-has-timeline={String(props.hasTimeline ?? "")}
    />
  ),
  CurrentSessionOpenedDecksStat: () => <div data-testid="opened-decks-stat" />,
  CurrentSessionTotalValueStat: () => <div data-testid="total-value-stat" />,
  CurrentSessionUniqueCardsStat: () => <div data-testid="unique-cards-stat" />,
}));

describe("CurrentSessionStats", () => {
  it("renders GroupedStats wrapper", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("grouped-stats")).toBeInTheDocument();
  });

  it("renders the opened decks stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("opened-decks-stat")).toBeInTheDocument();
  });

  it("renders the unique cards stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("unique-cards-stat")).toBeInTheDocument();
  });

  it("renders the most valuable card stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("most-valuable-stat")).toBeInTheDocument();
  });

  it("renders the total value stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("total-value-stat")).toBeInTheDocument();
  });

  it("renders the net profit stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("net-profit-stat")).toBeInTheDocument();
  });

  it("passes expanded prop to NetProfitStat", () => {
    renderWithProviders(
      <CurrentSessionStats
        expanded={true}
        onToggleExpanded={vi.fn()}
        hasTimeline={true}
      />,
    );

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-expanded",
      "true",
    );
  });

  it("passes hasTimeline prop to NetProfitStat", () => {
    renderWithProviders(<CurrentSessionStats hasTimeline={true} />);

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-has-timeline",
      "true",
    );
  });

  it("defaults expanded and hasTimeline to undefined when not provided", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-expanded",
      "",
    );
    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-has-timeline",
      "",
    );
  });

  it("renders all 5 stat components inside GroupedStats", () => {
    renderWithProviders(<CurrentSessionStats />);

    const wrapper = screen.getByTestId("grouped-stats");

    expect(wrapper).toContainElement(screen.getByTestId("opened-decks-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("unique-cards-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("most-valuable-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("total-value-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("net-profit-stat"));
  });
});
