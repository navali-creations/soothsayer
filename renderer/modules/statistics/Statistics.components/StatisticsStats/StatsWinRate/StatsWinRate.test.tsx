import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { WinRateHighlight } from "../../../Statistics.types";
import { StatsWinRate } from "./StatsWinRate";

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

function createData(
  overrides: Partial<WinRateHighlight> = {},
): WinRateHighlight {
  return {
    winRate: 0.7,
    profitableSessions: 7,
    totalSessions: 10,
    ...overrides,
  };
}

describe("StatsWinRate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Win Rate" title', () => {
    renderWithProviders(<StatsWinRate data={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent("Win Rate");
  });

  it('shows "N/A" when data is null', () => {
    renderWithProviders(<StatsWinRate data={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "No sessions yet" when data is null', () => {
    renderWithProviders(<StatsWinRate data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("shows percentage when data is provided", () => {
    const data = createData({ winRate: 0.7 });
    renderWithProviders(<StatsWinRate data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("70%");
  });

  it('shows description "7 of 10 sessions profitable"', () => {
    const data = createData({
      winRate: 0.7,
      profitableSessions: 7,
      totalSessions: 10,
    });
    renderWithProviders(<StatsWinRate data={data} />);

    expect(screen.getByText("7 of 10 sessions profitable")).toBeInTheDocument();
  });

  it("handles 100% win rate", () => {
    const data = createData({
      winRate: 1.0,
      profitableSessions: 10,
      totalSessions: 10,
    });
    renderWithProviders(<StatsWinRate data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("100%");
  });

  it("handles 0% win rate", () => {
    const data = createData({
      winRate: 0,
      profitableSessions: 0,
      totalSessions: 10,
    });
    renderWithProviders(<StatsWinRate data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("0%");
  });

  it("rounds percentage correctly", () => {
    const data = createData({
      winRate: 0.667,
      profitableSessions: 2,
      totalSessions: 3,
    });
    renderWithProviders(<StatsWinRate data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("67%");
  });
});
