import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { trackEvent } from "~/renderer/modules/umami";
import {
  useProhibitedLibrary,
  useRarityInsights,
  useSettings,
} from "~/renderer/store";

import FilterSettingsCard from "./FilterSettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSettings: vi.fn(),
  useRarityInsights: vi.fn(),
  useProhibitedLibrary: vi.fn(),
}));

const mockUseSettings = vi.mocked(useSettings);
const mockUseRarityInsights = vi.mocked(useRarityInsights);
const mockUseProhibitedLibrary = vi.mocked(useProhibitedLibrary);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {loading ? "Loading..." : children}
    </button>
  ),
}));

vi.mock("../ProhibitedLibraryStatusBlock/ProhibitedLibraryStatusBlock", () => ({
  default: () => <div data-testid="pl-status" />,
}));

vi.mock("~/renderer/utils", () => ({
  decodeRaritySourceValue: vi.fn((v: string) => {
    if (v.startsWith("filter:")) {
      return { raritySource: "filter", filterId: v.split(":")[1] };
    }
    return { raritySource: v, filterId: null };
  }),
  encodeRaritySourceValue: vi.fn((source: string, filterId: any) =>
    filterId ? `filter:${filterId}` : source,
  ),
  getAnalyticsRaritySource: vi.fn(() => "poe.ninja"),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

const mockTrackEvent = vi.mocked(trackEvent);

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiRefreshCw: () => <span data-testid="icon-refresh" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  const mockScanFilters = vi.fn().mockResolvedValue(undefined);
  const mockSelectFilter = vi.fn().mockResolvedValue(undefined);
  const mockClearSelectedFilter = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);
  const mockFetchPlStatus = vi.fn().mockResolvedValue(undefined);

  return {
    settings: {
      raritySource: "poe.ninja",
      selectedFilterId: null,
      updateSetting: mockUpdateSetting,
      ...overrides.settings,
    },
    rarityInsights: {
      availableFilters: [],
      isScanning: false,
      isParsing: false,
      scanError: null,
      scanFilters: mockScanFilters,
      selectFilter: mockSelectFilter,
      clearSelectedFilter: mockClearSelectedFilter,
      getLocalFilters: () => [],
      getOnlineFilters: () => [],
      ...overrides.rarityInsights,
    },
    prohibitedLibrary: {
      fetchStatus: mockFetchPlStatus,
      ...overrides.prohibitedLibrary,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);

  mockUseSettings.mockReturnValue(store.settings);
  mockUseRarityInsights.mockReturnValue(store.rarityInsights);
  mockUseProhibitedLibrary.mockReturnValue(store.prohibitedLibrary);

  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("FilterSettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Rarity Source" title', () => {
    renderWithProviders(<FilterSettingsCard />);

    expect(
      screen.getByRole("heading", { name: /Rarity Source/i }),
    ).toBeInTheDocument();
  });

  it("renders source dropdown with poe.ninja and Prohibited Library options", () => {
    renderWithProviders(<FilterSettingsCard />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("poe.ninja (price-based)");
    expect(optionTexts).toContain("Prohibited Library (weight-based)");
  });

  it("renders Rescan button", () => {
    renderWithProviders(<FilterSettingsCard />);

    expect(screen.getByRole("button", { name: /Rescan/i })).toBeInTheDocument();
  });

  // ── Rescan interactions ────────────────────────────────────────────────

  it("Rescan button calls scanFilters()", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<FilterSettingsCard />);

    const rescanButton = screen.getByRole("button", { name: /Rescan/i });
    await user.click(rescanButton);

    await waitFor(() => {
      expect(store.rarityInsights.scanFilters).toHaveBeenCalledTimes(1);
    });
  });

  it("Rescan button is disabled when scanning", () => {
    setupStore({
      rarityInsights: {
        isScanning: true,
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    const rescanButton = screen.getByRole("button", { name: /Loading/i });
    expect(rescanButton).toBeDisabled();
  });

  // ── Scan error ─────────────────────────────────────────────────────────

  it("shows scan error when scanError exists", () => {
    setupStore({
      rarityInsights: {
        scanError: "Failed to read filter directory",
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    expect(
      screen.getByText("Failed to read filter directory"),
    ).toBeInTheDocument();
  });

  // ── No filters warning ────────────────────────────────────────────────

  it('shows "No filters found" warning when no filters available', () => {
    setupStore({
      rarityInsights: {
        availableFilters: [],
        isScanning: false,
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    expect(screen.getByText(/No filters found/i)).toBeInTheDocument();
  });

  // ── Filter count ──────────────────────────────────────────────────────

  it("shows filter count when filters exist", () => {
    setupStore({
      rarityInsights: {
        availableFilters: [
          { id: "f1", name: "Filter 1" },
          { id: "f2", name: "Filter 2" },
          { id: "f3", name: "Filter 3" },
        ],
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    expect(screen.getByText("3 filters available")).toBeInTheDocument();
  });

  it("shows singular filter count when exactly one filter exists", () => {
    setupStore({
      rarityInsights: {
        availableFilters: [{ id: "f1", name: "Filter 1" }],
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    expect(screen.getByText("1 filter available")).toBeInTheDocument();
  });

  // ── Prohibited Library status block ────────────────────────────────────

  it('shows PL status block when raritySource === "prohibited-library"', () => {
    setupStore({
      settings: {
        raritySource: "prohibited-library",
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    expect(screen.getByTestId("pl-status")).toBeInTheDocument();
  });

  it("hides PL status block when using other source", () => {
    setupStore({
      settings: {
        raritySource: "poe.ninja",
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    expect(screen.queryByTestId("pl-status")).not.toBeInTheDocument();
  });

  // ── fetchPlStatus on mount ─────────────────────────────────────────────

  it("calls fetchPlStatus() on mount", () => {
    const store = setupStore();

    renderWithProviders(<FilterSettingsCard />);

    expect(store.prohibitedLibrary.fetchStatus).toHaveBeenCalledTimes(1);
  });

  // ── handleDropdownChange ───────────────────────────────────────────────

  describe("handleDropdownChange", () => {
    it('switching to poe.ninja calls updateSetting("raritySource", "poe.ninja")', async () => {
      const store = setupStore({
        settings: {
          raritySource: "prohibited-library",
          selectedFilterId: null,
        },
      });

      renderWithProviders(<FilterSettingsCard />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "poe.ninja" } });

      await waitFor(() => {
        expect(store.settings.updateSetting).toHaveBeenCalledWith(
          "raritySource",
          "poe.ninja",
        );
      });
    });

    it('switching to prohibited-library calls updateSetting("raritySource", "prohibited-library")', async () => {
      const store = setupStore({
        settings: { raritySource: "poe.ninja", selectedFilterId: null },
      });

      renderWithProviders(<FilterSettingsCard />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "prohibited-library" } });

      await waitFor(() => {
        expect(store.settings.updateSetting).toHaveBeenCalledWith(
          "raritySource",
          "prohibited-library",
        );
      });
    });

    it("switching to a filter calls selectFilter and updateSetting with filter id", async () => {
      const store = setupStore({
        settings: { raritySource: "poe.ninja", selectedFilterId: null },
        rarityInsights: {
          availableFilters: [{ id: "f1", name: "My Filter" }],
          getOnlineFilters: () => [
            { id: "f1", name: "My Filter", isOutdated: false },
          ],
        },
      });

      renderWithProviders(<FilterSettingsCard />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "filter:f1" } });

      await waitFor(() => {
        expect(store.settings.updateSetting).toHaveBeenCalledWith(
          "raritySource",
          "filter",
        );
        expect(store.rarityInsights.selectFilter).toHaveBeenCalledWith("f1");
        expect(store.settings.updateSetting).toHaveBeenCalledWith(
          "selectedFilterId",
          "f1",
        );
      });
    });

    it("switching from filter to non-filter clears filter selection", async () => {
      const store = setupStore({
        settings: { raritySource: "filter", selectedFilterId: "f1" },
        rarityInsights: {
          availableFilters: [{ id: "f1", name: "My Filter" }],
          getOnlineFilters: () => [
            { id: "f1", name: "My Filter", isOutdated: false },
          ],
        },
      });

      renderWithProviders(<FilterSettingsCard />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "poe.ninja" } });

      await waitFor(() => {
        expect(store.rarityInsights.clearSelectedFilter).toHaveBeenCalledTimes(
          1,
        );
        expect(store.settings.updateSetting).toHaveBeenCalledWith(
          "selectedFilterId",
          null,
        );
      });
    });

    it("switching between non-filter sources does not call clearSelectedFilter", async () => {
      const store = setupStore({
        settings: { raritySource: "poe.ninja", selectedFilterId: null },
      });

      renderWithProviders(<FilterSettingsCard />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "prohibited-library" } });

      await waitFor(() => {
        expect(store.settings.updateSetting).toHaveBeenCalledWith(
          "raritySource",
          "prohibited-library",
        );
      });

      expect(store.rarityInsights.clearSelectedFilter).not.toHaveBeenCalled();
    });
  });

  // ── trackEvent ─────────────────────────────────────────────────────────

  it("trackEvent is called when dropdown changes", async () => {
    setupStore({
      settings: { raritySource: "poe.ninja", selectedFilterId: null },
    });

    renderWithProviders(<FilterSettingsCard />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "prohibited-library" } });

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith("settings-change", {
        setting: "raritySource",
        value: "poe.ninja", // mocked getAnalyticsRaritySource always returns "poe.ninja"
      });
    });
  });

  it("trackEvent is called with filter-scan when rescan is clicked", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<FilterSettingsCard />);

    const rescanButton = screen.getByRole("button", { name: /Rescan/i });
    await user.click(rescanButton);

    await waitFor(() => {
      expect(store.rarityInsights.scanFilters).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledWith("filter-scan");
    });
  });

  // ── Online / Local filter option rendering ─────────────────────────────

  it("renders online filter options from getOnlineFilters()", () => {
    setupStore({
      rarityInsights: {
        availableFilters: [
          { id: "on1", name: "Online Filter 1" },
          { id: "on2", name: "Online Filter 2" },
        ],
        getOnlineFilters: () => [
          { id: "on1", name: "Online Filter 1", isOutdated: false },
          { id: "on2", name: "Online Filter 2", isOutdated: true },
        ],
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Online Filter 1");
    expect(optionTexts).toContain("Online Filter 2 (outdated)");
  });

  it("renders local filter options from getLocalFilters()", () => {
    setupStore({
      rarityInsights: {
        availableFilters: [{ id: "loc1", name: "Local Filter A" }],
        getLocalFilters: () => [
          { id: "loc1", name: "Local Filter A", isOutdated: false },
        ],
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Local Filter A");
  });

  // ── Dropdown disabled state ────────────────────────────────────────────

  it("dropdown is disabled when isParsing is true", () => {
    setupStore({
      rarityInsights: {
        isParsing: true,
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    const select = screen.getByRole("combobox");
    expect(select).toBeDisabled();
  });

  it("dropdown is enabled when isParsing is false", () => {
    setupStore({
      rarityInsights: {
        isParsing: false,
      },
    });

    renderWithProviders(<FilterSettingsCard />);

    const select = screen.getByRole("combobox");
    expect(select).not.toBeDisabled();
  });
});
