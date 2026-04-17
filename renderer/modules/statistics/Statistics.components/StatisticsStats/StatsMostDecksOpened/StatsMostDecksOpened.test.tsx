import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { MostDecksOpenedHighlight } from "../../../Statistics.types";
import { StatsMostDecksOpened } from "./StatsMostDecksOpened";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

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
  overrides: Partial<MostDecksOpenedHighlight> = {},
): MostDecksOpenedHighlight {
  return {
    sessionId: "session-1",
    date: "2024-06-15T10:30:00.000Z",
    totalDecksOpened: 500,
    durationMinutes: 45,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatsMostDecksOpened", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Most Decks Opened" title', () => {
    renderWithProviders(<StatsMostDecksOpened data={null} />);

    expect(screen.getByText("Most Decks Opened")).toBeInTheDocument();
  });

  it("shows formatted count when data is provided", () => {
    const data = createData({ totalDecksOpened: 1500 });
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    const expectedCount = (1500).toLocaleString();
    expect(screen.getByText(expectedCount)).toBeInTheDocument();
  });

  it("shows click hint when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    expect(screen.getByText("Click to view details")).toBeInTheDocument();
  });

  it("does not show click hint when data is null", () => {
    renderWithProviders(<StatsMostDecksOpened data={null} />);

    expect(screen.queryByText("Click to view details")).not.toBeInTheDocument();
  });

  it('shows "N/A" as value when data is null', () => {
    renderWithProviders(<StatsMostDecksOpened data={null} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it('shows "No sessions yet" when data is null', () => {
    renderWithProviders(<StatsMostDecksOpened data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  // ── Clickable UX ─────────────────────────────────────────────────────

  it("has cursor-pointer class when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).toContain("cursor-pointer");
  });

  it("does not have cursor-pointer class when data is null", () => {
    renderWithProviders(<StatsMostDecksOpened data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).not.toContain("cursor-pointer");
  });

  it("navigates to session detail when clicked and data is provided", async () => {
    const data = createData({ sessionId: "session-1" });
    const { user } = renderWithProviders(<StatsMostDecksOpened data={data} />);

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/sessions/$sessionId",
      params: { sessionId: "session-1" },
    });
  });

  it("does not navigate when clicked and data is null", async () => {
    const { user } = renderWithProviders(<StatsMostDecksOpened data={null} />);

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── Accessibility ────────────────────────────────────────────────────

  it('has role="link" when data is provided', () => {
    const data = createData();
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat).toHaveAttribute("role", "link");
  });

  it('does not have role="link" when data is null', () => {
    renderWithProviders(<StatsMostDecksOpened data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat).not.toHaveAttribute("role");
  });

  // ── Duration formatting ──────────────────────────────────────────────

  it("formats duration as hours and minutes when ≥ 60 minutes", () => {
    const data = createData({ durationMinutes: 90 });
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    expect(screen.getByText("1h 30m session")).toBeInTheDocument();
  });

  it("formats duration as hours only when minutes are exactly divisible by 60", () => {
    const data = createData({ durationMinutes: 120 });
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    expect(screen.getByText("2h session")).toBeInTheDocument();
  });

  it("formats duration as minutes only when < 60", () => {
    const data = createData({ durationMinutes: 45 });
    renderWithProviders(<StatsMostDecksOpened data={data} />);

    expect(screen.getByText("45m session")).toBeInTheDocument();
  });
});
