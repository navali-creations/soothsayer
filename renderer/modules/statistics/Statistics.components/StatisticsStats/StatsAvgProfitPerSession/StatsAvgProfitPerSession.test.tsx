import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { SessionAverages } from "../../../Statistics.types";
import { StatsAvgProfitPerSession } from "./StatsAvgProfitPerSession";

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

describe("StatsAvgProfitPerSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Avg. Profit Per Session" title', () => {
    renderWithProviders(<StatsAvgProfitPerSession averages={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Avg. Profit Per Session",
    );
  });

  it('shows "N/A" when averages is null', () => {
    renderWithProviders(<StatsAvgProfitPerSession averages={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "N/A" when avgProfit is 0', () => {
    const averages = makeAverages({ avgProfit: 0 });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it("shows formatted profit in divines when avgChaosPerDivine > 0", () => {
    const averages = makeAverages({
      avgProfit: 500,
      avgChaosPerDivine: 200,
    });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+2.5div");
  });

  it("shows formatted profit in chaos when avgChaosPerDivine is 0", () => {
    const averages = makeAverages({
      avgProfit: 500,
      avgChaosPerDivine: 0,
    });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+500c");
  });

  it("shows positive profit with + prefix in divines", () => {
    const averages = makeAverages({
      avgProfit: 300,
      avgChaosPerDivine: 100,
    });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+3.0div");
  });

  it("shows negative profit without + prefix in divines", () => {
    const averages = makeAverages({
      avgProfit: -300,
      avgChaosPerDivine: 200,
    });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("-1.5div");
  });

  it("shows negative profit in chaos", () => {
    const averages = makeAverages({
      avgProfit: -500,
      avgChaosPerDivine: 0,
    });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("-500c");
  });

  it("formats large chaos values with locale separators", () => {
    const averages = makeAverages({
      avgProfit: -12345,
      avgChaosPerDivine: 0,
    });

    renderWithProviders(<StatsAvgProfitPerSession averages={averages} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("-12,345c");
  });
});
