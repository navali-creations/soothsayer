import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { SessionAverages } from "../../../Statistics.types";
import { StatsAvgSessionDuration } from "./StatsAvgSessionDuration";

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

const makeAverages = (
  overrides: Partial<SessionAverages> = {},
): SessionAverages => ({
  avgProfit: 0,
  avgDecksOpened: 0,
  avgDurationMinutes: 0,
  avgChaosPerDivine: 0,
  sessionCount: 0,
  ...overrides,
});

describe("StatsAvgSessionDuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Avg. Session Duration" title', () => {
    renderWithProviders(<StatsAvgSessionDuration averages={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Avg. Session Duration",
    );
  });

  it('shows "N/A" when averages is null', () => {
    renderWithProviders(<StatsAvgSessionDuration averages={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "N/A" when avgDurationMinutes is 0', () => {
    const averages = makeAverages({ avgDurationMinutes: 0 });

    renderWithProviders(<StatsAvgSessionDuration averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it("shows minutes only for durations < 60", () => {
    const averages = makeAverages({ avgDurationMinutes: 30 });

    renderWithProviders(<StatsAvgSessionDuration averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("30m");
  });

  it("shows hours only for exact hour durations", () => {
    const averages = makeAverages({ avgDurationMinutes: 120 });

    renderWithProviders(<StatsAvgSessionDuration averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("2h");
  });

  it("shows hours and minutes for mixed durations", () => {
    const averages = makeAverages({ avgDurationMinutes: 90 });

    renderWithProviders(<StatsAvgSessionDuration averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("1h 30m");
  });

  it("rounds fractional minutes via Math.round", () => {
    const averages = makeAverages({ avgDurationMinutes: 45.7 });

    renderWithProviders(<StatsAvgSessionDuration averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("46m");
  });

  it("rounds fractional minutes to hours + remaining", () => {
    const averages = makeAverages({ avgDurationMinutes: 89.6 });

    renderWithProviders(<StatsAvgSessionDuration averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("1h 30m");
  });
});
