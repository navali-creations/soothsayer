import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { TotalTimeSpentHighlight } from "../../../Statistics.types";
import { StatsTotalTimeSpent } from "./StatsTotalTimeSpent";

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
  overrides: Partial<TotalTimeSpentHighlight> = {},
): TotalTimeSpentHighlight {
  return {
    totalMinutes: 120,
    ...overrides,
  };
}

describe("StatsTotalTimeSpent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Total Time Spent" title', () => {
    renderWithProviders(<StatsTotalTimeSpent data={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Total Time Spent",
    );
  });

  it('shows "N/A" when data is null', () => {
    renderWithProviders(<StatsTotalTimeSpent data={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "No sessions yet" when data is null', () => {
    renderWithProviders(<StatsTotalTimeSpent data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("shows minutes only for durations < 60", () => {
    const data = createData({ totalMinutes: 45 });

    renderWithProviders(<StatsTotalTimeSpent data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("45m");
  });

  it("shows hours and minutes for mixed durations", () => {
    const data = createData({ totalMinutes: 150 });

    renderWithProviders(<StatsTotalTimeSpent data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("2h 30m");
  });

  it("shows hours only for exact hour durations", () => {
    const data = createData({ totalMinutes: 120 });

    renderWithProviders(<StatsTotalTimeSpent data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("2h");
  });

  it("shows days and hours for >= 24h", () => {
    const data = createData({ totalMinutes: 1560 });

    renderWithProviders(<StatsTotalTimeSpent data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("1d 2h");
  });

  it("shows days only for exact days", () => {
    const data = createData({ totalMinutes: 1440 });

    renderWithProviders(<StatsTotalTimeSpent data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("1d");
  });

  it('shows "N/A" when totalMinutes is 0', () => {
    const data = createData({ totalMinutes: 0 });

    renderWithProviders(<StatsTotalTimeSpent data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });
});
