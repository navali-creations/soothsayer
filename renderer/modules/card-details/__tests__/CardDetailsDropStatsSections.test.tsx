import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Component imports (after all mocks) ───────────────────────────────────

import DropProbabilitySection from "../CardDetails.components/CardDetailsDropStats/DropProbabilitySection";
import EvContributionSection from "../CardDetails.components/CardDetailsDropStats/EvContributionSection";
import YourLuckSection from "../CardDetails.components/CardDetailsDropStats/YourLuckSection";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createDropProbabilityState(
  prob: {
    dropChanceFormatted: string;
    percentFormatted: string;
    expectedDecks: number;
  } | null = null,
) {
  return {
    cardDetails: {
      getDropProbability: vi.fn(() => prob),
    },
    profitForecast: {
      totalWeight: 10000,
    },
  };
}

function renderDropProbability(
  prob: {
    dropChanceFormatted: string;
    percentFormatted: string;
    expectedDecks: number;
  } | null = null,
) {
  const mockState = createDropProbabilityState(prob);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  const result = renderWithProviders(<DropProbabilitySection />);
  return { ...result, mockState };
}

function createEvContributionState(
  overrides: {
    ev?: number | null;
    currentDivineRate?: number;
    chaosToDivineRatio?: number;
    nullPriceHistory?: boolean;
  } = {},
) {
  const {
    ev = 0.5,
    currentDivineRate = 200,
    chaosToDivineRatio = 1,
    nullPriceHistory = false,
  } = overrides;

  return {
    cardDetails: {
      priceHistory: nullPriceHistory
        ? null
        : currentDivineRate > 0
          ? { currentDivineRate, chaosToDivineRatio }
          : null,
      getEvContribution: vi.fn(() => ev),
    },
    profitForecast: {
      totalWeight: 10000,
    },
  };
}

