import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { MostProfitableSessionHighlight } from "../../../Statistics.types";
import { StatsMostProfitableSession } from "./StatsMostProfitableSession";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("@tanstack/react-router", async () => {
  const { createNavigateOnlyMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createNavigateOnlyMock(mockNavigate);
});

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
  overrides: Partial<MostProfitableSessionHighlight> = {},
): MostProfitableSessionHighlight {
  return {
    sessionId: "session-1",
    date: "2024-06-15T10:30:00.000Z",
    profit: 1234,
    league: "Settlers",
    chaosPerDivine: 0,
    totalDecksOpened: 100,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatsMostProfitableSession", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Most Profitable Session" title', () => {
    renderWithProviders(<StatsMostProfitableSession data={null} />);

    expect(screen.getByText("Most Profitable Session")).toBeInTheDocument();
  });

  it("shows formatted profit with sign and 'c' suffix when data is provided", () => {
    const data = createData({ profit: 1234 });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.getByText("+1,234c")).toBeInTheDocument();
  });

  it("shows click hint when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.getByText("Click to view details")).toBeInTheDocument();
  });

  it("does not show click hint when data is null", () => {
    renderWithProviders(<StatsMostProfitableSession data={null} />);

    expect(screen.queryByText("Click to view details")).not.toBeInTheDocument();
  });

  it("renders click hint when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.getByText("Click to view details")).toBeInTheDocument();
  });

  it("does not show league badge (moved to Stacked Decks Opened card)", () => {
    const data = createData({ league: "Settlers" });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.queryByText("Settlers")).not.toBeInTheDocument();
  });

  it('shows "N/A" as value when data is null', () => {
    renderWithProviders(<StatsMostProfitableSession data={null} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it('shows "No sessions yet" in description when data is null', () => {
    renderWithProviders(<StatsMostProfitableSession data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("handles negative profit correctly", () => {
    const data = createData({ profit: -500 });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.getByText("-500c")).toBeInTheDocument();
  });

  it("handles zero profit correctly", () => {
    const data = createData({ profit: 0 });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.getByText("+0c")).toBeInTheDocument();
  });

  // ── Divine conversion ────────────────────────────────────────────────

  it("shows profit in divines when chaosPerDivine > 0", () => {
    const data = createData({
      profit: 153840,
      chaosPerDivine: 200,
    });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    // 153840 / 200 = 769.2
    expect(screen.getByText("+769.2div")).toBeInTheDocument();
  });

  it("shows negative divine profit correctly", () => {
    const data = createData({
      profit: -10000,
      chaosPerDivine: 250,
    });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    // -10000 / 250 = -40.0
    expect(screen.getByText("-40.0div")).toBeInTheDocument();
  });

  it("falls back to chaos format when chaosPerDivine is 0", () => {
    const data = createData({
      profit: 5000,
      chaosPerDivine: 0,
    });
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    expect(screen.getByText("+5,000c")).toBeInTheDocument();
  });

  // ── Clickable UX ─────────────────────────────────────────────────────

  it("has cursor-pointer class when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).toContain("cursor-pointer");
  });

  it("does not have cursor-pointer class when data is null", () => {
    renderWithProviders(<StatsMostProfitableSession data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).not.toContain("cursor-pointer");
  });

  // ── Navigation ───────────────────────────────────────────────────────

  it("navigates to session detail when clicked and data is provided", async () => {
    const data = createData();
    const { user } = renderWithProviders(
      <StatsMostProfitableSession data={data} />,
    );

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/sessions/$sessionId",
      params: { sessionId: "session-1" },
    });
  });

  it("does not navigate when clicked and data is null", async () => {
    const { user } = renderWithProviders(
      <StatsMostProfitableSession data={null} />,
    );

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('has role="link" when data is provided', () => {
    const data = createData();
    renderWithProviders(<StatsMostProfitableSession data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat).toHaveAttribute("role", "link");
  });

  it('does not have role="link" when data is null', () => {
    renderWithProviders(<StatsMostProfitableSession data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat).not.toHaveAttribute("role");
  });
});
