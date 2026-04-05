import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useProfitForecast } from "~/renderer/store";

import PFBreakEvenStat from "./PFBreakEvenStat";

vi.mock("~/renderer/store", () => ({
  useProfitForecast: vi.fn(),
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

const mockUseProfitForecast = vi.mocked(useProfitForecast);

function createMockState(overrides: any = {}) {
  return {
    isLoading: false,
    getBreakEvenRate: vi.fn(() => 20),
    getEffectiveBaseRate: vi.fn(() => 80),
    hasData: vi.fn(() => true),
    ...overrides.profitForecast,
  } as any;
}

function setupStore(overrides: any = {}) {
  const state = createMockState(overrides);
  mockUseProfitForecast.mockReturnValue(state);
  return state;
}

function renderStat(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFBreakEvenStat />);
  return { state, ...result };
}

describe("PFBreakEvenStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'Break-Even Rate' title", () => {
    renderStat();
    expect(screen.getByText("Break-Even Rate")).toBeInTheDocument();
  });

  it("displays break-even rate in 'decks/div' format (ceiling)", () => {
    renderStat({
      profitForecast: { getBreakEvenRate: vi.fn(() => 19.3) },
    });
    expect(screen.getByText("20 decks/div")).toBeInTheDocument();
  });

  it("has text-success when effectiveBaseRate > breakEvenRate", () => {
    renderStat({
      profitForecast: {
        getEffectiveBaseRate: vi.fn(() => 80),
        getBreakEvenRate: vi.fn(() => 20),
      },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveClass("text-success");
  });

  it("has text-error when effectiveBaseRate <= breakEvenRate", () => {
    renderStat({
      profitForecast: {
        getEffectiveBaseRate: vi.fn(() => 15),
        getBreakEvenRate: vi.fn(() => 20),
      },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveClass("text-error");
  });

  it("shows dash when breakEvenRate is 0", () => {
    renderStat({
      profitForecast: { getBreakEvenRate: vi.fn(() => 0) },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveTextContent("—");
  });

  it("does not have colored class when breakEvenRate is 0", () => {
    renderStat({
      profitForecast: { getBreakEvenRate: vi.fn(() => 0) },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).not.toHaveClass("text-success");
    expect(statValue).not.toHaveClass("text-error");
  });

  it("shows break-even description when rate is available", () => {
    renderStat({
      profitForecast: { getBreakEvenRate: vi.fn(() => 19.3) },
    });
    expect(
      screen.getByText(/need \u2265 20 to break even/),
    ).toBeInTheDocument();
  });

  it("has onboarding data attribute", () => {
    const { container } = renderStat();
    expect(
      container.querySelector('[data-onboarding="pf-break-even-rate"]'),
    ).toBeInTheDocument();
  });

  it("shows dash when data is not available", () => {
    renderStat({
      profitForecast: { hasData: vi.fn(() => false) },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveTextContent("—");
  });
});
