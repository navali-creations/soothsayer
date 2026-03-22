import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { CardsActions } from "../Cards.components/CardsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

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
const mockLoadCards = vi.fn().mockResolvedValue(undefined);
const mockScanFilters = vi.fn();
const mockSelectFilter = vi.fn().mockResolvedValue(undefined);
const mockClearSelectedFilter = vi.fn().mockResolvedValue(undefined);
const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);

function setupStore(
  overrides: {
    searchQuery?: string;
    rarityFilter?: string | number;
    includeBossCards?: boolean;
    raritySource?: string;
    selectedFilterId?: string | null;
    availableFilters?: any[];
    isScanning?: boolean;
    lastScannedAt?: string | null;
  } = {},
) {
  mockUseBoundStore.mockReturnValue({
    cards: {
      searchQuery: overrides.searchQuery ?? "",
      rarityFilter: overrides.rarityFilter ?? "all",
      includeBossCards: overrides.includeBossCards ?? false,
      setSearchQuery: mockSetSearchQuery,
      setRarityFilter: mockSetRarityFilter,
      setIncludeBossCards: mockSetIncludeBossCards,
      loadCards: mockLoadCards,
    },
    settings: {
      raritySource: overrides.raritySource ?? "poe.ninja",
      selectedFilterId: overrides.selectedFilterId ?? null,
      updateSetting: mockUpdateSetting,
    },
    rarityInsights: {
      availableFilters: overrides.availableFilters ?? [{ id: "f1" }],
      isScanning: overrides.isScanning ?? false,
      lastScannedAt: overrides.lastScannedAt ?? null,
      scanFilters: mockScanFilters,
      selectFilter: mockSelectFilter,
      clearSelectedFilter: mockClearSelectedFilter,
      getLocalFilters: () => [],
      getOnlineFilters: () => [],
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardsActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockSetSearchQuery.mockClear();
    mockSetRarityFilter.mockClear();
    mockSetIncludeBossCards.mockClear();
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

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it('renders "Include boss cards" label text', () => {
      setupStore();
      renderWithProviders(<CardsActions />);

      expect(screen.getByText("Include boss cards")).toBeInTheDocument();
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

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("checkbox is checked when includeBossCards is true", () => {
      setupStore({ includeBossCards: true });
      renderWithProviders(<CardsActions />);

      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("calls setIncludeBossCards when checkbox is toggled on", async () => {
      setupStore({ includeBossCards: false });
      const { user } = renderWithProviders(<CardsActions />);

      await user.click(screen.getByRole("checkbox"));

      expect(mockSetIncludeBossCards).toHaveBeenCalledWith(true);
    });

    it("calls setIncludeBossCards when checkbox is toggled off", async () => {
      setupStore({ includeBossCards: true });
      const { user } = renderWithProviders(<CardsActions />);

      await user.click(screen.getByRole("checkbox"));

      expect(mockSetIncludeBossCards).toHaveBeenCalledWith(false);
    });

    it("calls onFilterChange when boss cards toggle changes", async () => {
      setupStore({ includeBossCards: false });
      const onFilterChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsActions onFilterChange={onFilterChange} />,
      );

      await user.click(screen.getByRole("checkbox"));

      expect(onFilterChange).toHaveBeenCalled();
    });
  });

  describe("filter scanning", () => {
    it("scans filters on mount when no filters are available", () => {
      setupStore({ availableFilters: [] });
      renderWithProviders(<CardsActions />);

      expect(mockScanFilters).toHaveBeenCalledTimes(1);
    });

    it("does not scan filters on mount when filters already exist", () => {
      setupStore({ availableFilters: [{ id: "f1" }] });
      renderWithProviders(<CardsActions />);

      expect(mockScanFilters).not.toHaveBeenCalled();
    });

    it("does not scan filters when already scanning", () => {
      setupStore({ availableFilters: [], isScanning: true });
      renderWithProviders(<CardsActions />);

      expect(mockScanFilters).not.toHaveBeenCalled();
    });

    it("does not re-scan when scan already completed with zero results", () => {
      setupStore({
        availableFilters: [],
        isScanning: false,
        lastScannedAt: "2025-01-01T00:00:00.000Z",
      });
      renderWithProviders(<CardsActions />);

      expect(mockScanFilters).not.toHaveBeenCalled();
    });

    it("disables rarity source select while scanning", () => {
      setupStore({ isScanning: true });
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("rarity-source-select")).toBeDisabled();
    });

    it("enables rarity source select when not scanning", () => {
      setupStore({ isScanning: false });
      renderWithProviders(<CardsActions />);

      expect(screen.getByTestId("rarity-source-select")).not.toBeDisabled();
    });
  });
});
