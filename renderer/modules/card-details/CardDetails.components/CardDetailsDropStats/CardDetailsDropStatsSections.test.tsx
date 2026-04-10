import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useProfitForecast } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useProfitForecast: vi.fn(),
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import DropProbabilitySection from "./DropProbabilitySection";
import EvContributionSection from "./EvContributionSection";
import YourLuckSection from "./YourLuckSection";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createDropProbabilityState(probability: number | null) {
  return {
    cardDetails: {
      personalAnalytics:
        probability !== null ? { cardName: "Test Card" } : null,
    },
    profitForecast: {
      rows:
        probability !== null
          ? [
              {
                cardName: "Test Card",
                probability,
                evContribution: 0,
              },
            ]
          : [],
    },
  };
}

function renderDropProbability(probability: number | null) {
  const mockState = createDropProbabilityState(probability);
  vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);
  vi.mocked(useProfitForecast).mockReturnValue(mockState.profitForecast as any);
  const result = renderWithProviders(<DropProbabilitySection />);
  return { ...result, mockState };
}

function createEvContributionState(overrides: { ev: number | null }) {
  return {
    cardDetails: {
      personalAnalytics:
        overrides.ev !== null ? { cardName: "Test Card" } : null,
    },
    profitForecast: {
      rows:
        overrides.ev !== null
          ? [
              {
                cardName: "Test Card",
                probability: 0.05,
                evContribution: overrides.ev,
              },
            ]
          : [],
    },
  };
}

function renderEvContribution(overrides: { ev: number | null }) {
  const mockState = createEvContributionState(overrides);
  vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);
  vi.mocked(useProfitForecast).mockReturnValue(mockState.profitForecast as any);
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
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => luck),
    },
    profitForecast: {
      rows: [{ cardName: "Test Card", probability: 0.05 }],
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
  vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);
  vi.mocked(useProfitForecast).mockReturnValue(mockState.profitForecast as any);
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
  it("returns null when no matching row", () => {
    const { container } = renderDropProbability(null);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when probability is 0", () => {
    const { container } = renderDropProbability(0);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when probability is negative", () => {
    const { container } = renderDropProbability(-0.01);
    expect(container.innerHTML).toBe("");
  });

  it('renders "Drop Chance" label', () => {
    renderDropProbability(0.002);
    expect(screen.getByText("Drop Chance")).toBeInTheDocument();
  });

  it("renders drop chance formatted text", () => {
    // probability = 0.002 → 1/0.002 = 500 → "1 in 500"
    renderDropProbability(0.002);
    expect(screen.getByText("1 in 500")).toBeInTheDocument();
  });

  it("renders percent formatted text", () => {
    // probability = 0.002 → 0.2% → "0.2000%"
    renderDropProbability(0.002);
    expect(screen.getByText("0.2000%")).toBeInTheDocument();
  });

  it('renders "Expected Decks" label', () => {
    renderDropProbability(0.002);
    expect(screen.getByText("Expected Decks")).toBeInTheDocument();
  });

  it("renders expected decks count rounded and locale-formatted", () => {
    // probability = 1/1234.56 → expectedDecks = 1234.56 → round → 1235 → "1,235"
    renderDropProbability(1 / 1234.56);
    expect(screen.getByText("1,235")).toBeInTheDocument();
  });

  it('renders "decks to find one on average" description', () => {
    renderDropProbability(0.002);
    expect(
      screen.getByText("decks to find one on average"),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EvContributionSection
// ═══════════════════════════════════════════════════════════════════════════

describe("EvContributionSection", () => {
  it("returns null when no matching row", () => {
    const { container } = renderEvContribution({ ev: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when evContribution is 0", () => {
    const { container } = renderEvContribution({ ev: 0 });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when evContribution is negative", () => {
    const { container } = renderEvContribution({ ev: -0.5 });
    expect(container.innerHTML).toBe("");
  });

  it('renders "EV Contribution" label', () => {
    renderEvContribution({ ev: 1.5 });
    expect(screen.getByText("EV Contribution")).toBeInTheDocument();
  });

  it("renders formatted EV with 2 decimals for ev >= 1", () => {
    renderEvContribution({ ev: 2.456789 });
    expect(screen.getByText(/2\.46/)).toBeInTheDocument();
  });

  it("renders formatted EV with 4 decimals for ev >= 0.01", () => {
    renderEvContribution({ ev: 0.0567 });
    expect(screen.getByText(/0\.0567/)).toBeInTheDocument();
  });

  it("renders formatted EV in exponential for very small ev", () => {
    renderEvContribution({ ev: 0.00123 });
    expect(screen.getByText(/1\.23e-3/)).toBeInTheDocument();
  });

  it('renders "chaos per deck" label', () => {
    renderEvContribution({ ev: 1.5 });
    expect(screen.getByText("chaos per deck")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// YourLuckSection
// ═══════════════════════════════════════════════════════════════════════════

describe("YourLuckSection", () => {
  const baseLuck = {
    label: "3.0× luckier than average",
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
    expect(screen.getByText("3.0× luckier than average")).toBeInTheDocument();
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
    const label = screen.getByText("3.0× luckier than average");
    expect(label.className).toContain("text-success");

    const bar = container.querySelector(".bg-success");
    expect(bar).toBeInTheDocument();
  });

  it("uses text-error class for error color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      label: "0.1× — below expected",
      color: "error",
    });
    const label = screen.getByText("0.1× — below expected");
    expect(label.className).toContain("text-error");

    const bar = container.querySelector(".bg-error");
    expect(bar).toBeInTheDocument();
  });

  it("uses text-warning class for warning color", () => {
    const { container } = renderYourLuck({
      ...baseLuck,
      label: "About average",
      color: "warning",
    });
    const label = screen.getByText("About average");
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

  it("calls getLuckComparison with probability from forecast row", () => {
    const { mockState } = renderYourLuck(baseLuck);
    expect(mockState.cardDetails.getLuckComparison).toHaveBeenCalledWith(0.05);
  });
});
