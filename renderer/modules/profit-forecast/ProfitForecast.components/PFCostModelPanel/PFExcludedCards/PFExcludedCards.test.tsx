import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFExcludedCards from "./PFExcludedCards";

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockState(overrides: any = {}) {
  return {
    profitForecast: {
      getExcludedCount: vi.fn(() => ({
        anomalous: 0,
        lowConfidence: 0,
        total: 0,
      })),
      isLoading: false,
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

function renderExcluded(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFExcludedCards />);
  return { state, ...result };
}

describe("PFExcludedCards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when total is 0", () => {
    renderExcluded();
    expect(screen.queryByText("Excluded from EV")).not.toBeInTheDocument();
  });

  it("shows anomalous badge with count when anomalous > 0", () => {
    renderExcluded({
      profitForecast: {
        getExcludedCount: vi.fn(() => ({
          anomalous: 3,
          lowConfidence: 0,
          total: 3,
        })),
      },
    });
    expect(screen.getByText("Excluded from EV")).toBeInTheDocument();
    expect(screen.getByText(/3 anomalous price/)).toBeInTheDocument();
  });

  it("shows low confidence badge with count when lowConfidence > 0", () => {
    renderExcluded({
      profitForecast: {
        getExcludedCount: vi.fn(() => ({
          anomalous: 0,
          lowConfidence: 5,
          total: 5,
        })),
      },
    });
    expect(screen.getByText("Excluded from EV")).toBeInTheDocument();
    expect(screen.getByText(/5 low confidence/)).toBeInTheDocument();
  });

  it("shows both badges when both > 0", () => {
    renderExcluded({
      profitForecast: {
        getExcludedCount: vi.fn(() => ({
          anomalous: 2,
          lowConfidence: 4,
          total: 6,
        })),
      },
    });
    expect(screen.getByText(/2 anomalous price/)).toBeInTheDocument();
    expect(screen.getByText(/4 low confidence/)).toBeInTheDocument();
  });

  it("does not render when hasData returns false (even if getExcludedCount has values)", () => {
    renderExcluded({
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

  it("does not render when isLoading (dataAvailable is false)", () => {
    renderExcluded({
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

  it("shows singular 'price' when anomalous count is 1", () => {
    renderExcluded({
      profitForecast: {
        getExcludedCount: vi.fn(() => ({
          anomalous: 1,
          lowConfidence: 0,
          total: 1,
        })),
      },
    });
    expect(screen.getByText("1 anomalous price")).toBeInTheDocument();
  });

  it("shows plural 'prices' when anomalous count is > 1", () => {
    renderExcluded({
      profitForecast: {
        getExcludedCount: vi.fn(() => ({
          anomalous: 5,
          lowConfidence: 0,
          total: 5,
        })),
      },
    });
    expect(screen.getByText("5 anomalous prices")).toBeInTheDocument();
  });

  it("shows explanatory text when excluded cards are present", () => {
    renderExcluded({
      profitForecast: {
        getExcludedCount: vi.fn(() => ({
          anomalous: 1,
          lowConfidence: 0,
          total: 1,
        })),
      },
    });
    expect(
      screen.getByText(/Cards with unreliable prices are excluded/),
    ).toBeInTheDocument();
  });
});
