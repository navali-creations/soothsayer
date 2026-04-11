import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionsActions } from "./SessionsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockSessions(overrides: any = {}) {
  return {
    getUniqueLeagues: vi.fn(() => ["all", "Settlers", "Standard"]),
    getSelectedLeague: vi.fn(() => "all"),
    setSelectedLeague: vi.fn(),
    getSearchQuery: vi.fn(() => ""),
    loadAllSessions: vi.fn(),
    searchSessions: vi.fn(),
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const sessions = createMockSessions(overrides.sessions);
  const store = { sessions } as any;
  mockUseBoundStore.mockReturnValue(store);
  return sessions;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionsActions", () => {
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

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("All Leagues");
    expect(options[1]).toHaveTextContent("Settlers");
    expect(options[2]).toHaveTextContent("Standard");
  });

  it("changing league dropdown calls setSelectedLeague", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<SessionsActions />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Settlers");

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
    const store = setupStore({
      sessions: {
        getSearchQuery: vi.fn(() => ""),
      },
    });
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
});
