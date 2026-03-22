import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionsPagination } from "../Sessions.components/SessionsPagination";
import type { SessionsSummary } from "../Sessions.types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

// Mock react-icons so they render something identifiable
vi.mock("react-icons/fi", () => ({
  FiChevronLeft: () => <span data-testid="icon-chevron-left" />,
  FiChevronRight: () => <span data-testid="icon-chevron-right" />,
  FiChevronsLeft: () => <span data-testid="icon-chevrons-left" />,
  FiChevronsRight: () => <span data-testid="icon-chevrons-right" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockSetPage = vi.fn();

function makeSession(
  overrides: Partial<SessionsSummary> = {},
): SessionsSummary {
  return {
    sessionId: "sess-1",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:00:00Z",
    league: "Settlers",
    isActive: false,
    durationMinutes: 60,
    totalDecksOpened: 100,
    totalExchangeValue: 500,
    totalStashValue: 600,
    totalExchangeNetProfit: 200,
    totalStashNetProfit: 250,
    exchangeChaosToDivine: 150,
    stashChaosToDivine: 150,
    stackedDeckChaosCost: 3,
    ...overrides,
  };
}

function setupStore(overrides: {
  currentPage?: number;
  pageSize?: number;
  totalPages?: number;
  totalSessions?: number;
  filteredSessions?: SessionsSummary[];
}) {
  mockSetPage.mockClear();
  mockUseBoundStore.mockReturnValue({
    sessions: {
      getCurrentPage: () => overrides.currentPage ?? 1,
      getPageSize: () => overrides.pageSize ?? 12,
      getTotalPages: () => overrides.totalPages ?? 1,
      getTotalSessions: () => overrides.totalSessions ?? 0,
      getFilteredSessions: () => overrides.filteredSessions ?? [],
      setPage: mockSetPage,
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionsPagination", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no filtered sessions exist", () => {
    setupStore({ filteredSessions: [], totalSessions: 0 });
    const { container } = renderWithProviders(<SessionsPagination />);

    expect(container.innerHTML).toBe("");
  });

  it('shows "Showing X to Y of Z sessions" text', () => {
    const sessions = [
      makeSession({ sessionId: "s1" }),
      makeSession({ sessionId: "s2" }),
      makeSession({ sessionId: "s3" }),
    ];
    setupStore({
      filteredSessions: sessions,
      currentPage: 1,
      pageSize: 12,
      totalPages: 3,
      totalSessions: 30,
    });
    renderWithProviders(<SessionsPagination />);

    expect(
      screen.getByText("Showing 1 to 12 of 30 sessions"),
    ).toBeInTheDocument();
  });

  it("computes correct range on a middle page", () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 2,
      pageSize: 10,
      totalPages: 5,
      totalSessions: 48,
    });
    renderWithProviders(<SessionsPagination />);

    expect(
      screen.getByText("Showing 11 to 20 of 48 sessions"),
    ).toBeInTheDocument();
  });

  it("clamps endItem to totalSessions on the last page", () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 3,
      pageSize: 12,
      totalPages: 3,
      totalSessions: 30,
    });
    renderWithProviders(<SessionsPagination />);

    expect(
      screen.getByText("Showing 25 to 30 of 30 sessions"),
    ).toBeInTheDocument();
  });

  it("shows page indicator text", () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 2,
      totalPages: 5,
    });
    renderWithProviders(<SessionsPagination />);

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });

  // ── Button disabled states ─────────────────────────────────────────────

  it("disables first and prev buttons on page 1", () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 1,
      totalPages: 3,
      totalSessions: 30,
      pageSize: 12,
    });
    renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    // Order: first, prev, next, last
    const [firstBtn, prevBtn, nextBtn, lastBtn] = buttons;

    expect(firstBtn).toBeDisabled();
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
    expect(lastBtn).not.toBeDisabled();
  });

  it("disables next and last buttons on the last page", () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 3,
      totalPages: 3,
      totalSessions: 30,
      pageSize: 12,
    });
    renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    const [firstBtn, prevBtn, nextBtn, lastBtn] = buttons;

    expect(firstBtn).not.toBeDisabled();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
    expect(lastBtn).toBeDisabled();
  });

  it("disables all navigation buttons when there is only one page", () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 1,
      totalPages: 1,
      totalSessions: 5,
      pageSize: 12,
    });
    renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  // ── Button click handlers ──────────────────────────────────────────────

  it("clicking next calls setPage(currentPage + 1)", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 2,
      totalPages: 5,
      totalSessions: 50,
      pageSize: 12,
    });
    const { user } = renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons[2]; // first, prev, next, last
    await user.click(nextBtn);

    expect(mockSetPage).toHaveBeenCalledWith(3);
  });

  it("clicking prev calls setPage(currentPage - 1)", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 3,
      totalPages: 5,
      totalSessions: 50,
      pageSize: 12,
    });
    const { user } = renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    const prevBtn = buttons[1];
    await user.click(prevBtn);

    expect(mockSetPage).toHaveBeenCalledWith(2);
  });

  it("clicking first calls setPage(1)", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 3,
      totalPages: 5,
      totalSessions: 50,
      pageSize: 12,
    });
    const { user } = renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    const firstBtn = buttons[0];
    await user.click(firstBtn);

    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it("clicking last calls setPage(totalPages)", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    setupStore({
      filteredSessions: sessions,
      currentPage: 2,
      totalPages: 5,
      totalSessions: 50,
      pageSize: 12,
    });
    const { user } = renderWithProviders(<SessionsPagination />);

    const buttons = screen.getAllByRole("button");
    const lastBtn = buttons[3];
    await user.click(lastBtn);

    expect(mockSetPage).toHaveBeenCalledWith(5);
  });
});
