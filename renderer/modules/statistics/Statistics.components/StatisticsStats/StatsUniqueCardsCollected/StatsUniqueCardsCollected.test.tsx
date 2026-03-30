import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { StatsUniqueCardsCollected } from "./StatsUniqueCardsCollected";

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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatsUniqueCardsCollected", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Unique Cards Collected" title', () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={100} totalAvailable={null} />,
    );

    expect(screen.getByText("Unique Cards Collected")).toBeInTheDocument();
  });

  it("shows collected count and muted total when totalAvailable is provided", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={375} totalAvailable={388} />,
    );

    expect(screen.getByText("375")).toBeInTheDocument();
    expect(screen.getByText("/ 388")).toBeInTheDocument();
  });

  it("shows progress bar and percentage when totalAvailable is provided", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={375} totalAvailable={388} />,
    );

    const expectedPercentage = Math.round((375 / 388) * 100);
    expect(screen.getByText(`${expectedPercentage}%`)).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("value", String(expectedPercentage));
    expect(progressBar).toHaveAttribute("max", "100");
  });

  it("shows just the count number when totalAvailable is null", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={250} totalAvailable={null} />,
    );

    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it('shows "Different cards found" description when totalAvailable is null', () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={250} totalAvailable={null} />,
    );

    expect(screen.getByText("Different cards found")).toBeInTheDocument();
  });

  it("shows just the count number when totalAvailable is 0 (edge case)", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={250} totalAvailable={0} />,
    );

    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("Different cards found")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("handles 100% collection correctly", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={388} totalAvailable={388} />,
    );

    expect(screen.getByText("388")).toBeInTheDocument();
    expect(screen.getByText("/ 388")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("value", "100");
    expect(progressBar).toHaveAttribute("max", "100");
  });

  it("shows 0% when collectedCount is 0 and totalAvailable is provided", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={0} totalAvailable={388} />,
    );

    expect(screen.getByText("0%")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("value", "0");
    expect(progressBar).toHaveAttribute("max", "100");
  });

  it("handles collectedCount greater than totalAvailable (edge case)", () => {
    renderWithProviders(
      <StatsUniqueCardsCollected collectedCount={400} totalAvailable={388} />,
    );

    const expectedPercentage = Math.round((400 / 388) * 100);
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.getByText("/ 388")).toBeInTheDocument();
    expect(screen.getByText(`${expectedPercentage}%`)).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("value", String(expectedPercentage));
    expect(progressBar).toHaveAttribute("max", "100");
  });
});
