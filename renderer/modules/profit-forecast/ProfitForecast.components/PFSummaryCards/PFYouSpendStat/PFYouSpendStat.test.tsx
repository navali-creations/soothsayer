import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";
import PFYouSpendStat from "./PFYouSpendStat";

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
    customTotalCost: null as number | null,
    getTotalCost: vi.fn(() => 16000),
    getAvgCostPerDeck: vi.fn(() => 2.5),
    hasData: vi.fn(() => true),
    setCustomTotalCost: vi.fn(),
    setIsComputing: vi.fn(),
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

  it("renders edit button with tooltip when data is available", () => {
    renderStat();
    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom spend",
      );
    expect(editButton).toBeDefined();
  });

  it("enters edit mode with current total spend in divines", async () => {
    const { user } = renderStat({
      profitForecast: {
        getTotalCost: vi.fn(() => 16000),
        chaosToDivineRatio: 200,
      },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom spend",
      )!;

    await user.click(editButton);

    expect(screen.getByRole("spinbutton")).toHaveValue(80);
  });

  it("commits custom spend in chaos on Enter", async () => {
    const { state, user } = renderStat({
      profitForecast: {
        getTotalCost: vi.fn(() => 16000),
        chaosToDivineRatio: 200,
      },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom spend",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "75");
    await user.keyboard("{Enter}");

    expect(state.setCustomTotalCost).toHaveBeenCalledWith(15000);
    expect(state.setIsComputing).toHaveBeenCalledWith(true);
  });

  it("cancels editing on Escape without committing", async () => {
    const { state, user } = renderStat();

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom spend",
      )!;

    await user.click(editButton);
    await user.keyboard("{Escape}");

    expect(state.setCustomTotalCost).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("shows custom badge and reset button when custom spend is active", () => {
    renderStat({
      profitForecast: { customTotalCost: 15000 },
    });

    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("calls setCustomTotalCost(null) and setIsComputing(true) when reset is clicked", async () => {
    const { state, user } = renderStat({
      profitForecast: { customTotalCost: 15000 },
    });

    const resetButton = screen.getByText("Reset").closest("button")!;
    await user.click(resetButton);

    expect(state.setCustomTotalCost).toHaveBeenCalledWith(null);
    expect(state.setIsComputing).toHaveBeenCalledWith(true);
  });
});
