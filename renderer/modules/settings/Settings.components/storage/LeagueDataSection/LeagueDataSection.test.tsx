import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import LeagueDataSection from "./LeagueDataSection";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Table: ({ data, columns, compact }: any) => (
    <table data-testid="table" data-rows={data.length} data-compact={compact}>
      <thead>
        <tr>
          {columns.map((col: any, i: number) => (
            <th key={i}>{col.header ?? col.id ?? ""}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, ri: number) => (
          <tr key={ri} data-testid={`row-${ri}`}>
            {columns.map((col: any, ci: number) => {
              const cellCtx = {
                getValue: () => {
                  if (col.accessorKey) return row[col.accessorKey];
                  if (col.accessorFn) return col.accessorFn(row);
                  return undefined;
                },
                row: { original: row },
              };
              return (
                <td key={ci}>
                  {col.cell ? col.cell(cellCtx) : cellCtx.getValue()}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiTrash2: () => <span data-testid="icon-trash" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createLeague(
  overrides: Partial<LeagueStorageUsage> = {},
): LeagueStorageUsage {
  return {
    leagueId: "league-1",
    leagueName: "Settlers",
    game: "poe1",
    sessionCount: 5,
    snapshotCount: 12,
    estimatedSizeBytes: 1048576,
    hasActiveSession: false,
    ...overrides,
  };
}

const defaultProps = {
  leagueUsage: [] as LeagueStorageUsage[],
  isLoading: false,
  deletingLeagueId: null as string | null,
  onDeleteRequest: vi.fn(),
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("LeagueDataSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Section heading ────────────────────────────────────────────────────

  it('renders "League Data" heading', () => {
    renderWithProviders(<LeagueDataSection {...defaultProps} />);

    expect(screen.getByText("League Data")).toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it('shows "No league data to clean up" when leagueUsage is empty and not loading', () => {
    renderWithProviders(
      <LeagueDataSection
        {...defaultProps}
        leagueUsage={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("No league data to clean up")).toBeInTheDocument();
  });

  it("does not show empty message when loading", () => {
    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={[]} isLoading={true} />,
    );

    expect(
      screen.queryByText("No league data to clean up"),
    ).not.toBeInTheDocument();
  });

  it("does not show table when leagueUsage is empty", () => {
    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={[]} />,
    );

    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
  });

  // ── Single-game data (PoE1 only) ──────────────────────────────────────

  it("shows table when there is league data", () => {
    const leagues = [createLeague()];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.getByTestId("table")).toBeInTheDocument();
  });

  it('shows "Path of Exile 1" heading when only poe1 data exists', () => {
    const leagues = [createLeague({ game: "poe1" })];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.getByText("Path of Exile 1")).toBeInTheDocument();
  });

  it("does not show game tabs when only one game has data", () => {
    const leagues = [createLeague({ game: "poe1" })];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  // ── Single-game data (PoE2 only) ──────────────────────────────────────

  it('shows "Path of Exile 2" heading when only poe2 data exists', () => {
    const leagues = [createLeague({ game: "poe2", leagueName: "Dawn" })];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.getByText("Path of Exile 2")).toBeInTheDocument();
  });

  it("auto-selects poe2 tab when only poe2 data exists", () => {
    const leagues = [
      createLeague({ leagueId: "l-poe2", game: "poe2", leagueName: "Dawn" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    // Table should be rendered with the poe2 league
    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-rows", "1");
  });

  // ── Both games with tabs ───────────────────────────────────────────────

  it("renders game tabs when both poe1 and poe2 have data", () => {
    const leagues = [
      createLeague({ leagueId: "l1", game: "poe1", leagueName: "Settlers" }),
      createLeague({ leagueId: "l2", game: "poe2", leagueName: "Dawn" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent("PoE1");
    expect(tabs[1]).toHaveTextContent("PoE2");
  });

  it("shows badge counts on tabs", () => {
    const leagues = [
      createLeague({ leagueId: "l1", game: "poe1" }),
      createLeague({ leagueId: "l2", game: "poe1" }),
      createLeague({ leagueId: "l3", game: "poe2" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("2"); // 2 poe1 leagues
    expect(tabs[1]).toHaveTextContent("1"); // 1 poe2 league
  });

  it("defaults to poe1 tab when both games have data", () => {
    const leagues = [
      createLeague({ leagueId: "l1", game: "poe1", leagueName: "Settlers" }),
      createLeague({ leagueId: "l2", game: "poe2", leagueName: "Dawn" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveClass("tab-active");
    expect(tabs[1]).not.toHaveClass("tab-active");
  });

  it("switches to poe2 data when clicking PoE2 tab", async () => {
    const leagues = [
      createLeague({ leagueId: "l1", game: "poe1", leagueName: "Settlers" }),
      createLeague({ leagueId: "l2", game: "poe2", leagueName: "Dawn" }),
    ];

    const { user } = renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const poe2Tab = screen.getAllByRole("tab")[1];
    await user.click(poe2Tab);

    expect(poe2Tab).toHaveClass("tab-active");

    // Table should now show 1 row (poe2 league only)
    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-rows", "1");
  });

  it("does not show single-game heading when both games have data", () => {
    const leagues = [
      createLeague({ leagueId: "l1", game: "poe1" }),
      createLeague({ leagueId: "l2", game: "poe2" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.queryByText("Path of Exile 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Path of Exile 2")).not.toBeInTheDocument();
  });

  // ── Active session badge ───────────────────────────────────────────────

  it("shows Active badge for league with hasActiveSession", () => {
    const leagues = [
      createLeague({ hasActiveSession: true, leagueName: "Settlers" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not show Active badge for league without active session", () => {
    const leagues = [
      createLeague({ hasActiveSession: false, leagueName: "Settlers" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  // ── Delete button states ───────────────────────────────────────────────

  it("renders delete button for each league", () => {
    const leagues = [createLeague()];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector('[data-testid="icon-trash"]') !== null,
    );
    expect(deleteBtn).toBeDefined();
  });

  it("disables delete button when league has active session", () => {
    const leagues = [createLeague({ hasActiveSession: true })];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector('[data-testid="icon-trash"]') !== null,
    );
    expect(deleteBtn).toBeDisabled();
  });

  it("disables delete button when any league is being deleted (anyDeleting)", () => {
    const leagues = [
      createLeague({ leagueId: "l1", leagueName: "Settlers" }),
      createLeague({ leagueId: "l2", leagueName: "Necropolis" }),
    ];

    renderWithProviders(
      <LeagueDataSection
        {...defaultProps}
        leagueUsage={leagues}
        deletingLeagueId="l1"
      />,
    );

    const buttons = screen.getAllByRole("button");
    // All delete buttons should be disabled when any deletion is in progress
    const deleteButtons = buttons.filter(
      (btn) =>
        btn.querySelector('[data-testid="icon-trash"]') !== null ||
        btn.querySelector(".loading-spinner") !== null,
    );
    for (const btn of deleteButtons) {
      expect(btn).toBeDisabled();
    }
  });

  it("shows loading spinner on the league being deleted", () => {
    const leagues = [createLeague({ leagueId: "l1" })];

    renderWithProviders(
      <LeagueDataSection
        {...defaultProps}
        leagueUsage={leagues}
        deletingLeagueId="l1"
      />,
    );

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("does not show loading spinner for a league not being deleted", () => {
    const leagues = [createLeague({ leagueId: "l1" })];

    renderWithProviders(
      <LeagueDataSection
        {...defaultProps}
        leagueUsage={leagues}
        deletingLeagueId="other-league"
      />,
    );

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).not.toBeInTheDocument();
  });

  it("enables delete button when no active session and nothing deleting", () => {
    const leagues = [createLeague({ hasActiveSession: false, leagueId: "l1" })];

    renderWithProviders(
      <LeagueDataSection
        {...defaultProps}
        leagueUsage={leagues}
        deletingLeagueId={null}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector('[data-testid="icon-trash"]') !== null,
    );
    expect(deleteBtn).not.toBeDisabled();
  });

  it("calls onDeleteRequest when delete button is clicked", async () => {
    const onDeleteRequest = vi.fn();
    const league = createLeague({ leagueId: "l1", leagueName: "Settlers" });

    const { user } = renderWithProviders(
      <LeagueDataSection
        {...defaultProps}
        leagueUsage={[league]}
        onDeleteRequest={onDeleteRequest}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector('[data-testid="icon-trash"]') !== null,
    );
    expect(deleteBtn).toBeDefined();

    await user.click(deleteBtn!);

    expect(onDeleteRequest).toHaveBeenCalledWith(league);
  });

  it('shows "Cannot delete" title on button when hasActiveSession', () => {
    const leagues = [
      createLeague({
        hasActiveSession: true,
        leagueName: "Settlers",
      }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) =>
        btn.querySelector('[data-testid="icon-trash"]') !== null ||
        btn.querySelector(".loading-spinner") !== null,
    );
    expect(deleteBtn).toHaveAttribute(
      "title",
      "Cannot delete while session is active",
    );
  });

  it("shows delete title with league name when no active session", () => {
    const leagues = [
      createLeague({
        hasActiveSession: false,
        leagueName: "Settlers",
      }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(
      (btn) => btn.querySelector('[data-testid="icon-trash"]') !== null,
    );
    expect(deleteBtn).toHaveAttribute("title", "Delete all data for Settlers");
  });

  // ── Multiple leagues in single game ────────────────────────────────────

  it("switches back to poe1 data when clicking PoE1 tab", async () => {
    const leagues = [
      createLeague({ leagueId: "l1", game: "poe1", leagueName: "Settlers" }),
      createLeague({ leagueId: "l2", game: "poe2", leagueName: "Dawn" }),
    ];

    const { user } = renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    // First switch to poe2
    const poe2Tab = screen.getAllByRole("tab")[1];
    await user.click(poe2Tab);
    expect(poe2Tab).toHaveClass("tab-active");

    // Now click poe1 tab
    const poe1Tab = screen.getAllByRole("tab")[0];
    await user.click(poe1Tab);

    expect(poe1Tab).toHaveClass("tab-active");
    expect(poe2Tab).not.toHaveClass("tab-active");

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-rows", "1");
  });

  it("renders multiple leagues in the table", () => {
    const leagues = [
      createLeague({ leagueId: "l1", leagueName: "Settlers" }),
      createLeague({ leagueId: "l2", leagueName: "Necropolis" }),
      createLeague({ leagueId: "l3", leagueName: "Affliction" }),
    ];

    renderWithProviders(
      <LeagueDataSection {...defaultProps} leagueUsage={leagues} />,
    );

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-rows", "3");
  });
});
