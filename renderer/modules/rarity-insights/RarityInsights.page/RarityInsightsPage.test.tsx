import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import RarityInsightsPage from "./RarityInsights.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("../RarityInsights.components/ComparisonTable/ComparisonTable", () => ({
  default: (_props: any) => <div data-testid="comparison-table" />,
}));

vi.mock(
  "../RarityInsights.components/ComparisonToolbar/ComparisonToolbar",
  () => ({
    default: () => <div data-testid="comparison-toolbar" />,
  }),
);

vi.mock(
  "../RarityInsights.components/RarityInsightsHeaderActions/RarityInsightsHeaderActions",
  () => ({
    default: () => <div data-testid="header-actions" />,
  }),
);

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle, actions }: any) => (
        <div data-testid="page-header">
          {title}
          {subtitle}
          {actions}
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: Record<string, any> = {}) {
  const base = {
    rarityInsights: {
      availableFilters: [{ id: "f1", name: "Filter1" }],
      isScanning: false,
      lastScannedAt: "2024-01-01",
      scanFilters: vi.fn(),
      ...overrides.rarityInsights,
    },
    cards: {
      isLoading: false,
      loadCards: vi.fn().mockResolvedValue(undefined),
      ...overrides.cards,
    },
    settings: {
      selectedFilterId: "f1",
      getSelectedGame: vi.fn(() => "poe1"),
      getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      ...overrides.settings,
    },
    rarityInsightsComparison: {
      selectedFilters: ["f1"],
      toggleFilter: vi.fn(),
      reset: vi.fn(),
      ...overrides.rarityInsightsComparison,
    },
    poeNinja: {
      isRefreshing: false,
      refreshError: null,
      checkRefreshStatus: vi.fn().mockResolvedValue(undefined),
      ...overrides.poeNinja,
    },
  };

  return base;
}

