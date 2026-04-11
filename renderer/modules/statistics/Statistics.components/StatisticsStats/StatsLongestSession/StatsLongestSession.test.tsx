import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { LongestSessionHighlight } from "../../../Statistics.types";
import { StatsLongestSession } from "./StatsLongestSession";

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
  overrides: Partial<LongestSessionHighlight> = {},
): LongestSessionHighlight {
  return {
    sessionId: "session-1",
    date: "2024-06-15T10:30:00.000Z",
    durationMinutes: 90,
    totalDecksOpened: 75,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatsLongestSession", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Longest Session" title', () => {
    renderWithProviders(<StatsLongestSession data={null} />);

    expect(screen.getByText("Longest Session")).toBeInTheDocument();
  });

  it('shows "1h 30m" when data is provided with 90 minutes', () => {
    const data = createData({ durationMinutes: 90 });
    renderWithProviders(<StatsLongestSession data={data} />);

    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  it('shows "45m" when duration is under 60 minutes', () => {
    const data = createData({ durationMinutes: 45 });
    renderWithProviders(<StatsLongestSession data={data} />);

    expect(screen.getByText("45m")).toBeInTheDocument();
  });

  it('shows "2h" when duration is exactly 120 minutes (no remaining minutes)', () => {
    const data = createData({ durationMinutes: 120 });
    renderWithProviders(<StatsLongestSession data={data} />);

    expect(screen.getByText("2h")).toBeInTheDocument();
  });

  it("shows click hint when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsLongestSession data={data} />);

    expect(screen.getByText("Click to view details")).toBeInTheDocument();
  });

  it("does not show click hint when data is null", () => {
    renderWithProviders(<StatsLongestSession data={null} />);

    expect(screen.queryByText("Click to view details")).not.toBeInTheDocument();
  });

  it('shows "N/A" as value when data is null', () => {
    renderWithProviders(<StatsLongestSession data={null} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it('shows "No sessions yet" when data is null', () => {
    renderWithProviders(<StatsLongestSession data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("has cursor-pointer class when data is provided", () => {
    const data = createData();
    renderWithProviders(<StatsLongestSession data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).toContain("cursor-pointer");
  });

  it("does not have cursor-pointer class when data is null", () => {
    renderWithProviders(<StatsLongestSession data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat.className).not.toContain("cursor-pointer");
  });

  it("navigates to session detail when clicked and data is provided", async () => {
    const data = createData();
    const { user } = renderWithProviders(<StatsLongestSession data={data} />);

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/sessions/$sessionId",
      params: { sessionId: "session-1" },
    });
  });

  it("does not navigate when clicked and data is null", async () => {
    const { user } = renderWithProviders(<StatsLongestSession data={null} />);

    await user.click(screen.getByTestId("stat"));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('has role="link" when data is provided', () => {
    const data = createData();
    renderWithProviders(<StatsLongestSession data={data} />);

    const stat = screen.getByTestId("stat");
    expect(stat).toHaveAttribute("role", "link");
  });

  it('does not have role="link" when data is null', () => {
    renderWithProviders(<StatsLongestSession data={null} />);

    const stat = screen.getByTestId("stat");
    expect(stat).not.toHaveAttribute("role");
  });
});
