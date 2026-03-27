import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFStepDropSlider from "./PFStepDropSlider";

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockState(overrides: any = {}) {
  return {
    profitForecast: {
      stepDrop: 2,
      selectedBatch: 10000,
      customBaseRate: null as number | null,
      stackedDeckChaosCost: 5,
      setStepDrop: vi.fn(),
      setIsComputing: vi.fn(),
      isLoading: false,
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

function renderSlider(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFStepDropSlider />);
  return { state, ...result };
}

describe("PFStepDropSlider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders slider with correct value", () => {
    renderSlider({ profitForecast: { stepDrop: 3 } });
    expect(screen.getByRole("slider")).toHaveValue("3");
  });

  it("calls setIsComputing and setStepDrop when slider changes", () => {
    const { state } = renderSlider();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "4" } });
    expect(state.profitForecast.setIsComputing).toHaveBeenCalledWith(true);
    expect(state.profitForecast.setStepDrop).toHaveBeenCalledWith(4);
  });

  it("shows current value display", () => {
    renderSlider({ profitForecast: { stepDrop: 3 } });
    expect(screen.getByText(/3 decks\/div/)).toBeInTheDocument();
  });

  it("slider disabled when isRefreshing", () => {
    renderSlider({ poeNinja: { isRefreshing: true } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("slider disabled when isLoading", () => {
    renderSlider({ profitForecast: { isLoading: true } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("slider disabled when stackedDeckChaosCost is 0", () => {
    renderSlider({ profitForecast: { stackedDeckChaosCost: 0 } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("slider disabled when selectedBatch <= 1000", () => {
    renderSlider({ profitForecast: { selectedBatch: 1000 } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("slider disabled when custom base rate is active", () => {
    renderSlider({ profitForecast: { customBaseRate: 50 } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("shows info tooltip when disabled due to custom rate", () => {
    const { container } = renderSlider({
      profitForecast: { customBaseRate: 50 },
    });
    expect(
      container.querySelector("[data-tip*='Locked at 0']"),
    ).toBeInTheDocument();
  });

  it("shows info tooltip when disabled due to 1k batch", () => {
    const { container } = renderSlider({
      profitForecast: { selectedBatch: 1000 },
    });
    expect(
      container.querySelector("[data-tip*='only one batch at 1k']"),
    ).toBeInTheDocument();
  });

  it("does not show custom rate tooltip when no custom rate", () => {
    const { container } = renderSlider({
      profitForecast: { customBaseRate: null, selectedBatch: 10000 },
    });
    expect(
      container.querySelector("[data-tip*='Locked at 0']"),
    ).not.toBeInTheDocument();
  });

  it("does not show 1k tooltip when batch > 1000", () => {
    const { container } = renderSlider({
      profitForecast: { selectedBatch: 10000 },
    });
    expect(
      container.querySelector("[data-tip*='only one batch at 1k']"),
    ).not.toBeInTheDocument();
  });
});
