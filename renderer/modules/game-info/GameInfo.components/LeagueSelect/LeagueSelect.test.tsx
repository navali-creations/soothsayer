import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import LeagueSelect from "./LeagueSelect";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    gameInfo: {
      getLeaguesForGame: vi.fn(() => [
        { id: "settlers", name: "Settlers" },
        { id: "standard", name: "Standard" },
      ]),
      ...overrides.gameInfo,
    },
    settings: {
      getSelectedPoe1League: vi.fn(() => "settlers"),
      getSelectedPoe2League: vi.fn(() => "standard"),
      updateSetting: vi.fn(),
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

describe("LeagueSelect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a select dropdown with league options", () => {
    setupStore();
    renderWithProviders(<LeagueSelect game="poe1" />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("shows correct options from getLeaguesForGame", () => {
    setupStore({
      gameInfo: {
        getLeaguesForGame: vi.fn(() => [
          { id: "necropolis", name: "Necropolis" },
          { id: "standard", name: "Standard" },
          { id: "hardcore", name: "Hardcore" },
        ]),
      },
    });
    renderWithProviders(<LeagueSelect game="poe1" />);

    expect(
      screen.getByRole("option", { name: "Necropolis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Standard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Hardcore" }),
    ).toBeInTheDocument();
  });

  it("changing selection calls updateSetting with correct key for poe1", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<LeagueSelect game="poe1" />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "standard");

    expect(store.settings.updateSetting).toHaveBeenCalledWith(
      "poe1SelectedLeague",
      "standard",
    );
  });

  it("changing selection calls updateSetting with correct key for poe2", async () => {
    const store = setupStore({
      settings: {
        getSelectedPoe1League: vi.fn(() => "settlers"),
        getSelectedPoe2League: vi.fn(() => "standard"),
        updateSetting: vi.fn(),
      },
    });
    const { user } = renderWithProviders(<LeagueSelect game="poe2" />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "settlers");

    expect(store.settings.updateSetting).toHaveBeenCalledWith(
      "poe2SelectedLeague",
      "settlers",
    );
  });

  it("auto-corrects when stored league is not in available leagues list", () => {
    const store = setupStore({
      settings: {
        getSelectedPoe1League: vi.fn(() => "nonexistent-league"),
        getSelectedPoe2League: vi.fn(() => "standard"),
        updateSetting: vi.fn(),
      },
    });
    renderWithProviders(<LeagueSelect game="poe1" />);

    expect(store.settings.updateSetting).toHaveBeenCalledWith(
      "poe1SelectedLeague",
      "settlers",
    );
  });

  it("does not auto-correct when leagues haven't loaded (empty array)", () => {
    const store = setupStore({
      gameInfo: {
        getLeaguesForGame: vi.fn(() => []),
      },
      settings: {
        getSelectedPoe1League: vi.fn(() => "nonexistent-league"),
        getSelectedPoe2League: vi.fn(() => "standard"),
        updateSetting: vi.fn(),
      },
    });
    renderWithProviders(<LeagueSelect game="poe1" />);

    expect(store.settings.updateSetting).not.toHaveBeenCalled();
  });

  it('shows "League" label', () => {
    setupStore();
    renderWithProviders(<LeagueSelect game="poe1" />);

    expect(screen.getByText("League")).toBeInTheDocument();
  });
});
