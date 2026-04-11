import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFBatchSizeChips from "./PFBatchSizeChips";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockProfitForecast(overrides: any = {}) {
  return {
    selectedBatch: 1000,
    setSelectedBatch: vi.fn(),
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
  mockUseBoundStore.mockReturnValue({
    profitForecast,
    poeNinja,
  } as any);
  return { profitForecast, poeNinja };
}

function renderChips(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFBatchSizeChips />);
  return { state, ...result };
}

const BATCH_LABELS = ["1k", "10k", "100k", "1M"];

function getBatchChips() {
  return screen
    .getAllByRole("button")
    .filter((btn) => BATCH_LABELS.includes(btn.textContent ?? ""));
}

function getBatchChipByLabel(label: string) {
  const chip = getBatchChips().find((btn) => btn.textContent === label);
  if (!chip) throw new Error(`Batch chip "${label}" not found`);
  return chip;
}

describe("PFBatchSizeChips", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all 4 batch chips with labels 1k, 10k, 100k, 1M", () => {
    renderChips();
    const labels = getBatchChips().map((c) => c.textContent);
    expect(labels).toEqual(["1k", "10k", "100k", "1M"]);
  });

  it("highlights selected batch chip with badge-info class", () => {
    renderChips({ profitForecast: { selectedBatch: 10000 } });
    expect(getBatchChipByLabel("10k")).toHaveClass("badge-info");
    expect(getBatchChipByLabel("1k")).not.toHaveClass("badge-info");
  });

  it("calls setIsComputing and setSelectedBatch when chip clicked", async () => {
    const { state, user } = renderChips({
      profitForecast: { selectedBatch: 1000 },
    });
    await user.click(getBatchChipByLabel("10k"));
    expect(state.profitForecast.setIsComputing).toHaveBeenCalledWith(true);
    expect(state.profitForecast.setSelectedBatch).toHaveBeenCalledWith(10000);
  });

  it("does NOT call setSelectedBatch when clicking already selected chip", async () => {
    const { state, user } = renderChips({
      profitForecast: { selectedBatch: 1000 },
    });
    await user.click(getBatchChipByLabel("1k"));
    expect(state.profitForecast.setSelectedBatch).not.toHaveBeenCalled();
  });

  it("chips are disabled when isRefreshing", async () => {
    const { state, user } = renderChips({ poeNinja: { isRefreshing: true } });
    await user.click(getBatchChipByLabel("10k"));
    expect(state.profitForecast.setSelectedBatch).not.toHaveBeenCalled();
    for (const chip of getBatchChips()) {
      expect(chip).toBeDisabled();
    }
  });

  it("chips are disabled when isLoading", async () => {
    const { state, user } = renderChips({
      profitForecast: { isLoading: true },
    });
    await user.click(getBatchChipByLabel("10k"));
    expect(state.profitForecast.setSelectedBatch).not.toHaveBeenCalled();
    for (const chip of getBatchChips()) {
      expect(chip).toBeDisabled();
    }
  });
});
