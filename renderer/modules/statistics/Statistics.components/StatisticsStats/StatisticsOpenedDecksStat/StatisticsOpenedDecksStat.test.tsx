import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { StatisticsOpenedDecksStat } from "./StatisticsOpenedDecksStat";

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

describe("StatisticsOpenedDecksStat", () => {
  it('renders "Stacked Decks Opened" title', () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={0} sessionCount={null} />,
    );

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Stacked Decks Opened",
    );
  });

  it("shows formatted total count", () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={1234} sessionCount={null} />,
    );

    const expectedCount = (1234).toLocaleString();
    expect(screen.getByTestId("stat-value")).toHaveTextContent(expectedCount);
  });

  it("handles zero totalCount", () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={0} sessionCount={null} />,
    );

    expect(screen.getByTestId("stat-value")).toHaveTextContent("0");
  });

  it("handles large numbers with locale formatting", () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={1000000} sessionCount={null} />,
    );

    const expectedCount = (1000000).toLocaleString();
    expect(screen.getByTestId("stat-value")).toHaveTextContent(expectedCount);
  });

  it('shows "Across X sessions" when sessionCount > 0', () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={100} sessionCount={5} />,
    );

    expect(screen.getByText(/Across 5 sessions/)).toBeInTheDocument();
  });

  it('does not show "Across" text when sessionCount is null', () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={100} sessionCount={null} />,
    );

    expect(screen.queryByText(/Across/)).not.toBeInTheDocument();
  });

  it('does not show "Across" text when sessionCount is 0', () => {
    renderWithProviders(
      <StatisticsOpenedDecksStat totalCount={100} sessionCount={0} />,
    );

    expect(screen.queryByText(/Across/)).not.toBeInTheDocument();
  });
});