function renderEvContribution(
  overrides: {
    ev?: number | null;
    currentDivineRate?: number;
    chaosToDivineRatio?: number;
    nullPriceHistory?: boolean;
  } = {},
) {
  const mockState = createEvContributionState(overrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  const result = renderWithProviders(<EvContributionSection />);
  return { ...result, mockState };
}

function createYourLuckState(
  luck: {
    label: string;
    expectedDrops: number;
    actualDrops: number;
    luckRatio: number;
    color: "success" | "error" | "warning";
    hasSufficientData: boolean;
  } | null = null,
) {
  return {
    cardDetails: {
      getLuckComparison: vi.fn(() => luck),
    },
    profitForecast: {
      totalWeight: 10000,
    },
  };
}

function renderYourLuck(
  luck: {
    label: string;
    expectedDrops: number;
    actualDrops: number;
    luckRatio: number;
    color: "success" | "error" | "warning";
    hasSufficientData: boolean;
  } | null = null,
) {
  const mockState = createYourLuckState(luck);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  const result = renderWithProviders(<YourLuckSection />);
  return { ...result, mockState };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// DropProbabilitySection
// ═══════════════════════════════════════════════════════════════════════════

describe("DropProbabilitySection", () => {
  const defaultProb = {
    dropChanceFormatted: "1 in 500",
    percentFormatted: "0.20%",
    expectedDecks: 500,
  };

  it("returns null when getDropProbability returns null", () => {
    const { container } = renderDropProbability(null);
    expect(container.innerHTML).toBe("");
  });

  it('renders "Drop Chance" label', () => {
    renderDropProbability(defaultProb);
    expect(screen.getByText("Drop Chance")).toBeInTheDocument();
  });

  it("renders drop chance formatted text", () => {
    renderDropProbability(defaultProb);
    expect(screen.getByText("1 in 500")).toBeInTheDocument();
  });

  it("renders percent formatted text", () => {
    renderDropProbability(defaultProb);
    expect(screen.getByText("0.20%")).toBeInTheDocument();
  });

  it('renders "Expected Decks" label', () => {
    renderDropProbability(defaultProb);
    expect(screen.getByText("Expected Decks")).toBeInTheDocument();
  });

  it("renders expected decks count rounded and locale-formatted", () => {
    renderDropProbability({
      dropChanceFormatted: "1 in 1234",
      percentFormatted: "0.08%",
      expectedDecks: 1234.7,
    });
    // Math.round(1234.7) = 1235, toLocaleString → "1,235"
    expect(screen.getByText("1,235")).toBeInTheDocument();
  });

  it('renders "decks to find one on average" description', () => {
    renderDropProbability(defaultProb);
    expect(
      screen.getByText("decks to find one on average"),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EvContributionSection
// ═══════════════════════════════════════════════════════════════════════════

describe("EvContributionSection", () => {
  it("returns null when getEvContribution returns null", () => {
    const { container } = renderEvContribution({ ev: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when chaosValue is 0 (no priceHistory)", () => {
    const { container } = renderEvContribution({
      ev: 0.5,
      currentDivineRate: 0,
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when priceHistory is null", () => {
    const { container } = renderEvContribution({
      ev: 0.5,
      nullPriceHistory: true,
    });
    expect(container.innerHTML).toBe("");
  });

  it('renders "EV Contribution" label', () => {
    renderEvContribution({
      ev: 1.5,
      currentDivineRate: 200,
      chaosToDivineRatio: 1,
    });
    expect(screen.getByText("EV Contribution")).toBeInTheDocument();
  });

  it("renders formatted EV with 2 decimals for ev >= 1", () => {
    renderEvContribution({
      ev: 2.456789,
      currentDivineRate: 200,
      chaosToDivineRatio: 1,
    });
    expect(screen.getByText(/2\.46/)).toBeInTheDocument();
  });

  it("renders formatted EV with 4 decimals for ev >= 0.01", () => {
    renderEvContribution({
      ev: 0.0567,
      currentDivineRate: 200,
      chaosToDivineRatio: 1,
    });
    expect(screen.getByText(/0\.0567/)).toBeInTheDocument();
  });

  it("renders formatted EV in exponential for very small ev", () => {
    renderEvContribution({
      ev: 0.00123,
      currentDivineRate: 200,
      chaosToDivineRatio: 1,
    });
    expect(screen.getByText(/1\.23e-3/)).toBeInTheDocument();
  });

  it('renders "chaos per deck" label', () => {
    renderEvContribution({
      ev: 1.5,
      currentDivineRate: 200,
      chaosToDivineRatio: 1,
    });
    expect(screen.getByText("chaos per deck")).toBeInTheDocument();
  });

  it("calls getEvContribution with totalWeight and derived chaosValue", () => {
    const { mockState } = renderEvContribution({
      ev: 1.0,
      currentDivineRate: 200,
      chaosToDivineRatio: 2,
    });
    // chaosValue = currentDivineRate / chaosToDivineRatio = 200 / 2 = 100
    expect(mockState.cardDetails.getEvContribution).toHaveBeenCalledWith(
      10000,
      100,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// YourLuckSection
// ═══════════════════════════════════════════════════════════════════════════

describe("YourLuckSection", () => {
  const baseLuck = {
    label: "You're Lucky!",
    expectedDrops: 1.5,
    actualDrops: 3,
    luckRatio: 2.0,
    color: "success" as const,
    hasSufficientData: true,
  };

  it("returns null when getLuckComparison returns null", () => {
    const { container } = renderYourLuck(null);
    expect(container.innerHTML).toBe("");
  });

  it('renders "Your Luck" heading', () => {
    renderYourLuck(baseLuck);
    expect(screen.getByText("Your Luck")).toBeInTheDocument();
  });

  it("renders luck label text", () => {
    renderYourLuck(baseLuck);
    expect(screen.getByText("You're Lucky!")).toBeInTheDocument();
  });

  it("renders expected drops value", () => {
    renderYourLuck(baseLuck);
    expect(screen.getByText("1.50 drops")).toBeInTheDocument();
  });

  it("renders actual drops value", () => {
    renderYourLuck(baseLuck);
    expect(screen.getByText("3 drops")).toBeInTheDocument();
  });

  it("renders luck ratio value", () => {
    renderYourLuck(baseLuck);
    expect(screen.getByText("2.00×")).toBeInTheDocument();
  });

  it("uses text-success class for success color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      color: "success",
    });
    const label = screen.getByText("You're Lucky!");
    expect(label.className).toContain("text-success");

    const bar = container.querySelector(".bg-success");
    expect(bar).toBeInTheDocument();
  });

  it("uses text-error class for error color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      label: "Unlucky",
      color: "error",
    });
    const label = screen.getByText("Unlucky");
    expect(label.className).toContain("text-error");

    const bar = container.querySelector(".bg-error");
    expect(bar).toBeInTheDocument();
  });

  it("uses text-warning class for warning color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      label: "About Average",
      color: "warning",
    });
    const label = screen.getByText("About Average");
    expect(label.className).toContain("text-warning");

    const bar = container.querySelector(".bg-warning");
    expect(bar).toBeInTheDocument();
  });

  it("shows insufficient data warning when hasSufficientData is false", () => {
    renderYourLuck({
      ...baseLuck,
      hasSufficientData: false,
    });
    expect(
      screen.getByText(/not enough data for a reliable comparison/i),
    ).toBeInTheDocument();
  });

  it("hides insufficient data warning when hasSufficientData is true", () => {
    renderYourLuck({
      ...baseLuck,
      hasSufficientData: true,
    });
    expect(
      screen.queryByText(/not enough data for a reliable comparison/i),
    ).not.toBeInTheDocument();
  });

  it("does not render luck ratio when ratio is 1", () => {
    renderYourLuck({
      ...baseLuck,
      luckRatio: 1,
    });
    expect(screen.queryByText("1.00×")).not.toBeInTheDocument();
    expect(screen.queryByText("Luck ratio")).not.toBeInTheDocument();
  });

  it("does not render luck ratio when ratio is 0", () => {
    renderYourLuck({
      ...baseLuck,
      luckRatio: 0,
    });
    expect(screen.queryByText("0.00×")).not.toBeInTheDocument();
  });

  it("does not render luck ratio when ratio is Infinity", () => {
    renderYourLuck({
      ...baseLuck,
      luckRatio: Infinity,
    });
    expect(screen.queryByText("Infinity×")).not.toBeInTheDocument();
    expect(screen.queryByText("Luck ratio")).not.toBeInTheDocument();
  });

  it("renders Expected and Actual labels", () => {
    renderYourLuck(baseLuck);
    expect(screen.getByText("Expected")).toBeInTheDocument();
    expect(screen.getByText("Actual")).toBeInTheDocument();
  });

  it("renders visual bar with correct width based on luckRatio", () => {
    const { container } = renderYourLuck(baseLuck);
    const barContainer = container.querySelector(
      ".bg-base-300.rounded-full.overflow-hidden",
    );
    expect(barContainer).toBeInTheDocument();
    const bar = barContainer?.querySelector(
      ".rounded-full.transition-all",
    ) as HTMLElement;
    expect(bar).toBeInTheDocument();
    // width = Math.min(Math.max((2.0 / 2) * 100, 5), 100) = 100%
    expect(bar.style.width).toBe("100%");
  });

  it("applies correct background class for success color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      color: "success",
    });
    const panel = container.querySelector(
      ".bg-success\\/10.border-success\\/20",
    );
    expect(panel).toBeInTheDocument();
  });

  it("applies correct background class for error color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      color: "error",
    });
    const panel = container.querySelector(".bg-error\\/10.border-error\\/20");
    expect(panel).toBeInTheDocument();
  });

  it("applies correct background class for warning color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      color: "warning",
    });
    const panel = container.querySelector(
      ".bg-warning\\/10.border-warning\\/20",
    );
    expect(panel).toBeInTheDocument();
  });

  it("calls getLuckComparison with totalWeight from profitForecast", () => {
    const { mockState } = renderYourLuck(baseLuck);
    expect(mockState.cardDetails.getLuckComparison).toHaveBeenCalledWith(10000);
  });
});
