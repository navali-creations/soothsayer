import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCards, useRarityInsights, useSettings } from "~/renderer/store";

import { CardsActions } from "./CardsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCards: vi.fn(),
  useSettings: vi.fn(),
  useRarityInsights: vi.fn(),
}));

const mockUseCards = vi.mocked(useCards);
const mockUseSettings = vi.mocked(useSettings);
const mockUseRarityInsights = vi.mocked(useRarityInsights);

vi.mock("~/renderer/components", () => ({
  RaritySourceSelect: ({ value, onChange, disabled }: any) => (
    <select
      data-testid="rarity-source-select"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="poe.ninja">poe.ninja</option>
      <option value="prohibited-library">Prohibited Library</option>
    </select>
  ),
  Search: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("~/renderer/modules/umami", () => ({
  initUmami: vi.fn(),
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

vi.mock("~/renderer/utils", () => ({
  decodeRaritySourceValue: (value: string) => ({
    raritySource: value,
    filterId: null,
  }),
  encodeRaritySourceValue: (source: string, _filterId: string | null) => source,
  getAnalyticsRaritySource: () => "test-source",
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockSetSearchQuery = vi.fn();
const mockSetRarityFilter = vi.fn();
const mockSetIncludeBossCards = vi.fn();
const mockSetIncludeDisabledCards = vi.fn();
const mockSetShowAllCards = vi.fn();
const mockLoadCards = vi.fn().mockResolvedValue(undefined);
const mockScanFilters = vi.fn().mockResolvedValue(undefined);
const mockSelectFilter = vi.fn().mockResolvedValue(undefined);
const mockClearSelectedFilter = vi.fn().mockResolvedValue(undefined);
const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);

function setupStore(
  overrides: {
    searchQuery?: string;
    rarityFilter?: string | number;
    includeBossCards?: boolean;
    includeDisabledCards?: boolean;
    showAllCards?: boolean;
    raritySource?: string;
    selectedFilterId?: string | null;
    availableFilters?: any[];
    isScanning?: boolean;
    lastScannedAt?: string | null;
  } = {},
) {
  mockUseCards.mockReturnValue({
    searchQuery: overrides.searchQuery ?? "",
    rarityFilter: overrides.rarityFilter ?? "all",
    includeBossCards: overrides.includeBossCards ?? false,
    includeDisabledCards: overrides.includeDisabledCards ?? false,
    showAllCards: overrides.showAllCards ?? false,
    setSearchQuery: mockSetSearchQuery,
    setRarityFilter: mockSetRarityFilter,
    setIncludeBossCards: mockSetIncludeBossCards,
    setIncludeDisabledCards: mockSetIncludeDisabledCards,
    setShowAllCards: mockSetShowAllCards,
    loadCards: mockLoadCards,
  } as any);
  mockUseSettings.mockReturnValue({
    raritySource: overrides.raritySource ?? "poe.ninja",
    selectedFilterId: overrides.selectedFilterId ?? null,
    updateSetting: mockUpdateSetting,
  } as any);
  mockUseRarityInsights.mockReturnValue({
    availableFilters: overrides.availableFilters ?? [{ id: "f1" }],
    isScanning: overrides.isScanning ?? false,
    lastScannedAt: overrides.lastScannedAt ?? new Date().toISOString(),
    scanFilters: mockScanFilters,
    selectFilter: mockSelectFilter,
    clearSelectedFilter: mockClearSelectedFilter,
    getLocalFilters: () => [],
    getOnlineFilters: () => [],
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardsActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockSetSearchQuery.mockClear();
    mockSetRarityFilter.mockClear();
    mockSetIncludeBossCards.mockClear();
    mockSetIncludeDisabledCards.mockClear();
    mockSetShowAllCards.mockClear();
    mockLoadCards.mockClear();
    mockScanFilters.mockClear();
    mockUpdateSetting.mockClear();
  });

  describe("rendering", () => {
    it("renders search input", () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("renders search input with correct placeholder", () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("search-input")).toHaveAttribute(
        "placeholder",
        "Search cards...",
      );
    });

    it("renders rarity source select", () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("rarity-source-select")).toBeInTheDocument();
    });

    it("renders rarity filter dropdown", () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      const raritySelect = screen.getByDisplayValue("All Rarities");
      expect(raritySelect).toBeInTheDocument();
    });

    it("renders boss cards toggle checkbox", () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(3);
    });

    it('renders "Include boss cards" label text', () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByText("Include boss cards")).toBeInTheDocument();
    });

    it('renders "Include disabled cards" label text', () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByText("Include disabled cards")).toBeInTheDocument();
    });

    it("renders all rarity filter options", () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByText("All Rarities")).toBeInTheDocument();
      expect(screen.getByText("Extremely Rare")).toBeInTheDocument();
      expect(screen.getByText("Rare")).toBeInTheDocument();
      expect(screen.getByText("Less Common")).toBeInTheDocument();
      expect(screen.getByText("Common")).toBeInTheDocument();
    });
  });

  describe("search input", () => {
    it("displays the current search query value", () => {
      setupStore({ searchQuery: "doctor" });
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("search-input")).toHaveValue("doctor");
    });

    it("calls setSearchQuery when search input changes", async () => {
      setupStore({ searchQuery: "" });
      const { user } = renderWithProviders(<CardsActions />);

      await user.type(screen.getByTestId("search-input"), "a");

      expect(mockSetSearchQuery).toHaveBeenCalledWith("a");
    });
  });

  describe("rarity filter", () => {
    it("displays the current rarity filter value", () => {
      setupStore({ rarityFilter: "all" });
      renderWithProviders(<CardsActions />);

      const select = screen.getByDisplayValue("All Rarities");
      expect(select).toBeInTheDocument();
    });

    it("calls setRarityFilter with parsed integer when a rarity is selected", async () => {
      setupStore({ rarityFilter: "all" });
      const { user } = renderWithProviders(<CardsActions />);

      const select = screen.getByDisplayValue("All Rarities");
      await user.selectOptions(select, "1");

      expect(mockSetRarityFilter).toHaveBeenCalledWith(1);
    });

    it('calls setRarityFilter with "all" when All Rarities is selected', async () => {
      setupStore({ rarityFilter: 1 });
      const { user } = renderWithProviders(<CardsActions />);

      // The select currently shows "Extremely Rare" (value=1)
      const select = screen.getByDisplayValue("Extremely Rare");
      await user.selectOptions(select, "all");

      expect(mockSetRarityFilter).toHaveBeenCalledWith("all");
    });

    it("calls onFilterChange when rarity filter changes", async () => {
      setupStore({ rarityFilter: "all" });
      const onFilterChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsActions onFilterChange={onFilterChange} />,
      );

      const select = screen.getByDisplayValue("All Rarities");
      await user.selectOptions(select, "2");

      expect(onFilterChange).toHaveBeenCalled();
    });
  });

  describe("boss cards toggle", () => {
    it("checkbox is unchecked when includeBossCards is false", () => {
      setupStore({ includeBossCards: false });
      renderWithProviders(<CardsActions />);

      const bossCheckbox = screen
        .getByText("Include boss cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      expect(bossCheckbox).not.toBeChecked();
    });

    it("checkbox is checked when includeBossCards is true", () => {
      setupStore({ includeBossCards: true });
      renderWithProviders(<CardsActions />);

      const bossCheckbox = screen
        .getByText("Include boss cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      expect(bossCheckbox).toBeChecked();
    });

    it("calls setIncludeBossCards when checkbox is toggled on", async () => {
      setupStore({ includeBossCards: false });
      const { user } = renderWithProviders(<CardsActions />);

      const bossCheckbox = screen
        .getByText("Include boss cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      await user.click(bossCheckbox);

      expect(mockSetIncludeBossCards).toHaveBeenCalledWith(true);
    });

    it("calls setIncludeBossCards when checkbox is toggled off", async () => {
      setupStore({ includeBossCards: true });
      const { user } = renderWithProviders(<CardsActions />);

      const bossCheckbox = screen
        .getByText("Include boss cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      await user.click(bossCheckbox);

      expect(mockSetIncludeBossCards).toHaveBeenCalledWith(false);
    });

    it("calls onFilterChange when boss cards toggle changes", async () => {
      setupStore({ includeBossCards: false });
      const onFilterChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsActions onFilterChange={onFilterChange} />,
      );

      const bossCheckbox = screen
        .getByText("Include boss cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      await user.click(bossCheckbox);

      expect(onFilterChange).toHaveBeenCalled();
    });
  });

  describe("disabled cards toggle", () => {
    it("checkbox is unchecked when includeDisabledCards is false", () => {
      setupStore({ includeDisabledCards: false });
      renderWithProviders(<CardsActions />);

      const disabledCheckbox = screen
        .getByText("Include disabled cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      expect(disabledCheckbox).not.toBeChecked();
    });

    it("checkbox is checked when includeDisabledCards is true", () => {
      setupStore({ includeDisabledCards: true });
      renderWithProviders(<CardsActions />);

      const disabledCheckbox = screen
        .getByText("Include disabled cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      expect(disabledCheckbox).toBeChecked();
    });

    it("calls setIncludeDisabledCards when checkbox is toggled on", async () => {
      setupStore({ includeDisabledCards: false });
      const { user } = renderWithProviders(<CardsActions />);

      const disabledCheckbox = screen
        .getByText("Include disabled cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      await user.click(disabledCheckbox);

      expect(mockSetIncludeDisabledCards).toHaveBeenCalledWith(true);
    });

    it("calls setIncludeDisabledCards when checkbox is toggled off", async () => {
      setupStore({ includeDisabledCards: true });
      const { user } = renderWithProviders(<CardsActions />);

      const disabledCheckbox = screen
        .getByText("Include disabled cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      await user.click(disabledCheckbox);

      expect(mockSetIncludeDisabledCards).toHaveBeenCalledWith(false);
    });

    it("calls onFilterChange when disabled cards toggle changes", async () => {
      setupStore({ includeDisabledCards: false });
      const onFilterChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsActions onFilterChange={onFilterChange} />,
      );

      const disabledCheckbox = screen
        .getByText("Include disabled cards")
        .closest("label")!
        .querySelector("input[type='checkbox']")!;
      await user.click(disabledCheckbox);

      expect(onFilterChange).toHaveBeenCalled();
    });
  });

  describe("filter scanning", () => {
    it("keeps rarity source select enabled while scanning", () => {
      setupStore({ isScanning: true });
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("rarity-source-select")).not.toBeDisabled();
    });

    it("keeps rarity source select enabled when not scanning", () => {
      setupStore({ isScanning: false });
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("rarity-source-select")).not.toBeDisabled();
    });
  });
});
