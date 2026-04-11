import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";
import PFEstimatedNetStat from "./PFEstimatedNetStat";

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

function createMockState(overrides: any = {}) {
  return {
    isLoading: false,
    chaosToDivineRatio: 200,
    getBatchPnL: vi.fn(() => ({
      revenue: 20000,
      cost: 16500,
      netPnL: 3500,
      confidence: {
        estimated: 3500,
        optimistic: 12000,
      },
    })),
    hasData: vi.fn(() => true),
    ...overrides.profitForecast,
  } as any;
}

function setupStore(overrides: any = {}) {
  const state = createMockState(overrides);
  mockUseBoundStore.mockReturnValue({ profitForecast: state } as any);
  return state;
}

function renderStat(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFEstimatedNetStat />);
  return { state, ...result };
}

describe("PFEstimatedNetStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'Estimated Net' title", () => {
    renderStat();
    expect(screen.getByText(/Estimated Net/)).toBeInTheDocument();
  });

  it("displays positive estimated net with + prefix and formatted divine value", () => {
    renderStat({ profitForecast: { chaosToDivineRatio: 200 } });
    const expected = `+${formatDivine(3500, 200)}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("has text-success class when estimated net is positive", () => {
    renderStat({ profitForecast: { chaosToDivineRatio: 200 } });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveClass("text-success");
  });

  it("has text-error class when estimated net is negative", () => {
    renderStat({
      profitForecast: {
        chaosToDivineRatio: 200,
        getBatchPnL: vi.fn(() => ({
          revenue: 20000,
          cost: 16500,
          netPnL: 3500,
          confidence: {
            estimated: -2000,
            optimistic: 5000,
          },
        })),
      },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveClass("text-error");
  });

  it("displays negative estimated net with minus sign", () => {
    renderStat({
      profitForecast: {
        chaosToDivineRatio: 200,
        getBatchPnL: vi.fn(() => ({
          revenue: 20000,
          cost: 16500,
          netPnL: 3500,
          confidence: {
            estimated: -2000,
            optimistic: 5000,
          },
        })),
      },
    });
    const expected = `\u221210.00 d`;
    expect(screen.getByText(expected)).toBeInTheDocument();
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
