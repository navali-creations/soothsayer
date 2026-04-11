import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { StatisticsActions } from "./StatisticsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStatistics(overrides: any = {}) {
  return {
    selectedLeague: "",
    setStatScope: vi.fn(),
    setSelectedLeague: vi.fn(),
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const statistics = createMockStatistics(overrides);
  mockUseBoundStore.mockReturnValue({ statistics } as any);
  return statistics;
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

    expect(store.setStatScope).toHaveBeenCalledWith("all-time");
    expect(store.setSelectedLeague).toHaveBeenCalledWith("");
  });

  it('calls setStatScope("league") and setSelectedLeague when a league is selected', async () => {
    const store = setupStore();
    const { user } = renderWithProviders(
      <StatisticsActions {...defaultProps} />,
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Settlers");

    expect(store.setStatScope).toHaveBeenCalledWith("league");
    expect(store.setSelectedLeague).toHaveBeenCalledWith("Settlers");
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
