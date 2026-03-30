import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { SessionAverages } from "../../../Statistics.types";
import { StatsAvgDecksPerSession } from "./StatsAvgDecksPerSession";

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

describe("StatsAvgDecksPerSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Avg. Decks Per Session" title', () => {
    renderWithProviders(<StatsAvgDecksPerSession averages={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Avg. Decks Per Session",
    );
  });

  it("shows formatted average when averages has avgDecksOpened > 0", () => {
    const averages = makeAverages({ avgDecksOpened: 42 });

    renderWithProviders(<StatsAvgDecksPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("42");
  });

  it('shows "N/A" when averages is null', () => {
    renderWithProviders(<StatsAvgDecksPerSession averages={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "N/A" when avgDecksOpened is 0', () => {
    const averages = makeAverages({ avgDecksOpened: 0 });

    renderWithProviders(<StatsAvgDecksPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it("rounds the value (e.g. 123.7 → 124)", () => {
    const averages = makeAverages({ avgDecksOpened: 123.7 });

    renderWithProviders(<StatsAvgDecksPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("124");
  });

  it('formats large numbers with locale separators (e.g. 1234 → "1,234")', () => {
    const averages = makeAverages({ avgDecksOpened: 1234 });

    renderWithProviders(<StatsAvgDecksPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("1,234");
  });
});
