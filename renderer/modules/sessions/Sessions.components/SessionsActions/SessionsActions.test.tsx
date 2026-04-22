import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionsActions } from "./SessionsActions";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Search: ({ value, onChange, ...props }: any) => (
    <input
      data-testid="search"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      {...props}
    />
  ),
}));

vi.mock("~/renderer/hooks", () => ({
  useDebounce: vi.fn((value: string) => value),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function createSession(id: string, league = "Settlers") {
  return {
    sessionId: id,
    startedAt: "2024-01-01T10:00:00Z",
    league,
    durationMinutes: 30,
    totalDecksOpened: 10,
    totalExchangeValue: 100,
    totalStashValue: 90,
    totalExchangeNetProfit: 70,
    exchangeChaosToDivine: 200,
    stackedDeckChaosCost: 3,
  };
}

function createMockSessions(overrides: any = {}) {
  return {
    getUniqueLeagues: vi.fn(() => ["all", "Settlers", "Standard"]),
    getSelectedLeague: vi.fn(() => "all"),
    setSelectedLeague: vi.fn(),
    getSearchQuery: vi.fn(() => ""),
    setSearchQuery: vi.fn(),
    loadAllSessions: vi.fn(),
    searchSessions: vi.fn(),
    getIsBulkMode: vi.fn(() => false),
    getBulkMode: vi.fn(() => null),
    setBulkMode: vi.fn(),
    getSelectedSessionIds: vi.fn(() => []),
    getSelectedCount: vi.fn(() => 0),
    getAllSessions: vi.fn(() => []),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    getTotalSessions: vi.fn(() => 0),
    getCurrentPage: vi.fn(() => 1),
    openDeleteConfirm: vi.fn(),
    closeDeleteConfirm: vi.fn(),
    setDeleteError: vi.fn(),
    setIsDeleting: vi.fn(),
    getIsDeleteConfirmOpen: vi.fn(() => false),
    getDeleteError: vi.fn(() => null),
    getIsDeleting: vi.fn(() => false),
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const sessions = createMockSessions(overrides.sessions);
  const settings = {
    getSelectedGame: vi.fn(() => "poe1"),
    ...overrides.settings,
  };
  mockUseBoundStore.mockReturnValue({ sessions, settings } as any);
  return sessions;
}

describe("SessionsActions", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:session-export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    window.electron.sessions.deleteSessions.mockResolvedValue({
      success: true,
      deletedCount: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders search input", () => {
    setupStore();
    renderWithProviders(<SessionsActions />);

    expect(screen.getByTestId("search")).toBeInTheDocument();
  });

  it("renders league filter dropdown with all options", () => {
    setupStore();
    renderWithProviders(<SessionsActions />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "All Leagues" })).toHaveValue(
      "all",
    );
  });

  it("changing league dropdown calls setSelectedLeague", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    await user.selectOptions(screen.getByRole("combobox"), "Settlers");

    expect(store.setSelectedLeague).toHaveBeenCalledWith("Settlers");
  });

  it("typing in search input updates the sessions slice query", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    const searchInput = screen.getByTestId("search");
    await user.type(searchInput, "T");

    expect(store.setSearchQuery).toHaveBeenCalledWith("T");
  });

  it("empty search calls loadAllSessions", () => {
    const store = setupStore();
    renderWithProviders(<SessionsActions />);

    expect(store.loadAllSessions).toHaveBeenCalledWith(1);
  });

  it("non-empty search calls searchSessions", () => {
    const store = setupStore({
      sessions: {
        getSearchQuery: vi.fn(() => "Rain of Chaos"),
      },
    });
    renderWithProviders(<SessionsActions />);

    expect(store.searchSessions).toHaveBeenCalledWith("Rain of Chaos", 1);
  });

  it("trims the debounced search query before searching", () => {
    const store = setupStore({
      sessions: {
        getSearchQuery: vi.fn(() => "  Rain of Chaos  "),
      },
    });
    renderWithProviders(<SessionsActions />);

    expect(store.searchSessions).toHaveBeenCalledWith("Rain of Chaos", 1);
  });

  it("starts simple and rich export modes from the menu", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /export simple csv/i }),
    );
    expect(store.setBulkMode).toHaveBeenCalledWith("export-simple");

    await user.click(screen.getByRole("button", { name: /export rich csv/i }));
    expect(store.setBulkMode).toHaveBeenCalledWith("export-rich");
  });

  it("starts delete mode from the menu", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /^delete sessions$/i }),
    );

    expect(store.setBulkMode).toHaveBeenCalledWith("delete");
  });

  it("cancels export mode and clears type", async () => {
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-rich"),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(store.setBulkMode).toHaveBeenCalledWith(null);
  });

  it("selects all when not all sessions are selected", async () => {
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-rich"),
        getSelectedCount: vi.fn(() => 1),
        getTotalSessions: vi.fn(() => 3),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(screen.getByRole("button", { name: /select all/i }));

    expect(store.selectAll).toHaveBeenCalled();
    expect(store.clearSelection).not.toHaveBeenCalled();
  });

  it("deselects all when all sessions are selected", async () => {
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-simple"),
        getSelectedCount: vi.fn(() => 3),
        getTotalSessions: vi.fn(() => 3),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(screen.getByRole("button", { name: /deselect all/i }));

    expect(store.clearSelection).toHaveBeenCalled();
    expect(store.selectAll).not.toHaveBeenCalled();
  });

  it("does not export when nothing is selected", async () => {
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-simple"),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    const exportButton = screen.getByRole("button", {
      name: /export simple csv \(0\)/i,
    });
    expect(exportButton).toBeDisabled();
    await user.click(exportButton);

    expect(window.electron.sessions.getSimpleExportRows).not.toHaveBeenCalled();
    expect(window.electron.sessions.getRichExportRows).not.toHaveBeenCalled();
  });

  it("renders delete mode controls with a disabled delete button when nothing is selected", () => {
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedCount: vi.fn(() => 0),
        getTotalSessions: vi.fn(() => 3),
      },
    });

    renderWithProviders(<SessionsActions />);

    expect(screen.getByRole("button", { name: /cancel/i })).toHaveClass(
      "btn-outline",
    );
    expect(screen.getByRole("button", { name: /select all/i })).toHaveClass(
      "btn-outline",
    );
    const deleteButton = screen.getByRole("button", {
      name: /delete sessions \(0\)/i,
    });
    expect(deleteButton).toHaveClass("btn-error");
    expect(deleteButton).toBeDisabled();
  });

  it("renders enabled delete mode button with selected count", () => {
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedCount: vi.fn(() => 2),
        getTotalSessions: vi.fn(() => 3),
      },
    });

    renderWithProviders(<SessionsActions />);

    expect(
      screen.getByRole("button", { name: /delete sessions \(2\)/i }),
    ).toBeEnabled();
  });

  it("opens the delete confirmation modal through the sessions slice", async () => {
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedCount: vi.fn(() => 2),
        getTotalSessions: vi.fn(() => 3),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /delete sessions \(2\)/i }),
    );

    expect(store.openDeleteConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders the open delete confirmation modal from the sessions slice", () => {
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedCount: vi.fn(() => 2),
        getTotalSessions: vi.fn(() => 3),
        getIsDeleteConfirmOpen: vi.fn(() => true),
      },
    });

    renderWithProviders(<SessionsActions />);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: "Delete sessions", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Delete 2 selected sessions/)).toBeInTheDocument();
    expect(
      screen.getByText("This action cannot be undone."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aggregate card statistics and total stacked decks/),
    ).toBeInTheDocument();
  });

  it("closes the delete confirmation modal when cancel is clicked", async () => {
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedCount: vi.fn(() => 1),
        getTotalSessions: vi.fn(() => 3),
        getIsDeleteConfirmOpen: vi.fn(() => true),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    const dialog = document.querySelector("dialog") as HTMLElement;
    await user.click(
      within(dialog).getByRole("button", { name: /cancel/i, hidden: true }),
    );

    expect(store.closeDeleteConfirm).toHaveBeenCalledTimes(1);
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("confirms delete success, clears selection, exits bulk mode, and reloads the first page", async () => {
    const deleteSessions = vi
      .fn()
      .mockResolvedValue({ success: true, deletedCount: 2 });
    window.electron.sessions.deleteSessions = deleteSessions;
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedSessionIds: vi.fn(() => ["s1", "s2"]),
        getSelectedCount: vi.fn(() => 2),
        getTotalSessions: vi.fn(() => 3),
        getCurrentPage: vi.fn(() => 4),
        getIsDeleteConfirmOpen: vi.fn(() => true),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    const dialog = document.querySelector("dialog") as HTMLElement;
    await user.click(
      within(dialog).getByRole("button", {
        name: /^delete sessions$/i,
        hidden: true,
      }),
    );

    await waitFor(() =>
      expect(deleteSessions).toHaveBeenCalledWith("poe1", ["s1", "s2"]),
    );
    expect(store.setIsDeleting).toHaveBeenCalledWith(true);
    expect(store.setDeleteError).toHaveBeenCalledWith(null);
    expect(store.closeDeleteConfirm).toHaveBeenCalled();
    expect(store.clearSelection).toHaveBeenCalled();
    expect(store.setBulkMode).toHaveBeenCalledWith(null);
    expect(store.loadAllSessions).toHaveBeenCalledWith(1);
    expect(store.setIsDeleting).toHaveBeenLastCalledWith(false);
  });

  it("confirms delete success and reloads the first search page when searching", async () => {
    const deleteSessions = vi
      .fn()
      .mockResolvedValue({ success: true, deletedCount: 1 });
    window.electron.sessions.deleteSessions = deleteSessions;
    const store = setupStore({
      sessions: {
        getSearchQuery: vi.fn(() => "The Doctor"),
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedSessionIds: vi.fn(() => ["s1"]),
        getSelectedCount: vi.fn(() => 1),
        getTotalSessions: vi.fn(() => 3),
        getCurrentPage: vi.fn(() => 4),
        getIsDeleteConfirmOpen: vi.fn(() => true),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    const dialog = document.querySelector("dialog") as HTMLElement;
    await user.click(
      within(dialog).getByRole("button", {
        name: /^delete sessions$/i,
        hidden: true,
      }),
    );

    await waitFor(() =>
      expect(deleteSessions).toHaveBeenCalledWith("poe1", ["s1"]),
    );
    expect(store.clearSelection).toHaveBeenCalled();
    expect(store.setBulkMode).toHaveBeenCalledWith(null);
    expect(store.searchSessions).toHaveBeenLastCalledWith("The Doctor", 1);
    expect(store.loadAllSessions).not.toHaveBeenCalled();
  });

  it("keeps the delete modal open and preserves selection on delete failure", async () => {
    const deleteSessions = vi.fn().mockResolvedValue({
      success: false,
      error: "Cannot delete active session",
    });
    window.electron.sessions.deleteSessions = deleteSessions;
    const store = setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "delete"),
        getSelectedSessionIds: vi.fn(() => ["s1"]),
        getSelectedCount: vi.fn(() => 1),
        getTotalSessions: vi.fn(() => 3),
        getIsDeleteConfirmOpen: vi.fn(() => true),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    const dialog = document.querySelector("dialog") as HTMLElement;
    await user.click(
      within(dialog).getByRole("button", {
        name: /^delete sessions$/i,
        hidden: true,
      }),
    );

    await waitFor(() =>
      expect(store.setDeleteError).toHaveBeenCalledWith(
        "Cannot delete active session",
      ),
    );
    expect(store.clearSelection).not.toHaveBeenCalled();
    expect(store.setBulkMode).not.toHaveBeenCalledWith(null);
    expect(store.closeDeleteConfirm).not.toHaveBeenCalled();
    expect(store.setIsDeleting).toHaveBeenLastCalledWith(false);
  });

  it("exports rich CSV for selected sessions", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    window.electron.sessions.getRichExportRows.mockResolvedValue([
      createSession("s1"),
    ]);
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-rich"),
        getSelectedSessionIds: vi.fn(() => ["s1"]),
        getSelectedCount: vi.fn(() => 1),
        getTotalSessions: vi.fn(() => 2),
        getAllSessions: vi.fn(() => [
          createSession("s1"),
          createSession("s2", "Standard"),
        ]),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /export rich csv \(1\)/i }),
    );

    await waitFor(() =>
      expect(window.electron.sessions.getRichExportRows).toHaveBeenCalledWith(
        "poe1",
        ["s1"],
      ),
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(window.electron.sessions.getSimpleExportRows).not.toHaveBeenCalled();
  });

  it("exports simple CSV from aggregated card drops", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    window.electron.sessions.getSimpleExportRows.mockResolvedValue({
      "The Doctor": 2,
    });
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-simple"),
        getSelectedSessionIds: vi.fn(() => ["s1", "s2"]),
        getSelectedCount: vi.fn(() => 2),
        getTotalSessions: vi.fn(() => 4),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /export simple csv \(2\)/i }),
    );

    await waitFor(() =>
      expect(window.electron.sessions.getSimpleExportRows).toHaveBeenCalledWith(
        "poe1",
        ["s1", "s2"],
      ),
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:session-export");
  });

  it("exports all selected simple CSV rows without sending every selected ID", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    window.electron.sessions.getSimpleExportRows.mockResolvedValue({
      "The Doctor": 5,
      Humility: 10,
    });
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-simple"),
        getSelectedSessionIds: vi.fn(() =>
          Array.from({ length: 201 }, (_, i) => `s${i}`),
        ),
        getSelectedCount: vi.fn(() => 201),
        getTotalSessions: vi.fn(() => 201),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /export simple csv \(201\)/i }),
    );

    await waitFor(() =>
      expect(window.electron.sessions.getSimpleExportRows).toHaveBeenCalledWith(
        "poe1",
        null,
      ),
    );
    expect(window.electron.sessions.getSimpleExportRows).toHaveBeenCalledTimes(
      1,
    );
    expect(clickSpy).toHaveBeenCalled();
  });

  it("exports all selected rich CSV rows without relying on the loaded page", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    window.electron.sessions.getRichExportRows.mockResolvedValue([
      createSession("s1"),
      createSession("s2", "Standard"),
    ]);
    setupStore({
      sessions: {
        getIsBulkMode: vi.fn(() => true),
        getBulkMode: vi.fn(() => "export-rich"),
        getSelectedSessionIds: vi.fn(() => ["s1", "s2"]),
        getSelectedCount: vi.fn(() => 2),
        getTotalSessions: vi.fn(() => 2),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /export rich csv \(2\)/i }),
    );

    await waitFor(() =>
      expect(window.electron.sessions.getRichExportRows).toHaveBeenCalledWith(
        "poe1",
        null,
      ),
    );
    expect(clickSpy).toHaveBeenCalled();
  });
});
