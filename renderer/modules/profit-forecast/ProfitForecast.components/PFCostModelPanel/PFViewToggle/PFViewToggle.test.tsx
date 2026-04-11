import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFViewToggle from "./PFViewToggle";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockProfitForecast(overrides: any = {}) {
  return {
    forecastView: "chart" as "chart" | "table",
    setForecastView: vi.fn(),
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const profitForecast = createMockProfitForecast(overrides.profitForecast);
  mockUseBoundStore.mockReturnValue({ profitForecast } as any);
  return { profitForecast };
}

function renderToggle(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFViewToggle />);
  return { state, ...result };
}

function getViewButtons() {
  return screen.getAllByRole("button");
}

function getViewButtonByLabel(label: string) {
  const btn = getViewButtons().find((b) => b.textContent === label);
  if (!btn) throw new Error(`View button "${label}" not found`);
  return btn;
}

describe("PFViewToggle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Table and Chart buttons", () => {
    renderToggle();
    const labels = getViewButtons().map((b) => b.textContent);
    expect(labels).toEqual(["Table", "Chart"]);
  });

  it("highlights the active view with badge-info", () => {
    renderToggle({ profitForecast: { forecastView: "table" } });
    expect(getViewButtonByLabel("Table")).toHaveClass("badge-info");
    expect(getViewButtonByLabel("Chart")).not.toHaveClass("badge-info");
  });

  it("highlights Chart when forecastView is chart", () => {
    renderToggle({ profitForecast: { forecastView: "chart" } });
    expect(getViewButtonByLabel("Chart")).toHaveClass("badge-info");
    expect(getViewButtonByLabel("Table")).not.toHaveClass("badge-info");
  });

  it("calls setForecastView when clicking a different view", async () => {
    const { state, user } = renderToggle({
      profitForecast: { forecastView: "chart" },
    });
    await user.click(getViewButtonByLabel("Table"));
    expect(state.profitForecast.setForecastView).toHaveBeenCalledWith("table");
  });

  it("does NOT call setForecastView when clicking the already active view", async () => {
    const { state, user } = renderToggle({
      profitForecast: { forecastView: "chart" },
    });
    await user.click(getViewButtonByLabel("Chart"));
    expect(state.profitForecast.setForecastView).not.toHaveBeenCalled();
  });
});
