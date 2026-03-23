import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { StatisticsActions } from "../Statistics.components/StatisticsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Dropdown: ({ trigger, children, ...props }: any) => (
    <div data-testid="dropdown" {...props}>
      <button data-testid="dropdown-trigger" type="button">
        {trigger}
      </button>
      <div data-testid="dropdown-content">{children}</div>
    </div>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Search: ({ onChange, debounceMs, ...props }: any) => (
    <input
      data-testid="statistics-search"
      data-debounce-ms={debounceMs}
      onChange={(e: any) => onChange(e.target.value)}
      {...props}
    />
  ),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("~/renderer/utils", () => ({
  formatRelativeTime: vi.fn((_date: string) => "2 hours ago"),
}));

vi.mock("react-icons/fi", () => ({
  FiDownload: () => <span data-testid="icon-download" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    statistics: {
      selectedLeague: "",
      setStatScope: vi.fn(),
      setSelectedLeague: vi.fn(),
      setSearchQuery: vi.fn(),
      snapshotMeta: null,
      isExporting: false,
      fetchSnapshotMeta: vi.fn(),
      exportAll: vi.fn().mockResolvedValue({ success: true }),
      exportIncremental: vi.fn().mockResolvedValue({ success: true }),
      ...overrides,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

const defaultProps = {
  availableLeagues: ["Settlers", "Necropolis"],
  currentScope: "all-time",
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatisticsActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Renders ────────────────────────────────────────────────────────────

  it("renders the search input", () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByTestId("statistics-search")).toBeInTheDocument();
  });

  it("renders the scope select dropdown", () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it('renders "All-Time" as the first option in scope select', () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("All-Time");
    expect(options[0]).toHaveValue("all-time");
  });

  it("renders available leagues as options in scope select", () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(
      screen.getByRole("option", { name: "Settlers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Necropolis" }),
    ).toBeInTheDocument();
  });

  it("renders the Export CSV dropdown trigger", () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("renders Export All Cards button inside dropdown", () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByText("Export All Cards")).toBeInTheDocument();
  });

  // ── fetchSnapshotMeta on mount ─────────────────────────────────────────

  it("calls fetchSnapshotMeta with currentScope on mount", () => {
    const store = setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(store.statistics.fetchSnapshotMeta).toHaveBeenCalledWith("all-time");
  });

  it("calls fetchSnapshotMeta when currentScope changes", () => {
    const store = setupStore();
    const { rerender } = renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="all-time" />,
    );

    expect(store.statistics.fetchSnapshotMeta).toHaveBeenCalledWith("all-time");

    rerender(<StatisticsActions {...defaultProps} currentScope="Settlers" />);

    expect(store.statistics.fetchSnapshotMeta).toHaveBeenCalledWith("Settlers");
  });

  // ── Scope change ───────────────────────────────────────────────────────

  it('calls setStatScope("all-time") and clears league when "all-time" is selected', async () => {
    const store = setupStore({ selectedLeague: "Settlers" });
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} />,
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "all-time");

    expect(store.statistics.setStatScope).toHaveBeenCalledWith("all-time");
    expect(store.statistics.setSelectedLeague).toHaveBeenCalledWith("");
  });

  it('calls setStatScope("league") and setSelectedLeague when a league is selected', async () => {
    const store = setupStore();
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} />,
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Settlers");

    expect(store.statistics.setStatScope).toHaveBeenCalledWith("league");
    expect(store.statistics.setSelectedLeague).toHaveBeenCalledWith("Settlers");
  });

  it("select value reflects selectedLeague from store", () => {
    setupStore({ selectedLeague: "Necropolis" });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("Necropolis");
  });

  it('select value defaults to "all-time" when selectedLeague is empty', () => {
    setupStore({ selectedLeague: "" });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("all-time");
  });

  // ── Search ─────────────────────────────────────────────────────────────

  it("passes setSearchQuery as onChange to Search", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} />,
    );

    const search = screen.getByTestId("statistics-search");
    await user.type(search, "doctor");

    // Each character triggers onChange because our mock Search calls onChange directly
    expect(store.statistics.setSearchQuery).toHaveBeenCalled();
  });

  it("configures Search with 300ms debounce", () => {
    setupStore();
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const search = screen.getByTestId("statistics-search");
    expect(search).toHaveAttribute("data-debounce-ms", "300");
  });

  // ── Export All ─────────────────────────────────────────────────────────

  it("calls exportAll with currentScope when Export All Cards is clicked", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="all-time" />,
    );

    const exportAllButton = screen
      .getByText("Export All Cards")
      .closest("button")!;
    await user.click(exportAllButton);

    expect(store.statistics.exportAll).toHaveBeenCalledWith("all-time");
  });

  it("tracks analytics event on successful Export All", async () => {
    const { trackEvent } = await import("~/renderer/modules/umami");
    setupStore();
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="all-time" />,
    );

    const exportAllButton = screen
      .getByText("Export All Cards")
      .closest("button")!;
    await user.click(exportAllButton);

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("csv-export", {
        type: "all",
        scope: "all-time",
        source: "statistics",
      });
    });
  });

  it("shows alert on failed (non-canceled) Export All", async () => {
    setupStore({
      exportAll: vi.fn().mockResolvedValue({
        success: false,
        canceled: false,
        error: "Disk full",
      }),
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} />,
    );

    const exportAllButton = screen
      .getByText("Export All Cards")
      .closest("button")!;
    await user.click(exportAllButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Disk full");
    });
  });

  it("does not show alert when Export All is canceled", async () => {
    setupStore({
      exportAll: vi.fn().mockResolvedValue({
        success: false,
        canceled: true,
      }),
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} />,
    );

    const exportAllButton = screen
      .getByText("Export All Cards")
      .closest("button")!;
    await user.click(exportAllButton);

    await waitFor(() => {
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  // ── Export All button disabled state ───────────────────────────────────

  it("disables Export All Cards button when isExporting is true", () => {
    setupStore({ isExporting: true });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const exportAllButton = screen
      .getByText("Export All Cards")
      .closest("button")!;
    expect(exportAllButton).toBeDisabled();
  });

  // ── Loading spinner during export ──────────────────────────────────────

  it("shows spinner icon when isExporting is true", () => {
    setupStore({ isExporting: true });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("shows download icon when not exporting", () => {
    setupStore({ isExporting: false });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByTestId("icon-download")).toBeInTheDocument();
  });

  // ── Export Incremental ─────────────────────────────────────────────────

  it("does not show Export Latest Cards when there is no snapshot", () => {
    setupStore({ snapshotMeta: null });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.queryByText("Export Latest Cards")).not.toBeInTheDocument();
  });

  it("shows Export Latest Cards when hasSnapshot is true", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 2,
        newTotalDrops: 5,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByText("Export Latest Cards")).toBeInTheDocument();
  });

  it("disables Export Latest Cards when no new cards", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 0,
        newTotalDrops: 0,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const incrementalButton = screen
      .getByText("Export Latest Cards")
      .closest("button")!;
    expect(incrementalButton).toBeDisabled();
  });

  it("enables Export Latest Cards when there are new cards", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 3,
        newTotalDrops: 10,
      },
      isExporting: false,
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    const incrementalButton = screen
      .getByText("Export Latest Cards")
      .closest("button")!;
    expect(incrementalButton).not.toBeDisabled();
  });

  it("shows +N badge when there are new drops", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 2,
        newTotalDrops: 7,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByText("+7")).toBeInTheDocument();
  });

  it("does not show +N badge when newTotalDrops is 0", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 0,
        newTotalDrops: 0,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.queryByText("+0")).not.toBeInTheDocument();
  });

  it('shows "Nothing new since last export" when no new drops', () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 0,
        newTotalDrops: 0,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(
      screen.getByText("Nothing new since last export"),
    ).toBeInTheDocument();
  });

  it("shows singular 'card' when newTotalDrops is 1", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 1,
        newTotalDrops: 1,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(
      screen.getByText("You've found 1 card since last export"),
    ).toBeInTheDocument();
  });

  it("shows plural 'cards' when newTotalDrops is > 1", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 3,
        newTotalDrops: 5,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(
      screen.getByText("You've found 5 cards since last export"),
    ).toBeInTheDocument();
  });

  it("calls exportIncremental with currentScope when Export Latest Cards is clicked", async () => {
    const store = setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 2,
        newTotalDrops: 5,
      },
    });
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="all-time" />,
    );

    const incrementalButton = screen
      .getByText("Export Latest Cards")
      .closest("button")!;
    await user.click(incrementalButton);

    expect(store.statistics.exportIncremental).toHaveBeenCalledWith("all-time");
  });

  it("tracks analytics event on successful Export Incremental", async () => {
    const { trackEvent } = await import("~/renderer/modules/umami");
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 2,
        newTotalDrops: 5,
      },
    });
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="all-time" />,
    );

    const incrementalButton = screen
      .getByText("Export Latest Cards")
      .closest("button")!;
    await user.click(incrementalButton);

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("csv-export", {
        type: "incremental",
        scope: "all-time",
        newDrops: 5,
        source: "statistics",
      });
    });
  });

  // ── Export sublabel for scope ──────────────────────────────────────────

  it('shows "Everything you\'ve found" sublabel for all-time scope', () => {
    setupStore();
    renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="all-time" />,
    );

    expect(screen.getByText("Everything you've found")).toBeInTheDocument();
  });

  it('shows "Everything in {league}" sublabel for league scope', () => {
    setupStore();
    renderWithProviders(
      <StatisticsActions {...defaultProps} currentScope="Settlers" />,
    );

    expect(screen.getByText("Everything in Settlers")).toBeInTheDocument();
  });

  // ── Last exported timestamp ────────────────────────────────────────────

  it("shows last exported timestamp when snapshot has exportedAt", () => {
    setupStore({
      snapshotMeta: {
        exists: true,
        exportedAt: "2024-01-01T00:00:00Z",
        totalCount: 100,
        newCardCount: 0,
        newTotalDrops: 0,
      },
    });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.getByText(/Last exported/)).toBeInTheDocument();
  });

  it("does not show last exported when snapshot does not exist", () => {
    setupStore({ snapshotMeta: null });
    renderWithProviders(<StatisticsActions {...defaultProps} />);

    expect(screen.queryByText(/Last exported/)).not.toBeInTheDocument();
  });

  // ── No available leagues ───────────────────────────────────────────────

  it("renders only All-Time option when availableLeagues is empty", () => {
    setupStore();
    renderWithProviders(
      <StatisticsActions availableLeagues={[]} currentScope="all-time" />,
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("All-Time");
  });
});
