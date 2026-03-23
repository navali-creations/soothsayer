import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFCostModelPanel from "../ProfitForecast.components/PFCostModelPanel";
import { RATE_FLOOR } from "../ProfitForecast.slice";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: any = {}) {
  return {
    profitForecast: {
      baseRate: 100,
      stackedDeckChaosCost: 5,
      stepDrop: 2,
      subBatchSize: 5000,
      minPriceThreshold: 10,
      setMinPriceThreshold: vi.fn(),
      getExcludedCount: vi.fn(() => ({
        anomalous: 0,
        lowConfidence: 0,
        total: 0,
      })),
      isLoading: false,
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

const defaultProps = {
  selectedBatch: 1000 as const,
  onBatchChange: vi.fn(),
  onStepDropChange: vi.fn(),
  onSubBatchSizeChange: vi.fn(),
};

function renderPanel(
  propOverrides: Partial<typeof defaultProps> = {},
  storeOverrides: any = {},
) {
  const state = setupStore(storeOverrides);
  const props = { ...defaultProps, ...propOverrides };
  // Reset prop mocks for each render
  props.onBatchChange = propOverrides.onBatchChange ?? vi.fn();
  props.onStepDropChange = propOverrides.onStepDropChange ?? vi.fn();
  props.onSubBatchSizeChange = propOverrides.onSubBatchSizeChange ?? vi.fn();
  const result = renderWithProviders(<PFCostModelPanel {...props} />);
  return { state, props, ...result };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFCostModelPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Batch chip rendering ─────────────────────────────────────────────

  /** Batch chip buttons live inside the "Decks to open" section. Helper to grab them. */
  function getBatchChips() {
    const buttons = screen.getAllByRole("button");
    // The only <button> elements in this component are the batch chips
    return buttons;
  }

  function getBatchChipByLabel(label: string) {
    const chips = getBatchChips();
    const chip = chips.find((btn) => btn.textContent === label);
    if (!chip) throw new Error(`Batch chip "${label}" not found`);
    return chip;
  }

  describe("Batch chip rendering", () => {
    it("renders all 4 batch chips with labels 1k, 10k, 100k, 1M", () => {
      renderPanel();

      const chips = getBatchChips();
      const labels = chips.map((c) => c.textContent);
      expect(labels).toEqual(["1k", "10k", "100k", "1M"]);
    });

    it("highlights selected batch chip with badge-info class", () => {
      renderPanel({ selectedBatch: 10000 });

      const chip10k = getBatchChipByLabel("10k");
      expect(chip10k).toHaveClass("badge-info");

      // Other chips should NOT have badge-info
      const chip1k = getBatchChipByLabel("1k");
      expect(chip1k).not.toHaveClass("badge-info");
    });

    it("calls onBatchChange with correct value when chip clicked", async () => {
      const onBatchChange = vi.fn();
      const { user } = renderPanel({
        selectedBatch: 1000,
        onBatchChange,
      });

      await user.click(getBatchChipByLabel("10k"));

      expect(onBatchChange).toHaveBeenCalledWith(10000);
    });

    it("does NOT call onBatchChange when clicking already selected chip", async () => {
      const onBatchChange = vi.fn();
      const { user } = renderPanel({
        selectedBatch: 1000,
        onBatchChange,
      });

      await user.click(getBatchChipByLabel("1k"));

      expect(onBatchChange).not.toHaveBeenCalled();
    });

    it("chips are disabled (not clickable) when controlsDisabled", async () => {
      const onBatchChange = vi.fn();
      const { user } = renderPanel(
        { selectedBatch: 1000, onBatchChange },
        { poeNinja: { isRefreshing: true } },
      );

      await user.click(getBatchChipByLabel("10k"));

      expect(onBatchChange).not.toHaveBeenCalled();
    });
  });

  // ── Step drop slider ─────────────────────────────────────────────────

  describe("Step drop slider", () => {
    it("renders step drop slider with correct value", () => {
      renderPanel({}, { profitForecast: { stepDrop: 3 } });

      const sliders = screen.getAllByRole("slider");
      // Step drop is the first range slider
      const stepDropSlider = sliders[0];
      expect(stepDropSlider).toHaveValue("3");
    });

    it("calls onStepDropChange when slider changes", () => {
      const onStepDropChange = vi.fn();
      renderPanel({ onStepDropChange });

      const sliders = screen.getAllByRole("slider");
      const stepDropSlider = sliders[0];

      fireEvent.change(stepDropSlider, { target: { value: "4" } });

      expect(onStepDropChange).toHaveBeenCalledWith(4);
    });

    it("slider disabled when controlsDisabled (isRefreshing)", () => {
      renderPanel({}, { poeNinja: { isRefreshing: true } });

      const sliders = screen.getAllByRole("slider");
      const stepDropSlider = sliders[0];
      expect(stepDropSlider).toBeDisabled();
    });

    it("slider disabled when stackedDeckChaosCost is 0", () => {
      renderPanel({}, { profitForecast: { stackedDeckChaosCost: 0 } });

      const sliders = screen.getAllByRole("slider");
      const stepDropSlider = sliders[0];
      expect(stepDropSlider).toBeDisabled();
    });

    it("shows current value display", () => {
      renderPanel({}, { profitForecast: { stepDrop: 3 } });

      // The display format is "−3 decks/div" (using minus sign entity)
      expect(screen.getByText(/3 decks\/div/)).toBeInTheDocument();
    });
  });

  // ── Sub-batch size slider ────────────────────────────────────────────

  describe("Sub-batch size slider", () => {
    it("renders sub-batch slider with correct value", () => {
      renderPanel({}, { profitForecast: { subBatchSize: 5000 } });

      const sliders = screen.getAllByRole("slider");
      // Sub-batch is the second range slider
      const subBatchSlider = sliders[1];
      expect(subBatchSlider).toHaveValue("5000");
    });

    it("calls onSubBatchSizeChange when slider changes", () => {
      const onSubBatchSizeChange = vi.fn();
      renderPanel({ onSubBatchSizeChange });

      const sliders = screen.getAllByRole("slider");
      const subBatchSlider = sliders[1];

      fireEvent.change(subBatchSlider, { target: { value: "7000" } });

      expect(onSubBatchSizeChange).toHaveBeenCalledWith(7000);
    });

    it("slider disabled when controlsDisabled (isLoading)", () => {
      renderPanel({}, { profitForecast: { isLoading: true } });

      const sliders = screen.getAllByRole("slider");
      const subBatchSlider = sliders[1];
      expect(subBatchSlider).toBeDisabled();
    });

    it("shows formatted value ('5,000 decks')", () => {
      renderPanel({}, { profitForecast: { subBatchSize: 5000 } });

      expect(screen.getByText("5,000 decks")).toBeInTheDocument();
    });
  });

  // ── Min price filter slider ──────────────────────────────────────────

  describe("Min price filter slider", () => {
    it("renders min price slider with correct value", () => {
      renderPanel({}, { profitForecast: { minPriceThreshold: 10 } });

      const sliders = screen.getAllByRole("slider");
      // Min price is the third range slider
      const minPriceSlider = sliders[2];
      expect(minPriceSlider).toHaveValue("10");
    });

    it("slider disabled when controlsDisabled (isRefreshing)", () => {
      renderPanel({}, { poeNinja: { isRefreshing: true } });

      const sliders = screen.getAllByRole("slider");
      const minPriceSlider = sliders[2];
      expect(minPriceSlider).toBeDisabled();
    });

    it("shows current value ('10c')", () => {
      renderPanel({}, { profitForecast: { minPriceThreshold: 10 } });

      expect(screen.getByText("10c")).toBeInTheDocument();
    });

    it("commits to store only on pointerUp after drag lifecycle", () => {
      const setMinPriceThreshold = vi.fn();
      renderPanel(
        {},
        { profitForecast: { minPriceThreshold: 10, setMinPriceThreshold } },
      );

      const sliders = screen.getAllByRole("slider");
      const minPriceSlider = sliders[2];

      // 1. pointerDown — initializes dragging state
      fireEvent.pointerDown(minPriceSlider);

      // 2. change — updates local state only (no store commit yet)
      fireEvent.change(minPriceSlider, { target: { value: "50" } });
      expect(setMinPriceThreshold).not.toHaveBeenCalled();

      // 3. pointerUp — commits the dragged value to the store
      fireEvent.pointerUp(minPriceSlider);
      expect(setMinPriceThreshold).toHaveBeenCalledWith(50);
    });
  });

  // ── Rate clamped notice ──────────────────────────────────────────────

  describe("Rate clamped notice", () => {
    it("shows rate clamped info when baseRate equals RATE_FLOOR (20)", () => {
      renderPanel({}, { profitForecast: { baseRate: RATE_FLOOR } });

      expect(screen.getByText(/Rate clamped to minimum/i)).toBeInTheDocument();
    });

    it("does not show rate clamped when baseRate > RATE_FLOOR", () => {
      renderPanel({}, { profitForecast: { baseRate: 100 } });

      expect(
        screen.queryByText(/Rate clamped to minimum/i),
      ).not.toBeInTheDocument();
    });

    it("does not show rate clamped when baseRate is 0", () => {
      renderPanel({}, { profitForecast: { baseRate: 0 } });

      expect(
        screen.queryByText(/Rate clamped to minimum/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── Excluded cards section ───────────────────────────────────────────

  describe("Excluded cards section", () => {
    it("does not show excluded section when total is 0", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            getExcludedCount: vi.fn(() => ({
              anomalous: 0,
              lowConfidence: 0,
              total: 0,
            })),
          },
        },
      );

      expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
    });

    it("shows anomalous badge with count when anomalous > 0", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            getExcludedCount: vi.fn(() => ({
              anomalous: 3,
              lowConfidence: 0,
              total: 3,
            })),
          },
        },
      );

      expect(screen.getByText("Excluded from EV")).toBeInTheDocument();
      expect(screen.getByText(/3 anomalous price/)).toBeInTheDocument();
    });

    it("shows low confidence badge with count when lowConfidence > 0", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            getExcludedCount: vi.fn(() => ({
              anomalous: 0,
              lowConfidence: 5,
              total: 5,
            })),
          },
        },
      );

      expect(screen.getByText("Excluded from EV")).toBeInTheDocument();
      expect(screen.getByText(/5 low confidence/)).toBeInTheDocument();
    });

    it("shows both badges when both > 0", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            getExcludedCount: vi.fn(() => ({
              anomalous: 2,
              lowConfidence: 4,
              total: 6,
            })),
          },
        },
      );

      expect(screen.getByText(/2 anomalous price/)).toBeInTheDocument();
      expect(screen.getByText(/4 low confidence/)).toBeInTheDocument();
    });

    it("does not show excluded section when not dataAvailable (hasData false)", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            hasData: vi.fn(() => false),
            getExcludedCount: vi.fn(() => ({
              anomalous: 3,
              lowConfidence: 2,
              total: 5,
            })),
          },
        },
      );

      // When dataAvailable is false, excludedCount is forced to all zeros
      expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
    });

    it("does not show excluded section when isLoading (dataAvailable false)", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            isLoading: true,
            hasData: vi.fn(() => true),
            getExcludedCount: vi.fn(() => ({
              anomalous: 3,
              lowConfidence: 2,
              total: 5,
            })),
          },
        },
      );

      expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
    });
  });

  // ── Disabled states ──────────────────────────────────────────────────

  describe("Disabled states", () => {
    it("all controls disabled when isRefreshing", () => {
      renderPanel({}, { poeNinja: { isRefreshing: true } });

      const sliders = screen.getAllByRole("slider");
      for (const slider of sliders) {
        expect(slider).toBeDisabled();
      }

      // Batch chips should also be disabled
      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button).toBeDisabled();
      }
    });

    it("all controls disabled when isLoading", () => {
      renderPanel({}, { profitForecast: { isLoading: true } });

      const sliders = screen.getAllByRole("slider");
      for (const slider of sliders) {
        expect(slider).toBeDisabled();
      }

      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button).toBeDisabled();
      }
    });

    it("step drop and sub-batch sliders disabled when stackedDeckChaosCost is 0 but min price is not", () => {
      renderPanel({}, { profitForecast: { stackedDeckChaosCost: 0 } });

      const sliders = screen.getAllByRole("slider");
      const stepDropSlider = sliders[0];
      const subBatchSlider = sliders[1];
      const minPriceSlider = sliders[2];

      expect(stepDropSlider).toBeDisabled();
      expect(subBatchSlider).toBeDisabled();
      // Min price should NOT be disabled just because no stacked deck price
      expect(minPriceSlider).not.toBeDisabled();
    });
  });

  // ── Pluralisation of anomalous label ─────────────────────────────────

  describe("Label pluralisation", () => {
    it("shows singular 'price' when anomalous count is 1", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            getExcludedCount: vi.fn(() => ({
              anomalous: 1,
              lowConfidence: 0,
              total: 1,
            })),
          },
        },
      );

      expect(screen.getByText("1 anomalous price")).toBeInTheDocument();
    });

    it("shows plural 'prices' when anomalous count is > 1", () => {
      renderPanel(
        {},
        {
          profitForecast: {
            getExcludedCount: vi.fn(() => ({
              anomalous: 5,
              lowConfidence: 0,
              total: 5,
            })),
          },
        },
      );

      expect(screen.getByText("5 anomalous prices")).toBeInTheDocument();
    });
  });
});
