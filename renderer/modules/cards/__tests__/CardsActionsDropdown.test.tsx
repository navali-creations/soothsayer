import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";

import { CardsActions } from "../Cards.components/CardsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/modules/umami", () => ({
  initUmami: vi.fn(),
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

const mockTrackEvent = vi.mocked(trackEvent);

// Mock RaritySourceSelect so we can trigger onChange with specific values
// and inspect the groups prop that was passed in.
vi.mock("~/renderer/components", () => ({
  RaritySourceSelect: ({ value, onChange, groups }: any) => (
    <div data-testid="rarity-source-select">
      <select
        data-testid="rarity-dropdown"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
      >
        <option value="poe.ninja">poe.ninja</option>
        <option value="prohibited-library">Prohibited Library</option>
        <option value="filter:f1">Filter F1</option>
        <option value="filter:f2">Filter F2</option>
      </select>
      <span data-testid="groups-json">
        {JSON.stringify(
          groups?.map((g: any) => ({
            label: g.label,
            optCount: g.options?.length,
            hasAction: !!g.action,
            actionLabel: g.action?.label,
          })),
        )}
      </span>
    </div>
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

vi.mock("~/renderer/utils", () => ({
  decodeRaritySourceValue: vi.fn((value: string) => {
    if (value.startsWith("filter:")) {
      return { raritySource: "filter", filterId: value.replace("filter:", "") };
    }
    return { raritySource: value, filterId: null };
  }),
  encodeRaritySourceValue: vi.fn((source: string, filterId: string | null) =>
    filterId ? `filter:${filterId}` : source,
  ),
  getAnalyticsRaritySource: vi.fn(() => "test-analytics-source"),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockSetSearchQuery = vi.fn();
const mockSetRarityFilter = vi.fn();
const mockSetIncludeBossCards = vi.fn();
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
    raritySource?: string;
    selectedFilterId?: string | null;
    availableFilters?: any[];
    isScanning?: boolean;
    lastScannedAt?: string | null;
    localFilters?: any[];
    onlineFilters?: any[];
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
      lastScannedAt:
        "lastScannedAt" in overrides
          ? overrides.lastScannedAt
          : new Date().toISOString(),
      scanFilters: mockScanFilters,
      selectFilter: mockSelectFilter,
      clearSelectedFilter: mockClearSelectedFilter,
      getLocalFilters: () => overrides.localFilters ?? [],
      getOnlineFilters: () => overrides.onlineFilters ?? [],
    },
  } as any);
}

function clearMocks() {
  mockSetSearchQuery.mockClear();
  mockSetRarityFilter.mockClear();
  mockSetIncludeBossCards.mockClear();
  mockLoadCards.mockClear();
  mockScanFilters.mockClear();
  mockSelectFilter.mockClear();
  mockClearSelectedFilter.mockClear();
  mockUpdateSetting.mockClear();
  mockTrackEvent.mockClear();
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardsActions – handleDropdownChange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearMocks();
  });

  it("selecting poe.ninja calls updateSetting, tracks event, and calls loadCards", async () => {
    setupStore({ raritySource: "prohibited-library", selectedFilterId: null });
    const { user } = renderWithProviders(<CardsActions />);

    const dropdown = screen.getByTestId("rarity-dropdown");
    await user.selectOptions(dropdown, "poe.ninja");

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "raritySource",
        "poe.ninja",
      );
    });
    expect(mockTrackEvent).toHaveBeenCalledWith("settings-change", {
      setting: "raritySource",
      value: "test-analytics-source",
    });
    expect(mockLoadCards).toHaveBeenCalled();
  });

  it("selecting a filter calls selectFilter and updateSetting with the filter id", async () => {
    setupStore({ raritySource: "poe.ninja", selectedFilterId: null });
    const { user } = renderWithProviders(<CardsActions />);

    const dropdown = screen.getByTestId("rarity-dropdown");
    await user.selectOptions(dropdown, "filter:f1");

    await waitFor(() => {
      expect(mockSelectFilter).toHaveBeenCalledWith("f1");
    });
    expect(mockUpdateSetting).toHaveBeenCalledWith("raritySource", "filter");
    expect(mockUpdateSetting).toHaveBeenCalledWith("selectedFilterId", "f1");
    expect(mockLoadCards).toHaveBeenCalled();
  });

  it("switching from filter to poe.ninja when selectedFilterId exists calls clearSelectedFilter", async () => {
    setupStore({ raritySource: "filter", selectedFilterId: "f1" });
    const { user } = renderWithProviders(<CardsActions />);

    const dropdown = screen.getByTestId("rarity-dropdown");
    await user.selectOptions(dropdown, "poe.ninja");

    await waitFor(() => {
      expect(mockClearSelectedFilter).toHaveBeenCalled();
    });
    expect(mockUpdateSetting).toHaveBeenCalledWith("selectedFilterId", null);
  });

  it("switching from poe.ninja to poe.ninja without selectedFilterId does NOT call clearSelectedFilter", async () => {
    setupStore({ raritySource: "poe.ninja", selectedFilterId: null });
    const { user } = renderWithProviders(<CardsActions />);

    const dropdown = screen.getByTestId("rarity-dropdown");
    await user.selectOptions(dropdown, "poe.ninja");

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "raritySource",
        "poe.ninja",
      );
    });
    expect(mockClearSelectedFilter).not.toHaveBeenCalled();
  });

  it("calls onFilterChange callback after completing dropdown change", async () => {
    setupStore({ raritySource: "poe.ninja", selectedFilterId: null });
    const onFilterChange = vi.fn();
    const { user } = renderWithProviders(
      <CardsActions onFilterChange={onFilterChange} />,
    );

    const dropdown = screen.getByTestId("rarity-dropdown");
    await user.selectOptions(dropdown, "prohibited-library");

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalled();
    });
  });
});

