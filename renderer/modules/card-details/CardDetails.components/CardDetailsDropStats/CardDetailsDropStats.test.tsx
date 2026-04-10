import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "~/renderer/__test-setup__/render";
import { useCardDetails, useProfitForecast } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useProfitForecast: vi.fn(),
}));

// ─── Component import (after mock) ────────────────────────────────────────

import CardDetailsDropStats from "./CardDetailsDropStats";

// ─── Helpers ───────────────────────────────────────────────────────────────

function mockStore(
  overrides: {
    cardName?: string;
    probability?: number;
    totalWeight?: number;
    totalLifetimeDrops?: number;
    hasPersonalAnalytics?: boolean;
    hasMatchingRow?: boolean;
  } = {},
) {
  const {
    cardName = "Test Card",
    probability = 0.05,
    totalWeight = 10000,
    totalLifetimeDrops = 5,
    hasPersonalAnalytics = true,
    hasMatchingRow = true,
  } = overrides;

  const cardDetailsState = {
    personalAnalytics: hasPersonalAnalytics
      ? {
          cardName,
          weight: 500,
          totalLifetimeDrops,
          totalDecksOpenedAllSessions: 200,
        }
      : null,
    getLuckComparison: vi.fn(() => null),
  };

  const profitForecastState = {
    totalWeight,
    rows: hasMatchingRow
      ? [{ cardName, probability, evContribution: 1.5, chaosValue: 100 }]
      : [],
  };

  vi.mocked(useCardDetails).mockReturnValue(cardDetailsState as any);
  vi.mocked(useProfitForecast).mockReturnValue(profitForecastState as any);
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropStats", () => {
  // ── Guard conditions: should NOT render ───────────────────────────────

  it("returns null when personalAnalytics is null", () => {
    mockStore({ hasPersonalAnalytics: false });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when no matching forecast row", () => {
    mockStore({ hasMatchingRow: false });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when forecast row probability is 0", () => {
    mockStore({ probability: 0 });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when forecast row probability is negative", () => {
    mockStore({ probability: -0.01 });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalWeight is 0 (profit forecast not loaded)", () => {
    mockStore({ totalWeight: 0 });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).toBe("");
  });

  // ── Happy path: should render ────────────────────────────────────────

  it("renders Drop Statistics heading when probability and totalWeight are valid", () => {
    mockStore();
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).not.toBe("");
    expect(container.textContent).toContain("Drop Statistics");
  });

  it("renders DropProbabilitySection child", () => {
    mockStore();
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    // DropProbabilitySection reads from store hooks directly — if the
    // section renders any content it will be inside our container.
    // We verify the parent rendered (non-empty).
    expect(container.innerHTML).not.toBe("");
  });

  it("renders when totalLifetimeDrops is 0 (no luck section shown)", () => {
    mockStore({ totalLifetimeDrops: 0 });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    // Component should still render (drop probability section visible)
    expect(container.textContent).toContain("Drop Statistics");
  });

  it("renders when totalLifetimeDrops is greater than 0", () => {
    mockStore({ totalLifetimeDrops: 10 });
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.textContent).toContain("Drop Statistics");
  });
});
