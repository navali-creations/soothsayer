import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { StatisticsActions } from "./StatisticsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
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

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    statistics: {
      selectedLeague: "",
      setStatScope: vi.fn(),
      setSelectedLeague: vi.fn(),
      setSearchQuery: vi.fn(),
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
