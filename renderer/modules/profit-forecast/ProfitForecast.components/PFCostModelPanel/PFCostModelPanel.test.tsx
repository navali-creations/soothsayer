import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { RATE_FLOOR } from "../../ProfitForecast.slice/ProfitForecast.slice";
import PFCostModelPanel from "./PFCostModelPanel";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: any = {}) {
  return {
    profitForecast: {
      selectedBatch: 1000,
      forecastView: "chart" as "chart" | "table",
      stepDrop: 2,
      subBatchSize: 5000,
      minPriceThreshold: 10,
      customBaseRate: null as number | null,
      stackedDeckChaosCost: 5,
      isLoading: false,
      setSelectedBatch: vi.fn(),
      setForecastView: vi.fn(),
      setStepDrop: vi.fn(),
      setSubBatchSize: vi.fn(),
      setMinPriceThreshold: vi.fn(),
      setIsComputing: vi.fn(),
      getEffectiveBaseRate: vi.fn(() => 100),
      getExcludedCount: vi.fn(() => ({
        anomalous: 0,
        lowConfidence: 0,
        total: 0,
      })),
      hasData: vi.fn(() => true),
      ...overrides.profitForecast,
    },
    poeNinja: {
      isRefreshing: false,
      ...overrides.poeNinja,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const state = createMockState(overrides);
  mockUseBoundStore.mockReturnValue(state);
  return state;
}

function renderPanel(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFCostModelPanel />);
  return { state, ...result };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFCostModelPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Composition — sub-components are rendered ────────────────────────

  describe("Composition", () => {
    it("renders the batch size section", () => {
      renderPanel();
      expect(screen.getByText("Decks to open")).toBeInTheDocument();
    });

    it("renders the view toggle section", () => {
      renderPanel();
      expect(screen.getByText("View")).toBeInTheDocument();
    });

    it("renders the step drop slider section", () => {
      renderPanel();
      expect(screen.getByText("Price increase per batch")).toBeInTheDocument();
    });

    it("renders the sub-batch slider section", () => {
      renderPanel();
      expect(screen.getByText("Batch size")).toBeInTheDocument();
    });

    it("renders the min price filter section", () => {
      renderPanel();
      expect(screen.getByText("Min price filter")).toBeInTheDocument();
    });

    it("has the pf-cost-model onboarding data attribute", () => {
      const { container } = renderPanel();
      expect(
        container.querySelector("[data-onboarding='pf-cost-model']"),
      ).toBeInTheDocument();
    });
  });

  // ── Rate clamped notice ──────────────────────────────────────────────

  describe("Rate clamped notice", () => {
    it("shows rate clamped info when effectiveRate equals RATE_FLOOR", () => {
      renderPanel({
        profitForecast: {
          getEffectiveBaseRate: vi.fn(() => RATE_FLOOR),
        },
      });

      expect(screen.getByText(/Rate clamped to minimum/i)).toBeInTheDocument();
    });

    it("does not show rate clamped when effectiveRate > RATE_FLOOR", () => {
      renderPanel({
        profitForecast: {
          getEffectiveBaseRate: vi.fn(() => 100),
        },
      });

      expect(
        screen.queryByText(/Rate clamped to minimum/i),
      ).not.toBeInTheDocument();
    });

    it("does not show rate clamped when effectiveRate is 0", () => {
      renderPanel({
        profitForecast: {
          getEffectiveBaseRate: vi.fn(() => 0),
        },
      });

      expect(
        screen.queryByText(/Rate clamped to minimum/i),
      ).not.toBeInTheDocument();
    });

    it("does not show rate clamped when custom rate is active (even if effectiveRate equals RATE_FLOOR)", () => {
      renderPanel({
        profitForecast: {
          customBaseRate: 50,
          getEffectiveBaseRate: vi.fn(() => RATE_FLOOR),
        },
      });

      expect(
        screen.queryByText(/Rate clamped to minimum/i),
      ).not.toBeInTheDocument();
    });

    it("includes the RATE_FLOOR value in the message", () => {
      renderPanel({
        profitForecast: {
          getEffectiveBaseRate: vi.fn(() => RATE_FLOOR),
        },
      });

      expect(
        screen.getByText(new RegExp(`${RATE_FLOOR} decks/div`)),
      ).toBeInTheDocument();
    });
  });

  // ── Excluded cards section visibility ────────────────────────────────

  describe("Excluded cards section", () => {
    it("does not show excluded section when total is 0", () => {
      renderPanel({
        profitForecast: {
          getExcludedCount: vi.fn(() => ({
            anomalous: 0,
            lowConfidence: 0,
            total: 0,
          })),
        },
      });

      expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
    });

    it("shows excluded section when there are excluded cards", () => {
      renderPanel({
        profitForecast: {
          getExcludedCount: vi.fn(() => ({
            anomalous: 3,
            lowConfidence: 0,
            total: 3,
          })),
        },
      });

      expect(screen.getByText("Excluded from EV")).toBeInTheDocument();
    });

    it("does not show excluded section when not dataAvailable (hasData false)", () => {
      renderPanel({
        profitForecast: {
          hasData: vi.fn(() => false),
          getExcludedCount: vi.fn(() => ({
            anomalous: 3,
            lowConfidence: 2,
            total: 5,
          })),
        },
      });

      expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
    });

    it("does not show excluded section when isLoading", () => {
      renderPanel({
        profitForecast: {
          isLoading: true,
          hasData: vi.fn(() => true),
          getExcludedCount: vi.fn(() => ({
            anomalous: 3,
            lowConfidence: 2,
            total: 5,
          })),
        },
      });

      expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
    });
  });
});