function setupStore(overrides: Record<string, any> = {}) {
  const mockState = createMockState(overrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  return mockState;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityInsightsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders page title 'Rarity Insights'", () => {
      setupStore();
      renderWithProviders(<RarityInsightsPage />);

      expect(screen.getByText("Rarity Insights")).toBeInTheDocument();
    });

    it("renders warning alert about filter rarity behavior", () => {
      setupStore();
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.getByText(
          /Changing a card's rarity here does not modify the filter files themselves/,
        ),
      ).toBeInTheDocument();
    });

    it("renders ComparisonTable stub", () => {
      setupStore();
      renderWithProviders(<RarityInsightsPage />);

      expect(screen.getByTestId("comparison-table")).toBeInTheDocument();
    });

    it("renders ComparisonToolbar stub", () => {
      setupStore();
      renderWithProviders(<RarityInsightsPage />);

      expect(screen.getByTestId("comparison-toolbar")).toBeInTheDocument();
    });

    it("renders header actions stub", () => {
      setupStore();
      renderWithProviders(<RarityInsightsPage />);

      expect(screen.getByTestId("header-actions")).toBeInTheDocument();
    });
  });

  // ── Loading states ─────────────────────────────────────────────────────

  describe("loading states", () => {
    it("shows cards loading overlay when isLoadingCards is true", () => {
      setupStore({ cards: { isLoading: true } });
      renderWithProviders(<RarityInsightsPage />);

      expect(screen.getByTestId("cards-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading cards...")).toBeInTheDocument();
    });

    it("does not show loading overlay when isLoadingCards is false", () => {
      setupStore({ cards: { isLoading: false } });
      renderWithProviders(<RarityInsightsPage />);

      expect(screen.queryByTestId("cards-loading")).not.toBeInTheDocument();
    });

    it("shows refreshing overlay when isRefreshing is true", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.getByText("Fetching poe.ninja prices..."),
      ).toBeInTheDocument();
    });

    it("shows refresh error banner with error text when refreshError is set", () => {
      setupStore({ poeNinja: { refreshError: "Network timeout" } });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.getByText(/Failed to fetch latest prices: Network timeout/),
      ).toBeInTheDocument();
    });

    it("does not show error banner when refreshError is null", () => {
      setupStore({ poeNinja: { refreshError: null } });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.queryByText(/Failed to fetch latest prices/),
      ).not.toBeInTheDocument();
    });
  });

  // ── Card count subtitle ────────────────────────────────────────────────

  describe("card count subtitle", () => {
    it("shows comparison count text when selectedFilters.length > 0 (plural)", () => {
      setupStore({
        rarityInsightsComparison: { selectedFilters: ["f1", "f2"] },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.getByText(/Comparing rarities across 2 filters/),
      ).toBeInTheDocument();
    });

    it("shows singular 'filter' when selectedFilters.length === 1", () => {
      setupStore({
        rarityInsightsComparison: { selectedFilters: ["f1"] },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.getByText(
          /Comparing rarities across 1 filter against other rarity sources/,
        ),
      ).toBeInTheDocument();
    });

    it("shows 'Select filters' text when selectedFilters.length === 0", () => {
      setupStore({
        rarityInsightsComparison: { selectedFilters: [] },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        screen.getByText(
          "Select filters to compare rarities against other rarity sources",
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Effects ────────────────────────────────────────────────────────────

  describe("effects", () => {
    it("calls checkRefreshStatus and loadCards on mount", async () => {
      const mockState = setupStore();
      renderWithProviders(<RarityInsightsPage />);

      await waitFor(() => {
        expect(mockState.poeNinja.checkRefreshStatus).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
        );
        expect(mockState.cards.loadCards).toHaveBeenCalled();
      });
    });

    it("calls scanFilters when availableFilters empty and not scanning and no lastScannedAt", () => {
      const mockState = setupStore({
        rarityInsights: {
          availableFilters: [],
          isScanning: false,
          lastScannedAt: null,
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.rarityInsights.scanFilters).toHaveBeenCalled();
    });

    it("does NOT call scanFilters when availableFilters are not empty", () => {
      const mockState = setupStore({
        rarityInsights: {
          availableFilters: [{ id: "f1", name: "Filter1" }],
          isScanning: false,
          lastScannedAt: null,
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.rarityInsights.scanFilters).not.toHaveBeenCalled();
    });

    it("does NOT call scanFilters when isScanning is true", () => {
      const mockState = setupStore({
        rarityInsights: {
          availableFilters: [],
          isScanning: true,
          lastScannedAt: null,
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.rarityInsights.scanFilters).not.toHaveBeenCalled();
    });

    it("does NOT call scanFilters when lastScannedAt is set", () => {
      const mockState = setupStore({
        rarityInsights: {
          availableFilters: [],
          isScanning: false,
          lastScannedAt: "2024-06-01",
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.rarityInsights.scanFilters).not.toHaveBeenCalled();
    });

    it("calls toggleFilter with selectedFilterId when selectedFilters is empty", () => {
      const mockState = setupStore({
        settings: { selectedFilterId: "f1" },
        rarityInsightsComparison: { selectedFilters: [] },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        mockState.rarityInsightsComparison.toggleFilter,
      ).toHaveBeenCalledWith("f1");
    });

    it("does NOT call toggleFilter when selectedFilters already has items", () => {
      const mockState = setupStore({
        settings: { selectedFilterId: "f1" },
        rarityInsightsComparison: { selectedFilters: ["f1"] },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(
        mockState.rarityInsightsComparison.toggleFilter,
      ).not.toHaveBeenCalled();
    });

    it("calls reset on unmount", () => {
      const mockState = setupStore();
      const { unmount } = renderWithProviders(<RarityInsightsPage />);

      expect(mockState.rarityInsightsComparison.reset).not.toHaveBeenCalled();

      unmount();

      expect(mockState.rarityInsightsComparison.reset).toHaveBeenCalled();
    });
  });

  // ── No league ──────────────────────────────────────────────────────────

  describe("no league", () => {
    it("does not call checkRefreshStatus when league is null", () => {
      const mockState = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => null),
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.poeNinja.checkRefreshStatus).not.toHaveBeenCalled();
    });

    it("does not call loadCards when league is null", () => {
      const mockState = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => null),
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.cards.loadCards).not.toHaveBeenCalled();
    });

    it("does not call checkRefreshStatus when league is undefined", () => {
      const mockState = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => undefined),
        },
      });
      renderWithProviders(<RarityInsightsPage />);

      expect(mockState.poeNinja.checkRefreshStatus).not.toHaveBeenCalled();
    });
  });
});
