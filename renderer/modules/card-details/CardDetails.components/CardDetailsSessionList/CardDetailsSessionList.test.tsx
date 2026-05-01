import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useCardDetails: vi.fn() }));

// ─── Router mock ───────────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("@tanstack/react-router", async () => {
  const { createNavigateOnlyMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createNavigateOnlyMock(mockNavigate);
});

// ─── Child component stubs ─────────────────────────────────────────────────

vi.mock("./SessionListEmpty", () => ({
  default: () => <div data-testid="empty" />,
}));

vi.mock("./SessionListError", () => ({
  default: ({ error }: any) => <div data-testid="error">{error}</div>,
}));

vi.mock("./SessionListPagination", () => ({
  default: (props: any) => (
    <div
      data-testid="pagination"
      data-page={props.page}
      data-totalpages={props.totalPages}
    >
      <button data-testid="page-change" onClick={() => props.onPageChange(2)}>
        Page 2
      </button>
    </div>
  ),
}));

vi.mock("./SessionListTable", () => ({
  default: (props: any) => (
    <div
      data-testid="table"
      data-sessions={props.sessions?.length}
      data-show-league={String(props.showLeagueColumn)}
    >
      <button
        data-testid="row-click"
        onClick={() => props.onRowClick("sess-1")}
      >
        Row
      </button>
      <button data-testid="sort-click" onClick={() => props.onSort("date")}>
        Sort
      </button>
    </div>
  ),
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsSessionList from "./";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: Record<string, any> = {}) {
  const base = {
    sessions: {
      total: 3,
      page: 1,
      totalPages: 1,
      sessions: [
        { id: "sess-1", date: "2024-01-01" },
        { id: "sess-2", date: "2024-01-02" },
        { id: "sess-3", date: "2024-01-03" },
      ],
    },
    isLoadingSessions: false,
    sessionsError: null,
    sessionsPage: 1,
    sessionsSortState: { column: "date", direction: "desc" },
    fetchSessionsForCard: vi.fn(),
    setSessionsSort: vi.fn(),
    selectedLeague: "all",
  };

  if (overrides.cardDetails) {
    Object.assign(base, overrides.cardDetails);
  }

  return base;
}

function renderComponent(overrides: Record<string, any> = {}) {
  const mockState = createMockState(overrides);
  vi.mocked(useCardDetails).mockReturnValue(mockState as any);
  const result = renderWithProviders(
    <CardDetailsSessionList cardName="The Doctor" game="poe1" />,
  );
  return { ...result, mockState };
}

function renderComponentWithProps(
  props: { cardName?: string; game?: "poe1" | "poe2" } = {},
  overrides: Record<string, any> = {},
) {
  const mockState = createMockState(overrides);
  vi.mocked(useCardDetails).mockReturnValue(mockState as any);
  const result = renderWithProviders(
    <CardDetailsSessionList
      cardName={props.cardName ?? "The Doctor"}
      game={props.game ?? "poe1"}
    />,
  );
  return { ...result, mockState };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Normal render
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsSessionList — normal render", () => {
  it('renders header "Sessions with this Card"', () => {
    renderComponent();
    expect(screen.getByText("Sessions with this Card")).toBeInTheDocument();
  });

  it("renders session count badge showing total", () => {
    renderComponent();
    expect(screen.getByText("3 sessions")).toBeInTheDocument();
  });

  it('shows singular "session" text when total is 1', () => {
    renderComponent({
      cardDetails: {
        sessions: {
          total: 1,
          page: 1,
          totalPages: 1,
          sessions: [{ id: "sess-1", date: "2024-01-01" }],
        },
      },
    });
    expect(screen.getByText("1 session")).toBeInTheDocument();
  });

  it("renders SessionListTable with sessions", () => {
    renderComponent();
    const table = screen.getByTestId("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute("data-sessions", "3");
  });

  it("renders SessionListPagination with page info", () => {
    renderComponent({
      cardDetails: {
        sessions: {
          total: 12,
          page: 2,
          totalPages: 3,
          sessions: [{ id: "sess-4", date: "2024-01-04" }],
        },
      },
    });
    const pagination = screen.getByTestId("pagination");
    expect(pagination).toBeInTheDocument();
    expect(pagination).toHaveAttribute("data-page", "2");
    expect(pagination).toHaveAttribute("data-totalpages", "3");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Error state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsSessionList — error state", () => {
  it("shows error state when sessionsError is set", () => {
    renderComponent({ cardDetails: { sessionsError: "Failed to load" } });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("does not render table when sessionsError is set", () => {
    renderComponent({ cardDetails: { sessionsError: "Oops" } });
    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsSessionList — empty state", () => {
  it("shows empty state when sessions is null", () => {
    renderComponent({ cardDetails: { sessions: null } });
    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("shows empty state when sessions.total is 0", () => {
    renderComponent({
      cardDetails: {
        sessions: { total: 0, page: 1, totalPages: 0, sessions: [] },
      },
    });
    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("does not render table when sessions is null", () => {
    renderComponent({ cardDetails: { sessions: null } });
    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Effects
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsSessionList — effects", () => {
  it("calls fetchSessionsForCard on mount with correct args", () => {
    const { mockState } = renderComponent();
    expect(mockState.fetchSessionsForCard).toHaveBeenCalledWith(
      "poe1",
      "The Doctor",
      1,
      5,
      undefined,
    );
  });

  it("passes league as undefined when selectedLeague is 'all'", () => {
    const { mockState } = renderComponent({
      cardDetails: { selectedLeague: "all" },
    });
    expect(mockState.fetchSessionsForCard).toHaveBeenCalledWith(
      "poe1",
      "The Doctor",
      1,
      5,
      undefined,
    );
  });

  it("passes specific league when selectedLeague is not 'all'", () => {
    const { mockState } = renderComponent({
      cardDetails: { selectedLeague: "Affliction" },
    });
    expect(mockState.fetchSessionsForCard).toHaveBeenCalledWith(
      "poe1",
      "The Doctor",
      1,
      5,
      "Affliction",
    );
  });

  it("does not fetch sessions when cardName is empty", () => {
    const { mockState } = renderComponentWithProps({ cardName: "" });
    expect(mockState.fetchSessionsForCard).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// User interactions
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsSessionList — user interactions", () => {
  it("handlePageChange calls fetchSessionsForCard with new page number", async () => {
    const { user, mockState } = renderComponent();
    await user.click(screen.getByTestId("page-change"));
    expect(mockState.fetchSessionsForCard).toHaveBeenCalledWith(
      "poe1",
      "The Doctor",
      2,
      5,
      undefined,
    );
  });

  it("handleRowClick navigates to session details route", async () => {
    const { user } = renderComponent();
    await user.click(screen.getByTestId("row-click"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/sessions/$sessionId",
      params: { sessionId: "sess-1" },
    });
  });

  it("handleSort calls setSessionsSort with column, game, cardName, league", async () => {
    const { user, mockState } = renderComponent();
    await user.click(screen.getByTestId("sort-click"));
    expect(mockState.setSessionsSort).toHaveBeenCalledWith(
      "date",
      "poe1",
      "The Doctor",
      undefined,
    );
  });

  it("handleSort passes specific league when selectedLeague is not 'all'", async () => {
    const { user, mockState } = renderComponent({
      cardDetails: { selectedLeague: "Settlers" },
    });
    await user.click(screen.getByTestId("sort-click"));
    expect(mockState.setSessionsSort).toHaveBeenCalledWith(
      "date",
      "poe1",
      "The Doctor",
      "Settlers",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// showLeagueColumn
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsSessionList — showLeagueColumn", () => {
  it("showLeagueColumn is true when selectedLeague is 'all'", () => {
    renderComponent({ cardDetails: { selectedLeague: "all" } });
    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-show-league", "true");
  });

  it("showLeagueColumn is false when selectedLeague is a specific league", () => {
    renderComponent({ cardDetails: { selectedLeague: "Affliction" } });
    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-show-league", "false");
  });
});