describe("CardsActions – groups useMemo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearMocks();
  });

  it("renders 2 groups: Dataset Driven and Loot Filters", () => {
    setupStore();
    renderWithProviders(<CardsActions />);

    const groupsJson = screen.getByTestId("groups-json").textContent;
    const groups = JSON.parse(groupsJson!);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Dataset Driven");
    expect(groups[1].label).toBe("Loot Filters");
  });

  it("Dataset Driven group has 2 options (poe.ninja and Prohibited Library)", () => {
    setupStore();
    renderWithProviders(<CardsActions />);

    const groupsJson = screen.getByTestId("groups-json").textContent;
    const groups = JSON.parse(groupsJson!);

    expect(groups[0].optCount).toBe(2);
  });

  it("Loot Filters group has scan action when needsScan (no lastScannedAt and not scanning)", () => {
    setupStore({ lastScannedAt: null, isScanning: false });
    renderWithProviders(<CardsActions />);

    const groupsJson = screen.getByTestId("groups-json").textContent;
    const groups = JSON.parse(groupsJson!);
    const lootFiltersGroup = groups[1];

    expect(lootFiltersGroup.hasAction).toBe(true);
    expect(lootFiltersGroup.actionLabel).toBe("Scan for filters");
  });

  it("Loot Filters group shows scanning action when isScanning", () => {
    setupStore({ isScanning: true, lastScannedAt: "2024-01-01T00:00:00Z" });
    renderWithProviders(<CardsActions />);

    const groupsJson = screen.getByTestId("groups-json").textContent;
    const groups = JSON.parse(groupsJson!);
    const lootFiltersGroup = groups[1];

    expect(lootFiltersGroup.hasAction).toBe(true);
    expect(lootFiltersGroup.actionLabel).toBe("Scanning...");
  });

  it("Loot Filters group shows rescan action when scanned but no filters found", () => {
    setupStore({
      lastScannedAt: "2024-01-01T00:00:00Z",
      isScanning: false,
      localFilters: [],
      onlineFilters: [],
    });
    renderWithProviders(<CardsActions />);

    const groupsJson = screen.getByTestId("groups-json").textContent;
    const groups = JSON.parse(groupsJson!);
    const lootFiltersGroup = groups[1];

    expect(lootFiltersGroup.hasAction).toBe(true);
    expect(lootFiltersGroup.actionLabel).toBe("Rescan filters");
  });

  it("includes filter options from local and online filters", () => {
    setupStore({
      lastScannedAt: "2024-01-01T00:00:00Z",
      isScanning: false,
      localFilters: [
        { id: "local-1", name: "My Local Filter", isOutdated: false },
      ],
      onlineFilters: [
        { id: "online-1", name: "Community Filter", isOutdated: true },
      ],
    });
    renderWithProviders(<CardsActions />);

    const groupsJson = screen.getByTestId("groups-json").textContent;
    const groups = JSON.parse(groupsJson!);
    const lootFiltersGroup = groups[1];

    // 1 online + 1 local = 2 options
    expect(lootFiltersGroup.optCount).toBe(2);
  });
});
