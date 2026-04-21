import {
  renderWithProviders,
  screen,
  waitFor,
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
    loadAllSessions: vi.fn(),
    searchSessions: vi.fn(),
    getIsExportMode: vi.fn(() => false),
    getExportType: vi.fn(() => null),
    setExportType: vi.fn(),
    getSelectedSessionIds: vi.fn(() => []),
    getSelectedCount: vi.fn(() => 0),
    getAllSessions: vi.fn(() => []),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    getTotalSessions: vi.fn(() => 0),
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

  it("typing in search input updates the value", async () => {
    setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    const searchInput = screen.getByTestId("search");
    await user.type(searchInput, "The Doctor");

    expect(searchInput).toHaveValue("The Doctor");
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

  it("starts simple and rich export modes from the menu", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(
      screen.getByRole("button", { name: /export simple csv/i }),
    );
    expect(store.setExportType).toHaveBeenCalledWith("simple");

    await user.click(screen.getByRole("button", { name: /export rich csv/i }));
    expect(store.setExportType).toHaveBeenCalledWith("rich");
  });

  it("cancels export mode and clears type", async () => {
    const store = setupStore({
      sessions: {
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "rich"),
      },
    });
    const { user } = renderWithProviders(<SessionsActions />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(store.setExportType).toHaveBeenCalledWith(null);
  });

  it("selects all when not all sessions are selected", async () => {
    const store = setupStore({
      sessions: {
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "rich"),
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
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "simple"),
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
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "simple"),
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

  it("exports rich CSV for selected sessions", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    window.electron.sessions.getRichExportRows.mockResolvedValue([
      createSession("s1"),
    ]);
    setupStore({
      sessions: {
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "rich"),
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
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "simple"),
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
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "simple"),
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
        getIsExportMode: vi.fn(() => true),
        getExportType: vi.fn(() => "rich"),
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
