import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components/Button/Button", () => ({
  default: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiChevronLeft: (props: any) => <span data-testid="chevron-left" {...props} />,
  FiChevronRight: (props: any) => (
    <span data-testid="chevron-right" {...props} />
  ),
  FiChevronUp: (props: any) => <span data-testid="chevron-up" {...props} />,
  FiChevronDown: (props: any) => <span data-testid="chevron-down" {...props} />,
  FiExternalLink: (props: any) => (
    <span data-testid="external-link" {...props} />
  ),
}));

vi.mock("./helpers", () => ({
  formatDate: (date: string) => `formatted-${date}`,
  formatDuration: (min: number) => `${min}m`,
}));

vi.mock("./SortIndicator", () => ({
  default: ({ column, sortState }: any) => (
    <span
      data-testid={`sort-${column}`}
      data-active={sortState.column === column ? "true" : "false"}
    />
  ),
}));

// ─── Component imports (after mocks) ───────────────────────────────────────

import SessionListEmpty from "./SessionListEmpty";
import SessionListError from "./SessionListError";
import SessionListPagination from "./SessionListPagination";
import SessionListTable from "./SessionListTable";

// We need the real SortIndicator for SortIndicator tests, so import it
// directly from the file (bypassing the module mock).
// We achieve this by using vi.importActual in the describe block.

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Test helpers ──────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, any> = {}) {
  return {
    sessionId: "session-1",
    game: "poe2",
    league: "Standard",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:30:00Z",
    durationMinutes: 90,
    totalDecksOpened: 150,
    totalExchangeValue: 500,
    totalStashValue: 200,
    totalExchangeNetProfit: 100,
    totalStashNetProfit: 50,
    exchangeChaosToDivine: 200,
    stashChaosToDivine: 200,
    stackedDeckChaosCost: 5,
    isActive: false,
    cardCount: 3,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SessionListEmpty
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListEmpty", () => {
  it('renders "Sessions with this Card" heading', () => {
    renderWithProviders(<SessionListEmpty />);
    expect(screen.getByText("Sessions with this Card")).toBeInTheDocument();
  });

  it("renders the empty message text", () => {
    renderWithProviders(<SessionListEmpty />);
    expect(
      screen.getByText(
        "This card hasn't appeared in any of your sessions yet.",
      ),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SessionListError
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListError", () => {
  it('renders "Sessions with this Card" heading', () => {
    renderWithProviders(
      <SessionListError error="Failed to load session data" />,
    );
    expect(screen.getByText("Sessions with this Card")).toBeInTheDocument();
  });

  it("renders the provided error message", () => {
    renderWithProviders(
      <SessionListError error="Failed to load session data" />,
    );
    expect(screen.getByText("Failed to load session data")).toBeInTheDocument();
  });

  it("renders the error message with text-error class", () => {
    const { container } = renderWithProviders(
      <SessionListError error="Something broke" />,
    );
    const errorElement = container.querySelector(".text-error");
    expect(errorElement).toBeInTheDocument();
    expect(errorElement!.textContent).toBe("Something broke");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SessionListPagination
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListPagination", () => {
  it("returns null when totalPages is 0", () => {
    const { container } = renderWithProviders(
      <SessionListPagination
        page={1}
        totalPages={0}
        isLoading={false}
        onPageChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalPages is 1", () => {
    const { container } = renderWithProviders(
      <SessionListPagination
        page={1}
        totalPages={1}
        isLoading={false}
        onPageChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it('shows "Page X of Y" text', () => {
    renderWithProviders(
      <SessionListPagination
        page={3}
        totalPages={7}
        isLoading={false}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Page 3 of 7")).toBeInTheDocument();
  });

  it("disables the Previous button on page 1", () => {
    renderWithProviders(
      <SessionListPagination
        page={1}
        totalPages={5}
        isLoading={false}
        onPageChange={vi.fn()}
      />,
    );
    const prevButton = screen.getByRole("button", { name: /previous page/i });
    expect(prevButton).toBeDisabled();
  });

  it("disables the Next button on the last page", () => {
    renderWithProviders(
      <SessionListPagination
        page={5}
        totalPages={5}
        isLoading={false}
        onPageChange={vi.fn()}
      />,
    );
    const nextButton = screen.getByRole("button", { name: /next page/i });
    expect(nextButton).toBeDisabled();
  });

  it("disables both buttons when isLoading is true", () => {
    renderWithProviders(
      <SessionListPagination
        page={3}
        totalPages={5}
        isLoading={true}
        onPageChange={vi.fn()}
      />,
    );
    const prevButton = screen.getByRole("button", { name: /previous page/i });
    const nextButton = screen.getByRole("button", { name: /next page/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it("clicking Previous calls onPageChange with page - 1", async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <SessionListPagination
        page={3}
        totalPages={5}
        isLoading={false}
        onPageChange={onPageChange}
      />,
    );
    const prevButton = screen.getByRole("button", { name: /previous page/i });
    await user.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("clicking Next calls onPageChange with page + 1", async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(
      <SessionListPagination
        page={3}
        totalPages={5}
        isLoading={false}
        onPageChange={onPageChange}
      />,
    );
    const nextButton = screen.getByRole("button", { name: /next page/i });
    await user.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SessionListTable
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListTable", () => {
  const defaultSortState = {
    column: "date" as const,
    direction: "desc" as const,
  };
  const defaultProps = {
    sessions: [makeSession()],
    sortState: defaultSortState,
    showLeagueColumn: false,
    onSort: vi.fn(),
    onRowClick: vi.fn(),
  };

  it("renders all column headers", () => {
    renderWithProviders(<SessionListTable {...defaultProps} />);
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Decks")).toBeInTheDocument();
  });

  it("shows League column when showLeagueColumn is true", () => {
    renderWithProviders(
      <SessionListTable {...defaultProps} showLeagueColumn={true} />,
    );
    expect(screen.getByText("League")).toBeInTheDocument();
  });

  it("hides League column when showLeagueColumn is false", () => {
    renderWithProviders(
      <SessionListTable {...defaultProps} showLeagueColumn={false} />,
    );
    expect(screen.queryByText("League")).not.toBeInTheDocument();
  });

  it("clicking a header calls onSort with the correct column name", async () => {
    const onSort = vi.fn();
    const { user } = renderWithProviders(
      <SessionListTable {...defaultProps} onSort={onSort} />,
    );
    await user.click(screen.getByText("Date"));
    expect(onSort).toHaveBeenCalledWith("date");

    await user.click(screen.getByText("Found"));
    expect(onSort).toHaveBeenCalledWith("found");

    await user.click(screen.getByText("Duration"));
    expect(onSort).toHaveBeenCalledWith("duration");

    await user.click(screen.getByText("Decks"));
    expect(onSort).toHaveBeenCalledWith("decks");
  });

  it("renders session rows with formatted data", () => {
    renderWithProviders(<SessionListTable {...defaultProps} />);
    expect(
      screen.getByText("formatted-2024-01-15T10:00:00Z"),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("90m")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it('shows "—" when cardCount is null', () => {
    const session = makeSession({ cardCount: null });
    renderWithProviders(
      <SessionListTable {...defaultProps} sessions={[session]} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it('shows "—" when cardCount is undefined', () => {
    const session = makeSession({ cardCount: undefined });
    renderWithProviders(
      <SessionListTable {...defaultProps} sessions={[session]} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("clicking a row calls onRowClick with the sessionId", async () => {
    const onRowClick = vi.fn();
    const { user } = renderWithProviders(
      <SessionListTable {...defaultProps} onRowClick={onRowClick} />,
    );
    const row = screen
      .getByText("formatted-2024-01-15T10:00:00Z")
      .closest("tr")!;
    await user.click(row);
    expect(onRowClick).toHaveBeenCalledWith("session-1");
  });

  it("renders league in row when showLeagueColumn is true", () => {
    renderWithProviders(
      <SessionListTable
        {...defaultProps}
        showLeagueColumn={true}
        sessions={[makeSession({ league: "Settlers" })]}
      />,
    );
    expect(screen.getByText("Settlers")).toBeInTheDocument();
  });

  it("renders SortIndicator for each column", () => {
    renderWithProviders(
      <SessionListTable {...defaultProps} showLeagueColumn={true} />,
    );
    expect(screen.getByTestId("sort-date")).toBeInTheDocument();
    expect(screen.getByTestId("sort-league")).toBeInTheDocument();
    expect(screen.getByTestId("sort-found")).toBeInTheDocument();
    expect(screen.getByTestId("sort-duration")).toBeInTheDocument();
    expect(screen.getByTestId("sort-decks")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SortIndicator (uses real component, not mock)
// ═══════════════════════════════════════════════════════════════════════════

describe("SortIndicator", () => {
  // We need the real SortIndicator, not the mocked one.
  // Use vi.importActual to get it.
  let RealSortIndicator: any;

  beforeAll(async () => {
    const mod = await vi.importActual<any>("./SortIndicator");
    RealSortIndicator = mod.default;
  });

  it("renders inactive state with opacity-0 class when column does not match", () => {
    const { container } = renderWithProviders(
      <RealSortIndicator
        column="date"
        sortState={{ column: "duration", direction: "asc" }}
      />,
    );
    const wrapper = container.querySelector(".opacity-0");
    expect(wrapper).toBeInTheDocument();
  });

  it('renders ascending indicator when column matches and direction is "asc"', () => {
    renderWithProviders(
      <RealSortIndicator
        column="date"
        sortState={{ column: "date", direction: "asc" }}
      />,
    );
    expect(screen.getByTestId("chevron-up")).toBeInTheDocument();
    expect(screen.queryByTestId("chevron-down")).not.toBeInTheDocument();
  });

  it('renders descending indicator when column matches and direction is "desc"', () => {
    renderWithProviders(
      <RealSortIndicator
        column="date"
        sortState={{ column: "date", direction: "desc" }}
      />,
    );
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
  });

  it("active state has text-primary class", () => {
    const { container } = renderWithProviders(
      <RealSortIndicator
        column="date"
        sortState={{ column: "date", direction: "asc" }}
      />,
    );
    const wrapper = container.querySelector(".text-primary");
    expect(wrapper).toBeInTheDocument();
  });
});
