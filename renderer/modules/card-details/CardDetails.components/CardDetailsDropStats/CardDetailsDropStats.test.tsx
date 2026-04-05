import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useProfitForecast } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useProfitForecast: vi.fn(),
}));

// ─── Sub-component stubs ───────────────────────────────────────────────────

vi.mock("./DropProbabilitySection", () => ({
  default: () => <div data-testid="drop-probability" />,
}));

vi.mock("./EvContributionSection", () => ({
  default: () => <div data-testid="ev-contribution" />,
}));

vi.mock("./YourLuckSection", () => ({
  default: () => <div data-testid="your-luck" />,
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsDropStats from "./CardDetailsDropStats";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(
  overrides: { personalAnalytics?: any; totalWeight?: number } = {},
) {
  return {
    cardDetails: {
      personalAnalytics: overrides.personalAnalytics ?? null,
    },
    profitForecast: {
      totalWeight: overrides.totalWeight ?? 1000,
    },
  };
}

const validPersonalAnalytics = {
  cardName: "The Doctor",
  totalLifetimeDrops: 5,
  firstDiscoveredAt: "2024-01-10T00:00:00Z",
  lastSeenAt: "2024-06-15T00:00:00Z",
  sessionCount: 3,
  averageDropsPerSession: 1.67,
  fromBoss: false,
  prohibitedLibrary: {
    weight: 50,
    rarity: 2,
    fromBoss: false,
  },
  totalDecksOpenedAllSessions: 10000,
  dropTimeline: [],
  leagueDateRanges: [],
  firstSessionStartedAt: "2024-01-01T00:00:00Z",
  timelineEndDate: "2024-07-01T00:00:00Z",
};

function renderComponent(
  overrides: { personalAnalytics?: any; totalWeight?: number } = {},
) {
  const mockState = createMockState(overrides);
  vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);
  vi.mocked(useProfitForecast).mockReturnValue(mockState.profitForecast as any);
  return renderWithProviders(<CardDetailsDropStats />);
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Null / early-return states
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropStats — null states", () => {
  it("returns null when personalAnalytics is null", () => {
    const { container } = renderComponent({ personalAnalytics: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when prohibitedLibrary is null", () => {
    const { container } = renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: null,
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when prohibitedLibrary is undefined", () => {
    const { container } = renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: undefined,
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when weight is 0", () => {
    const { container } = renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: { weight: 0, rarity: 2, fromBoss: false },
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when weight is negative", () => {
    const { container } = renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: { weight: -1, rarity: 2, fromBoss: false },
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalWeight is 0", () => {
    const { container } = renderComponent({
      personalAnalytics: validPersonalAnalytics,
      totalWeight: 0,
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalWeight is negative", () => {
    const { container } = renderComponent({
      personalAnalytics: validPersonalAnalytics,
      totalWeight: -100,
    });
    expect(container.innerHTML).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Normal render
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropStats — normal render", () => {
  it('renders "Drop Statistics" heading', () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Drop Statistics")).toBeInTheDocument();
  });

  it("renders DropProbabilitySection", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByTestId("drop-probability")).toBeInTheDocument();
  });

  it("renders EvContributionSection", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByTestId("ev-contribution")).toBeInTheDocument();
  });

  it("renders YourLuckSection when totalLifetimeDrops > 0", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 5,
      },
    });
    expect(screen.getByTestId("your-luck")).toBeInTheDocument();
  });

  it("does not render YourLuckSection when totalLifetimeDrops is 0", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });
    expect(screen.queryByTestId("your-luck")).not.toBeInTheDocument();
  });

  it("still renders drop probability and EV sections when totalLifetimeDrops is 0", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });
    expect(screen.getByTestId("drop-probability")).toBeInTheDocument();
    expect(screen.getByTestId("ev-contribution")).toBeInTheDocument();
  });
});
