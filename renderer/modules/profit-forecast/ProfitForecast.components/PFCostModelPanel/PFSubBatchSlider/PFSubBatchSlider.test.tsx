import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { usePoeNinja, useProfitForecast } from "~/renderer/store";

import PFSubBatchSlider from "./PFSubBatchSlider";

vi.mock("~/renderer/store", () => ({
  useProfitForecast: vi.fn(),
  usePoeNinja: vi.fn(),
}));

const mockUseProfitForecast = vi.mocked(useProfitForecast);
const mockUsePoeNinja = vi.mocked(usePoeNinja);

function createMockProfitForecast(overrides: any = {}) {
  return {
    subBatchSize: 5000,
    customBaseRate: null as number | null,
    stackedDeckChaosCost: 5,
    setSubBatchSize: vi.fn(),
    setIsComputing: vi.fn(),
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
  mockUseProfitForecast.mockReturnValue(profitForecast);
  mockUsePoeNinja.mockReturnValue(poeNinja);
  return { profitForecast, poeNinja };
}

function renderSlider(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFSubBatchSlider />);
  return { state, ...result };
}

describe("PFSubBatchSlider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders slider with correct value", () => {
    renderSlider({ profitForecast: { subBatchSize: 5000 } });
    expect(screen.getByRole("slider")).toHaveValue("5000");
  });

  it("calls setIsComputing and setSubBatchSize when slider changes", () => {
    const { state } = renderSlider();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "7000" } });
    expect(state.profitForecast.setIsComputing).toHaveBeenCalledWith(true);
    expect(state.profitForecast.setSubBatchSize).toHaveBeenCalledWith(7000);
  });

  it("shows formatted value ('5,000 decks')", () => {
    renderSlider({ profitForecast: { subBatchSize: 5000 } });
    expect(screen.getByText("5,000 decks")).toBeInTheDocument();
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

  it("slider disabled when custom base rate is active", () => {
    renderSlider({ profitForecast: { customBaseRate: 50 } });
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("shows info tooltip when disabled due to custom rate", () => {
    const { container } = renderSlider({
      profitForecast: { customBaseRate: 50 },
    });
    expect(
      container.querySelector(
        "[data-tip*='custom rate uses the selected deck count']",
      ),
    ).toBeInTheDocument();
  });

  it("does not show custom rate tooltip when no custom rate", () => {
    const { container } = renderSlider({
      profitForecast: { customBaseRate: null },
    });
    expect(
      container.querySelector(
        "[data-tip*='custom rate uses the selected deck count']",
      ),
    ).not.toBeInTheDocument();
  });

  it("slider is enabled when not loading, not refreshing, has stacked deck price, no custom rate", () => {
    renderSlider();
    expect(screen.getByRole("slider")).not.toBeDisabled();
  });
});
