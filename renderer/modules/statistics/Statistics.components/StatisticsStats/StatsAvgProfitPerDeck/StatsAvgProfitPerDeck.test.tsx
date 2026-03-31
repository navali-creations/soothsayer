import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { AvgProfitPerDeckHighlight } from "../../../Statistics.types";
import { StatsAvgProfitPerDeck } from "./StatsAvgProfitPerDeck";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, ...props }: any) => (
        <div data-testid="stat-value" {...props}>
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
    },
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiInfo: (props: any) => <svg data-testid="icon-info" {...props} />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createData(
  overrides: Partial<AvgProfitPerDeckHighlight> = {},
): AvgProfitPerDeckHighlight {
  return {
    avgProfitPerDeck: 0,
    avgChaosPerDivine: 0,
    avgDeckCost: 0,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatsAvgProfitPerDeck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Avg. Profit Per Deck" title', () => {
    renderWithProviders(<StatsAvgProfitPerDeck data={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Avg. Profit Per Deck",
    );
  });

  it('shows "N/A" when data is null', () => {
    renderWithProviders(<StatsAvgProfitPerDeck data={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "No sessions yet" when data is null', () => {
    renderWithProviders(<StatsAvgProfitPerDeck data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("shows profit always in chaos", () => {
    const data = createData({
      avgProfitPerDeck: 5,
      avgChaosPerDivine: 200,
    });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+5.0c");
  });

  it("shows positive profit with + prefix", () => {
    const data = createData({ avgProfitPerDeck: 12.3 });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+12.3c");
  });

  it("shows negative profit without + prefix", () => {
    const data = createData({ avgProfitPerDeck: -3.2 });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("-3.2c");
  });

  it("handles zero profit", () => {
    const data = createData({ avgProfitPerDeck: 0 });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+0.0c");
  });

  it("renders info tooltip icon", () => {
    const data = createData({ avgProfitPerDeck: 5 });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("icon-info")).toBeInTheDocument();
  });

  // ── Deck cost display ────────────────────────────────────────────────

  it("shows deck cost with / Xc when avgDeckCost > 0", () => {
    const data = createData({
      avgProfitPerDeck: 5,
      avgDeckCost: 3,
    });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+5.0c/ 3.0c");
  });

  it("does not show deck cost when avgDeckCost is 0", () => {
    const data = createData({
      avgProfitPerDeck: 5,
      avgDeckCost: 0,
    });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+5.0c");
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it("does not show deck cost when data is null", () => {
    renderWithProviders(<StatsAvgProfitPerDeck data={null} />);

    expect(screen.queryByText(/\/.*c/)).not.toBeInTheDocument();
  });

  it("formats deck cost with one decimal place", () => {
    const data = createData({
      avgProfitPerDeck: 1.2,
      avgDeckCost: 2.567,
    });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+1.2c/ 2.6c");
  });

  it("renders deck cost in muted style", () => {
    const data = createData({
      avgProfitPerDeck: 5,
      avgDeckCost: 3,
    });

    renderWithProviders(<StatsAvgProfitPerDeck data={data} />);

    const costSpan = screen.getByText(/\/ 3\.0c/);
    expect(costSpan).toHaveClass("opacity-50");
    expect(costSpan).toHaveClass("text-sm");
  });
});
