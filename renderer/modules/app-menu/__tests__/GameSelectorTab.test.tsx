import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import GameSelectorTab from "../AppMenu.component/GameSelector/GameSelectorTab";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("~/renderer/modules/game-info", () => ({
  LeagueSelect: ({ game }: any) => (
    <div data-testid={`league-select-${game}`} />
  ),
  StatusBadge: ({ game }: any) => <div data-testid={`status-badge-${game}`} />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUpdateSetting = vi.fn();

function createMockStore(overrides: any = {}) {
  return {
    settings: {
      getSelectedGame: vi.fn(() => overrides.selectedGame ?? "poe1"),
      updateSetting: mockUpdateSetting,
      ...overrides.settings,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("GameSelectorTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockUpdateSetting.mockClear();
  });

  it('renders "Path of Exile 1" label for game="poe1"', () => {
    setupStore({ selectedGame: "poe1" });
    renderWithProviders(<GameSelectorTab game="poe1" />);

    expect(screen.getByText("Path of Exile 1")).toBeInTheDocument();
  });

  it('renders "Path of Exile 2" label for game="poe2"', () => {
    setupStore({ selectedGame: "poe2" });
    renderWithProviders(<GameSelectorTab game="poe2" />);

    expect(screen.getByText("Path of Exile 2")).toBeInTheDocument();
  });

  it("shows tab-active class when game is the selected game", () => {
    setupStore({ selectedGame: "poe1" });
    renderWithProviders(<GameSelectorTab game="poe1" />);

    const tab = screen.getByRole("tab");
    expect(tab).toHaveClass("tab-active");
  });

  it("does not show tab-active class when game is not selected", () => {
    setupStore({ selectedGame: "poe2" });
    renderWithProviders(<GameSelectorTab game="poe1" />);

    const tab = screen.getByRole("tab");
    expect(tab).not.toHaveClass("tab-active");
  });

  it('clicking the button calls updateSetting("selectedGame", game)', async () => {
    setupStore({ selectedGame: "poe2" });
    const { user } = renderWithProviders(<GameSelectorTab game="poe1" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(mockUpdateSetting).toHaveBeenCalledWith("selectedGame", "poe1");
  });

  it('clicking poe2 tab calls updateSetting with "poe2"', async () => {
    setupStore({ selectedGame: "poe1" });
    const { user } = renderWithProviders(<GameSelectorTab game="poe2" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(mockUpdateSetting).toHaveBeenCalledWith("selectedGame", "poe2");
  });

  it("renders StatusBadge for the game", () => {
    setupStore({ selectedGame: "poe1" });
    renderWithProviders(<GameSelectorTab game="poe1" />);

    expect(screen.getByTestId("status-badge-poe1")).toBeInTheDocument();
  });

  it("renders LeagueSelect for the game", () => {
    setupStore({ selectedGame: "poe1" });
    renderWithProviders(<GameSelectorTab game="poe1" />);

    expect(screen.getByTestId("league-select-poe1")).toBeInTheDocument();
  });

  it("renders both StatusBadge and LeagueSelect for poe2", () => {
    setupStore({ selectedGame: "poe2" });
    renderWithProviders(<GameSelectorTab game="poe2" />);

    expect(screen.getByTestId("status-badge-poe2")).toBeInTheDocument();
    expect(screen.getByTestId("league-select-poe2")).toBeInTheDocument();
  });

  it("renders with role=tab attribute", () => {
    setupStore({ selectedGame: "poe1" });
    renderWithProviders(<GameSelectorTab game="poe1" />);

    expect(screen.getByRole("tab")).toBeInTheDocument();
  });
});
