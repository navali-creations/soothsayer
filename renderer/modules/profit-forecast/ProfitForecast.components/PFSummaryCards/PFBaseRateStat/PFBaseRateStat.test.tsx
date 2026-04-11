import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFBaseRateStat from "./PFBaseRateStat";

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
    baseRate: 80,
    baseRateSource: "exchange" as const,
    customBaseRate: null as number | null,
    snapshotFetchedAt: "2024-06-15T12:00:00Z",
    getEffectiveBaseRate: vi.fn(() => 80),
    getBreakEvenRate: vi.fn(() => 20),
    hasData: vi.fn(() => true),
    setCustomBaseRate: vi.fn(),
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
  const result = renderWithProviders(<PFBaseRateStat />);
  return { state: { profitForecast: state }, ...result };
}

describe("PFBaseRateStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("displays the effective base rate in 'decks/div' format", () => {
    renderStat({
      profitForecast: { baseRate: 77, getEffectiveBaseRate: vi.fn(() => 77) },
    });
    expect(screen.getByText("77 decks/div")).toBeInTheDocument();
  });

  it("shows dash when effectiveBaseRate is 0", () => {
    renderStat({
      profitForecast: {
        baseRate: 0,
        getEffectiveBaseRate: vi.fn(() => 0),
      },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveTextContent("—");
  });

  it("shows 'derived' badge when baseRateSource is 'derived' and no custom rate", () => {
    renderStat({
      profitForecast: { baseRateSource: "derived", customBaseRate: null },
    });
    expect(screen.getByText("derived")).toBeInTheDocument();
  });

  it("does not show 'derived' badge when baseRateSource is 'exchange'", () => {
    renderStat({
      profitForecast: { baseRateSource: "exchange" },
    });
    expect(screen.queryByText("derived")).not.toBeInTheDocument();
  });

  it("hides 'derived' badge when a custom rate is set", () => {
    renderStat({
      profitForecast: {
        baseRateSource: "derived",
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });
    expect(screen.queryByText("derived")).not.toBeInTheDocument();
  });

  it("shows 'custom' badge with ghost style and primary text when custom rate is set", () => {
    renderStat({
      profitForecast: {
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });
    const customBadge = screen.getByText("custom");
    expect(customBadge).toBeInTheDocument();
    expect(customBadge.closest("span")).toHaveClass("badge-ghost");
    expect(customBadge.closest("span")).toHaveClass("text-primary");
  });

  it("shows formatted snapshot date in description when no custom rate", () => {
    renderStat({
      profitForecast: {
        snapshotFetchedAt: "2024-06-15T12:00:00Z",
      },
    });
    const statDescs = screen.getAllByTestId("stat-desc");
    expect(statDescs[0].textContent).toBeTruthy();
  });

  it("shows market rate and reset button in description when custom rate is active", () => {
    renderStat({
      profitForecast: {
        baseRate: 77,
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });
    expect(screen.getByText(/market: 77 decks\/div/)).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("renders edit (pencil) button with tooltip when data is available", () => {
    renderStat();
    const buttons = screen.getAllByRole("button");
    const editButton = buttons.find(
      (btn: HTMLElement) =>
        btn.getAttribute("data-tip") === "Set custom base rate",
    );
    expect(editButton).toBeDefined();
  });

  it("displays the effective rate in info color when custom rate is set", () => {
    renderStat({
      profitForecast: {
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });
    const rateSpan = screen.getByText("100 decks/div");
    expect(rateSpan).toHaveClass("text-info");
  });

  it("calls setCustomBaseRate(null) and setIsComputing(true) when Reset is clicked", async () => {
    const { state, user } = renderStat({
      profitForecast: {
        baseRate: 77,
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });
    const resetButton = screen.getByText("Reset").closest("button")!;
    await user.click(resetButton);
    expect(state.profitForecast.setCustomBaseRate).toHaveBeenCalledWith(null);
    expect(state.profitForecast.setIsComputing).toHaveBeenCalledWith(true);
  });

  it("Reset badge has badge-soft badge-info classes", () => {
    renderStat({
      profitForecast: {
        baseRate: 77,
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });
    const resetButton = screen.getByText("Reset").closest("button")!;
    expect(resetButton).toHaveClass("badge-soft");
    expect(resetButton).toHaveClass("badge-info");
  });

  it("has onboarding data attribute", () => {
    const { container } = renderStat();
    expect(
      container.querySelector('[data-onboarding="pf-base-rate"]'),
    ).toBeInTheDocument();
  });

  it("shows dash when data is not available", () => {
    renderStat({
      profitForecast: { hasData: vi.fn(() => false) },
    });
    const statValue = screen.getByTestId("stat-value");
    expect(statValue).toHaveTextContent("—");
  });

  it("handles snapshotFetchedAt being null", () => {
    renderStat({
      profitForecast: { snapshotFetchedAt: null },
    });
    expect(screen.getByText("Base Rate")).toBeInTheDocument();
  });

  // ─── Edit mode tests ────────────────────────────────────────────────────

  it("enters edit mode when edit button is clicked", async () => {
    const { user } = renderStat({
      profitForecast: { getEffectiveBaseRate: vi.fn(() => 80) },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(80);
  });

  it("commits a valid custom rate on Enter", async () => {
    const { state, user } = renderStat({
      profitForecast: { getEffectiveBaseRate: vi.fn(() => 80) },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "95");
    await user.keyboard("{Enter}");

    expect(state.profitForecast.setCustomBaseRate).toHaveBeenCalledWith(95);
    expect(state.profitForecast.setIsComputing).toHaveBeenCalledWith(true);
  });

  it("cancels editing on Escape without committing", async () => {
    const { state, user } = renderStat({
      profitForecast: { getEffectiveBaseRate: vi.fn(() => 80) },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(state.profitForecast.setCustomBaseRate).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("resets to market rate when entered value equals baseRate and custom rate exists", async () => {
    const { state, user } = renderStat({
      profitForecast: {
        baseRate: 80,
        customBaseRate: 100,
        getEffectiveBaseRate: vi.fn(() => 100),
      },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "80");
    await user.keyboard("{Enter}");

    expect(state.profitForecast.setCustomBaseRate).toHaveBeenCalledWith(null);
    expect(state.profitForecast.setIsComputing).toHaveBeenCalledWith(true);
  });

  it("does not commit invalid values (NaN)", async () => {
    const { state, user } = renderStat({
      profitForecast: { getEffectiveBaseRate: vi.fn(() => 80) },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "abc");
    await user.keyboard("{Enter}");

    expect(state.profitForecast.setCustomBaseRate).not.toHaveBeenCalled();
  });

  it("does not commit zero or negative values", async () => {
    const { state, user } = renderStat({
      profitForecast: { getEffectiveBaseRate: vi.fn(() => 80) },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "0");
    await user.keyboard("{Enter}");

    expect(state.profitForecast.setCustomBaseRate).not.toHaveBeenCalled();
  });

  it("does not re-commit if value equals current customBaseRate", async () => {
    const { state, user } = renderStat({
      profitForecast: {
        baseRate: 80,
        customBaseRate: 95,
        getEffectiveBaseRate: vi.fn(() => 95),
      },
    });

    const editButton = screen
      .getAllByRole("button")
      .find(
        (btn: HTMLElement) =>
          btn.getAttribute("data-tip") === "Set custom base rate",
      )!;

    await user.click(editButton);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "95");
    await user.keyboard("{Enter}");

    expect(state.profitForecast.setCustomBaseRate).not.toHaveBeenCalled();
    expect(state.profitForecast.setIsComputing).not.toHaveBeenCalled();
  });
});
