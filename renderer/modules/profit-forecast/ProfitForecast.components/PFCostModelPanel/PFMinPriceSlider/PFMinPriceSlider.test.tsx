import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFMinPriceSlider from "./PFMinPriceSlider";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockProfitForecast(overrides: any = {}) {
  return {
    minPriceThreshold: 10,
    setMinPriceThreshold: vi.fn(),
    isLoading: false,
    ...overrides,
  } as any;
}

function createMockPoeNinja(overrides: any = {}) {
  return {
    isRefreshing: false,
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const profitForecast = createMockProfitForecast(overrides.profitForecast);
  const poeNinja = createMockPoeNinja(overrides.poeNinja);
  mockUseBoundStore.mockReturnValue({ profitForecast, poeNinja } as any);
  return { profitForecast, poeNinja };
}

function renderSlider(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFMinPriceSlider />);
  return { state, ...result };
}

describe("PFMinPriceSlider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders slider with correct value", () => {
    renderSlider({ profitForecast: { minPriceThreshold: 10 } });
    expect(screen.getByRole("slider")).toHaveValue("10");
  });

  it("shows current value ('10c')", () => {
    renderSlider({ profitForecast: { minPriceThreshold: 10 } });
    expect(screen.getByText("10c")).toBeInTheDocument();
  });

  it("slider disabled when isRefreshing", () => {
    renderSlider({ poeNinja: { isRefreshing: true } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("slider disabled when isLoading", () => {
    renderSlider({ profitForecast: { isLoading: true } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("commits to store only on pointerUp after drag lifecycle", () => {
    const setMinPriceThreshold = vi.fn();
    renderSlider({
      profitForecast: { minPriceThreshold: 10, setMinPriceThreshold },
    });

    const slider = screen.getByRole("slider");

    // 1. pointerDown — initializes dragging state
    fireEvent.pointerDown(slider);

    // 2. change — updates local state only (no store commit yet)
    fireEvent.change(slider, { target: { value: "50" } });
    expect(setMinPriceThreshold).not.toHaveBeenCalled();

    // 3. pointerUp — commits the dragged value to the store
    fireEvent.pointerUp(slider);
    expect(setMinPriceThreshold).toHaveBeenCalledWith(50);
  });

  it("slider is enabled when not loading and not refreshing", () => {
    renderSlider();
    expect(screen.getByRole("slider")).not.toBeDisabled();
  });
});
