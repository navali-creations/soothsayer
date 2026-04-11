import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";
import PFEstimatedReturnStat from "./PFEstimatedReturnStat";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

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

function createMockProfitForecast(overrides: any = {}) {
  return {
    isLoading: false,
    evPerDeck: 10,
    chaosToDivineRatio: 200,
    getTotalRevenue: vi.fn(() => 20000),
    hasData: vi.fn(() => true),
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const profitForecast = createMockProfitForecast(overrides.profitForecast);
  mockUseBoundStore.mockReturnValue({ profitForecast } as any);
  return { profitForecast };
}

function renderStat(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFEstimatedReturnStat />);
  return { state, ...result };
}

describe("PFEstimatedReturnStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'Estimated Return' title", () => {
    renderStat();
    expect(screen.getByText("Estimated Return")).toBeInTheDocument();
  });

  it("displays total revenue formatted in divine", () => {
    renderStat({
      profitForecast: {
        getTotalRevenue: vi.fn(() => 20000),
        chaosToDivineRatio: 200,
      },
    });
    const expected = formatDivine(20000, 200);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("shows EV per deck in chaos in description", () => {
    renderStat({
      profitForecast: {
        evPerDeck: 10,
        chaosToDivineRatio: 200,
      },
    });
    expect(screen.getByText("10.00c avg value / deck")).toBeInTheDocument();
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
});
