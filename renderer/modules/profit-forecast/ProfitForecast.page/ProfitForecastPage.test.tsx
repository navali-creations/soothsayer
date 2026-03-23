import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import ProfitForecastPage from "./ProfitForecast.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/hooks", () => ({
  useDebounce: vi.fn(() => "debounced"),
}));

vi.mock(
  "../ProfitForecast.components/PFCostModelPanel/PFCostModelPanel",
  () => ({
    default: (props: any) => (
      <div data-testid="cost-model-panel" data-batch={props.selectedBatch} />
    ),
  }),
);

vi.mock("../ProfitForecast.components/PFHeaderActions/PFHeaderActions", () => ({
  default: (_props: any) => <div data-testid="header-actions" />,
}));

vi.mock("../ProfitForecast.components/PFSummaryCards/PFSummaryCards", () => ({
  default: () => <div data-testid="summary-cards" />,
}));

vi.mock("../ProfitForecast.components/PFTable", () => ({
  PFTable: (_props: any) => <div data-testid="pf-table" />,
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, actions }: any) => (
        <div data-testid="page-header">
          {title}
          {actions}
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: any = {}) {
  return {
    settings: {
      getSelectedGame: vi.fn(() => "poe1"),
      getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      ...overrides.settings,
    },
    poeNinja: {
      isRefreshing: false,
      checkRefreshStatus: vi.fn(),
      ...overrides.poeNinja,
    },
    profitForecast: {
      rows: [],
      snapshotFetchedAt: "2024-01-01",
      isLoading: false,
      error: null,
      selectedBatch: 1000,
      stepDrop: 2,
      subBatchSize: 5000,
      setSelectedBatch: vi.fn(),
      setStepDrop: vi.fn(),
      setSubBatchSize: vi.fn(),
      setIsComputing: vi.fn(),
      fetchData: vi.fn(),
      recomputeRows: vi.fn(),
      hasData: vi.fn(() => true),
      ...overrides.profitForecast,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const state = createMockState(overrides);
  mockUseBoundStore.mockReturnValue(state);
  return state;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ProfitForecastPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering states ─────────────────────────────────────────────────

  describe("Rendering states", () => {
    it("renders page title 'Profit Forecast'", () => {
      setupStore();
      renderWithProviders(<ProfitForecastPage />);

      expect(screen.getByText("Profit Forecast")).toBeInTheDocument();
    });

    it("shows loading spinner when isLoading is true", () => {
      setupStore({ profitForecast: { isLoading: true } });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.getByText("Loading profit forecast data..."),
      ).toBeInTheDocument();
    });

    it("hides main content (summary cards, table) when isLoading is true", () => {
      setupStore({ profitForecast: { isLoading: true } });
      renderWithProviders(<ProfitForecastPage />);

      expect(screen.queryByTestId("summary-cards")).not.toBeInTheDocument();
      expect(screen.queryByTestId("pf-table")).not.toBeInTheDocument();
    });

    it("shows error alert with error message when error is set", () => {
      setupStore({
        profitForecast: { error: "Something went wrong" },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("shows retry button in error state that calls fetchData", async () => {
      const state = setupStore({
        profitForecast: { error: "Network error" },
      });
      const { user } = renderWithProviders(<ProfitForecastPage />);

      const retryButton = screen.getByRole("button", { name: /Retry/i });
      expect(retryButton).toBeInTheDocument();

      await user.click(retryButton);

      expect(state.profitForecast.fetchData).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
    });

    it("shows no-snapshot alert when snapshotFetchedAt is null and not loading/error", () => {
      setupStore({
        profitForecast: {
          snapshotFetchedAt: null,
          isLoading: false,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.getByText(/No price data for this league yet/i),
      ).toBeInTheDocument();
    });

    it("shows no-PL-weights alert when rows empty, snapshotFetchedAt set, not loading/error", () => {
      setupStore({
        profitForecast: {
          rows: [],
          snapshotFetchedAt: "2024-01-01",
          isLoading: false,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.getByText(/No Prohibited Library data loaded/i),
      ).toBeInTheDocument();
    });

    it("shows refreshing info alert when isRefreshing is true", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.getByText(/Fetching latest prices from poe\.ninja/i),
      ).toBeInTheDocument();
    });

    it("shows refreshing overlay on summary cards when isRefreshing and not loading", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      const { container } = renderWithProviders(<ProfitForecastPage />);

      // Summary cards should still be rendered (not loading)
      expect(screen.getByTestId("summary-cards")).toBeInTheDocument();

      // The overlay div with backdrop-blur is rendered over the summary cards
      const overlays = container.querySelectorAll(".backdrop-blur-sm");
      expect(overlays.length).toBeGreaterThanOrEqual(1);
    });

    it("shows exchange model disclaimer always", () => {
      setupStore();
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.getByText(/This model assumes listings get more expensive/i),
      ).toBeInTheDocument();
    });
  });

  // ── Main content rendering ───────────────────────────────────────────

  describe("Main content rendering (not loading, has data)", () => {
    it("renders PFSummaryCards stub", () => {
      setupStore({
        profitForecast: {
          rows: [{ name: "The Doctor" }],
          isLoading: false,
          hasData: vi.fn(() => true),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(screen.getByTestId("summary-cards")).toBeInTheDocument();
    });

    it("renders PFCostModelPanel stub with correct selectedBatch prop", () => {
      setupStore({
        profitForecast: {
          rows: [{ name: "The Doctor" }],
          isLoading: false,
          selectedBatch: 10000,
          hasData: vi.fn(() => true),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      const panel = screen.getByTestId("cost-model-panel");
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute("data-batch", "10000");
    });

    it("renders PFTable stub", () => {
      setupStore({
        profitForecast: {
          rows: [{ name: "The Doctor" }],
          isLoading: false,
          hasData: vi.fn(() => true),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(screen.getByTestId("pf-table")).toBeInTheDocument();
    });

    it("renders disclaimer warning alert", () => {
      setupStore({
        profitForecast: {
          rows: [{ name: "The Doctor" }],
          isLoading: false,
          hasData: vi.fn(() => true),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.getByText(/check the exchange manually and adjust the sliders/i),
      ).toBeInTheDocument();
    });
  });

  // ── Effects ──────────────────────────────────────────────────────────

  describe("Effects", () => {
    it("calls checkRefreshStatus on mount with game and league", () => {
      const state = setupStore();
      renderWithProviders(<ProfitForecastPage />);

      expect(state.poeNinja.checkRefreshStatus).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
    });

    it("calls fetchData on mount with game and league", () => {
      const state = setupStore();
      renderWithProviders(<ProfitForecastPage />);

      expect(state.profitForecast.fetchData).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
    });

    it("does not call fetchData when league is null", () => {
      const state = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => null),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(state.profitForecast.fetchData).not.toHaveBeenCalled();
    });

    it("does not call fetchData when league is undefined", () => {
      const state = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => undefined),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(state.profitForecast.fetchData).not.toHaveBeenCalled();
    });

    it("does not call checkRefreshStatus when league is null", () => {
      const state = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => null),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(state.poeNinja.checkRefreshStatus).not.toHaveBeenCalled();
    });

    it("does not call checkRefreshStatus when league is undefined", () => {
      const state = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => undefined),
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(state.poeNinja.checkRefreshStatus).not.toHaveBeenCalled();
    });
  });

  // ── No league ────────────────────────────────────────────────────────

  describe("No league", () => {
    it("renders normally even without league (effects skip)", () => {
      setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => null),
        },
        profitForecast: {
          snapshotFetchedAt: null,
          isLoading: false,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      // Page title should still render
      expect(screen.getByText("Profit Forecast")).toBeInTheDocument();
      // Disclaimer is always shown
      expect(
        screen.getByText(/This model assumes listings get more expensive/i),
      ).toBeInTheDocument();
    });
  });

  // ── Conditional alert exclusion ──────────────────────────────────────

  describe("Conditional alert exclusion", () => {
    it("does not show no-snapshot alert when snapshotFetchedAt is set", () => {
      setupStore({
        profitForecast: {
          snapshotFetchedAt: "2024-01-01",
          isLoading: false,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.queryByText(/No price data for this league yet/i),
      ).not.toBeInTheDocument();
    });

    it("does not show no-snapshot alert when isLoading is true even if snapshotFetchedAt is null", () => {
      setupStore({
        profitForecast: {
          snapshotFetchedAt: null,
          isLoading: true,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.queryByText(/No price data for this league yet/i),
      ).not.toBeInTheDocument();
    });

    it("does not show no-PL-weights alert when snapshotFetchedAt is null (no-snapshot takes precedence)", () => {
      setupStore({
        profitForecast: {
          rows: [],
          snapshotFetchedAt: null,
          isLoading: false,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      // snapshotIsNull is true, which suppresses plWeightsEmpty alert
      expect(
        screen.queryByText(/No Prohibited Library data loaded/i),
      ).not.toBeInTheDocument();
    });

    it("does not show no-PL-weights alert when rows have data", () => {
      setupStore({
        profitForecast: {
          rows: [{ name: "The Doctor" }],
          snapshotFetchedAt: "2024-01-01",
          isLoading: false,
          error: null,
        },
      });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.queryByText(/No Prohibited Library data loaded/i),
      ).not.toBeInTheDocument();
    });

    it("does not show refreshing alert when isRefreshing is false", () => {
      setupStore({ poeNinja: { isRefreshing: false } });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.queryByText(/Fetching latest prices from poe\.ninja/i),
      ).not.toBeInTheDocument();
    });

    it("does not show error alert when error is null", () => {
      setupStore({ profitForecast: { error: null } });
      renderWithProviders(<ProfitForecastPage />);

      expect(
        screen.queryByRole("button", { name: /Retry/i }),
      ).not.toBeInTheDocument();
    });
  });
});
