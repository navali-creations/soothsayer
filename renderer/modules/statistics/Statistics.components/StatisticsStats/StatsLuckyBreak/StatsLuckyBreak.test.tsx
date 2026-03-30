import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { LuckyBreakHighlight } from "../../../Statistics.types";
import { StatsLuckyBreak } from "./StatsLuckyBreak";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

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
  overrides: Partial<LuckyBreakHighlight> = {},
): LuckyBreakHighlight {
  return {
    sessionId: "session-bb-1",
    date: "2024-08-10T14:00:00.000Z",
    totalDecksOpened: 50,
    profit: 800,
    league: "Settlers",
    chaosPerDivine: 200,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatsLuckyBreak", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Title ────────────────────────────────────────────────────────────

  it('renders "Lucky Break" title', () => {
    renderWithProviders(<StatsLuckyBreak data={null} />);

    expect(screen.getByText("Lucky Break")).toBeInTheDocument();
  });

  // ── Value display ────────────────────────────────────────────────────

  it("shows formatted profit in divines when chaosPerDivine > 0", () => {
    const data = createData({ profit: 800, chaosPerDivine: 200 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    // 800 / 200 = 4.0
    expect(screen.getByText("+4.0div")).toBeInTheDocument();
  });

  it("shows formatted profit in chaos when chaosPerDivine is 0", () => {
    const data = createData({ profit: 500, chaosPerDivine: 0 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("+500c")).toBeInTheDocument();
  });

  it("shows positive profit with + prefix in divines", () => {
    const data = createData({ profit: 100, chaosPerDivine: 200 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    // 100 / 200 = 0.5
    expect(screen.getByText("+0.5div")).toBeInTheDocument();
  });

  it("shows positive profit with + prefix in chaos", () => {
    const data = createData({ profit: 50, chaosPerDivine: 0 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("+50c")).toBeInTheDocument();
  });

  it("shows negative profit with - prefix in divines", () => {
    const data = createData({ profit: -320, chaosPerDivine: 200 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    // -320 / 200 = -1.6
    expect(screen.getByText("-1.6div")).toBeInTheDocument();
  });

  it("handles zero profit correctly", () => {
    const data = createData({ profit: 0, chaosPerDivine: 0 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("+0c")).toBeInTheDocument();
  });

  it("formats large negative chaos profit with locale separators", () => {
    const data = createData({ profit: -12345, chaosPerDivine: 0 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("-12,345c")).toBeInTheDocument();
  });

  it('shows "N/A" as value when data is null', () => {
    renderWithProviders(<StatsLuckyBreak data={null} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  // ── Description ──────────────────────────────────────────────────────

  it("shows deck count in description when data is provided", () => {
    const data = createData({ totalDecksOpened: 50 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("50 decks opened")).toBeInTheDocument();
  });

  it("formats large deck counts with locale separators", () => {
    const data = createData({ totalDecksOpened: 2500 });
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("2,500 decks opened")).toBeInTheDocument();
  });

  it('shows "No sessions yet" in description when data is null', () => {
    renderWithProviders(<StatsLuckyBreak data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  // ── Click hint ───────────────────────────────────────────────────────

  it("shows click hint when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("Click to view details")).toBeInTheDocument();
  });

  it("does not show click hint when data is null", () => {
    renderWithProviders(<StatsLuckyBreak data={null} />);

    expect(screen.queryByText("Click to view details")).not.toBeInTheDocument();
  });

  it("renders click hint when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsLuckyBreak data={data} />);

    expect(screen.getByText("Click to view details")).toBeInTheDocument();
  });

  // ── Clickable UX ─────────────────────────────────────────────────────

  it("has cursor-pointer class when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsLuckyBreak data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).toContain("cursor-pointer");
  });

  it("does not have cursor-pointer class when data is null", () => {
    renderWithProviders(<StatsLuckyBreak data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).not.toContain("cursor-pointer");
  });

  // ── Navigation ───────────────────────────────────────────────────────

  it("navigates to session detail when clicked and data is provided", async () => {
    const data = createData();
    const { user } = renderWithProviders(<StatsLuckyBreak data={data} />);

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/sessions/$sessionId",
      params: { sessionId: "session-bb-1" },
    });
  });

  it("does not navigate when clicked and data is null", async () => {
    const { user } = renderWithProviders(<StatsLuckyBreak data={null} />);

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('has role="link" when data is provided', () => {
    const data = createData();
    renderWithProviders(<StatsLuckyBreak data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat).toHaveAttribute("role", "link");
  });

  it('does not have role="link" when data is null', () => {
    renderWithProviders(<StatsLuckyBreak data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat).not.toHaveAttribute("role");
  });
});
