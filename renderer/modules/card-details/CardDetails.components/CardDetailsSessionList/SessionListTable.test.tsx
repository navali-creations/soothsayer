import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Mock SortIndicator ────────────────────────────────────────────────────

vi.mock("./SortIndicator", () => ({
  default: ({ column }: any) => (
    <span data-testid={`sort-indicator-${column}`} />
  ),
}));

// ─── Component import (after mocks) ───────────────────────────────────────

import SessionListTable from "./SessionListTable";

// ─── Helpers ───────────────────────────────────────────────────────────────

const defaultSortState = {
  column: "date" as const,
  direction: "desc" as const,
};

const makeSession = (id: string, overrides: Record<string, any> = {}) => ({
  sessionId: id,
  startedAt: "2024-06-15T10:00:00Z",
  league: "Settlers",
  cardCount: 3,
  durationMinutes: 45,
  totalDecksOpened: 120,
  ...overrides,
});

function renderTable(overrides: Record<string, any> = {}) {
  const props = {
    sessions: [makeSession("sess-1")],
    sortState: defaultSortState,
    showLeagueColumn: false,
    onSort: vi.fn(),
    onRowClick: vi.fn(),
    ...overrides,
  };
  const result = renderWithProviders(<SessionListTable {...(props as any)} />);
  return { ...result, props };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Column headers
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListTable — column headers", () => {
  it("renders Date, Found, Duration, and Decks headers", () => {
    renderTable();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Decks")).toBeInTheDocument();
  });

  it("does not render League header when showLeagueColumn is false", () => {
    renderTable({ showLeagueColumn: false });
    expect(screen.queryByText("League")).not.toBeInTheDocument();
  });

  it("renders League header when showLeagueColumn is true", () => {
    renderTable({ showLeagueColumn: true });
    expect(screen.getByText("League")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// League column data cells
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListTable — league column data", () => {
  it("renders league value in row when showLeagueColumn is true", () => {
    renderTable({
      showLeagueColumn: true,
      sessions: [makeSession("sess-1", { league: "Affliction" })],
    });
    expect(screen.getByText("Affliction")).toBeInTheDocument();
  });

  it("does not render league value in row when showLeagueColumn is false", () => {
    renderTable({
      showLeagueColumn: false,
      sessions: [makeSession("sess-1", { league: "Affliction" })],
    });
    expect(screen.queryByText("Affliction")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sort callbacks
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListTable — sort interactions", () => {
  it("calls onSort with 'league' when League header is clicked", async () => {
    const { user, props } = renderTable({ showLeagueColumn: true });
    await user.click(screen.getByText("League"));
    expect(props.onSort).toHaveBeenCalledWith("league");
  });

  it("calls onSort with 'date' when Date header is clicked", async () => {
    const { user, props } = renderTable();
    await user.click(screen.getByText("Date"));
    expect(props.onSort).toHaveBeenCalledWith("date");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Row click
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListTable — row click", () => {
  it("calls onRowClick with session id when a row is clicked", async () => {
    const { user, props } = renderTable({
      sessions: [makeSession("sess-42")],
    });
    const row = screen.getByTitle("View session details");
    await user.click(row);
    expect(props.onRowClick).toHaveBeenCalledWith("sess-42");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rendering session data
// ═══════════════════════════════════════════════════════════════════════════

describe("SessionListTable — session data rendering", () => {
  it("renders multiple sessions as rows", () => {
    renderTable({
      sessions: [
        makeSession("sess-1"),
        makeSession("sess-2"),
        makeSession("sess-3"),
      ],
    });
    const rows = screen.getAllByTitle("View session details");
    expect(rows).toHaveLength(3);
  });

  it("renders dash when cardCount is null", () => {
    renderTable({
      sessions: [makeSession("sess-1", { cardCount: null })],
    });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders totalDecksOpened with locale formatting", () => {
    renderTable({
      sessions: [makeSession("sess-1", { totalDecksOpened: 1234 })],
    });
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
