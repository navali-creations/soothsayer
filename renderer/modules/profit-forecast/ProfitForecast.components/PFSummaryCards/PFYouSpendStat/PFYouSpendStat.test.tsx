import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";
import PFYouSpendStat from "./PFYouSpendStat";

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, ...props }: any) => (
        <div data-testid="stat-value" {...props}>
          {children}
        </div>
      ),
      Desc: ({ children, ...props }: any) => (
        <div data-testid="stat-desc" {...props}>
          {children}
        </div>
      ),
    },
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockState(overrides: any = {}) {
  return {
    profitForecast: {
      isLoading: false,
      chaosToDivineRatio: 200,
      getTotalCost: vi.fn(() => 16000),
      getAvgCostPerDeck: vi.fn(() => 2.5),
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

function renderStat(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFYouSpendStat />);
  return { state, ...result };
}

describe("PFYouSpendStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'You Spend' title", () => {
    renderStat();
    expect(screen.getByText("You Spend")).toBeInTheDocument();
  });

  it("displays total cost formatted in divine", () => {
    renderStat({
      profitForecast: {
        getTotalCost: vi.fn(() => 16000),
        chaosToDivineRatio: 200,
      },
    });
    const expected = formatDivine(16000, 200);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("shows avg cost per deck in chaos in description", () => {
    renderStat({
      profitForecast: {
        getAvgCostPerDeck: vi.fn(() => 2.5),
        chaosToDivineRatio: 200,
      },
    });
    expect(screen.getByText("avg 2.50c / deck")).toBeInTheDocument();
  });

  it("shows dash when data is not available", () => {
    renderStat({
      profitForecast: { hasData: vi.fn(() => false) },
    });
    expect(screen.getByTestId("stat-value")).toHaveTextContent("—");
  });

  it("shows dash when isLoading", () => {
    renderStat({
      profitForecast: { isLoading: true },
    });
    expect(screen.getByTestId("stat-value")).toHaveTextContent("—");
  });

  it("handles chaosToDivineRatio of 0 gracefully", () => {
    renderStat({
      profitForecast: { chaosToDivineRatio: 0 },
    });
    expect(screen.getByText("You Spend")).toBeInTheDocument();
  });
});
