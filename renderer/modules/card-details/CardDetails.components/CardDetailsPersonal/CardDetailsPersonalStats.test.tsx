import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useCardDetails: vi.fn() }));

// ─── Sub-component stubs ───────────────────────────────────────────────────

vi.mock("./PersonalStatsError", () => ({
  default: ({ message }: any) => <div data-testid="error">{message}</div>,
}));

vi.mock("./PersonalStatsNeverFound", () => ({
  default: () => <div data-testid="never-found" />,
}));

vi.mock("./PersonalStatsPlaceholder", () => ({
  default: () => <div data-testid="placeholder" />,
}));

vi.mock("../../helpers", () => ({
  formatRelativeDate: vi.fn((_date: string) => ({
    relative: "2 days ago",
    absolute: "Jan 15, 2024",
  })),
}));

vi.mock("~/renderer/components", () => ({
  GroupedStats: ({ children, ...props }: any) => (
    <div data-testid="grouped-stats" {...props}>
      {children}
    </div>
  ),
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children }: any) => (
        <div data-testid="stat-title">{children}</div>
      ),
      Value: ({ children }: any) => (
        <div data-testid="stat-value">{children}</div>
      ),
      Desc: ({ children }: any) => (
        <div data-testid="stat-desc">{children}</div>
      ),
    },
  ),
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsPersonal from "./CardDetailsPersonal";

// ─── Helpers ───────────────────────────────────────────────────────────────

const validPersonalAnalytics = {
  cardName: "The Doctor",
  totalLifetimeDrops: 42,
  firstDiscoveredAt: "2024-01-10T00:00:00Z",
  lastSeenAt: "2024-06-15T00:00:00Z",
  sessionCount: 8,
  averageDropsPerSession: 5.25,
  fromBoss: false,
  prohibitedLibrary: {
    weight: 50,
    rarity: 2 as const,
    fromBoss: false,
  },
  totalDecksOpenedAllSessions: 10000,
  dropTimeline: [],
  leagueDateRanges: [],
  firstSessionStartedAt: "2024-01-01T00:00:00Z",
  timelineEndDate: "2024-07-01T00:00:00Z",
};

function createMockState(overrides: Record<string, any> = {}) {
  return {
    personalAnalytics: null,
    personalAnalyticsError: null,
    ...overrides,
  };
}

function renderComponent(overrides: Record<string, any> = {}) {
  const mockState = createMockState(overrides);
  vi.mocked(useCardDetails).mockReturnValue(mockState as any);
  return renderWithProviders(<CardDetailsPersonal />);
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Error state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — error state", () => {
  it("shows error state with message", () => {
    renderComponent({ personalAnalyticsError: "Failed to load analytics" });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByText("Failed to load analytics")).toBeInTheDocument();
  });

  it("does not render stats when error is present", () => {
    renderComponent({ personalAnalyticsError: "Network error" });
    expect(screen.queryByTestId("grouped-stats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Placeholder state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — placeholder state", () => {
  it("shows placeholder when personalAnalytics is null", () => {
    renderComponent({ personalAnalytics: null });
    expect(screen.getByTestId("placeholder")).toBeInTheDocument();
  });

  it("does not render stats or error when placeholder is shown", () => {
    renderComponent({ personalAnalytics: null });
    expect(screen.queryByTestId("grouped-stats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("error")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Never-found state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — never-found state", () => {
  it("shows never-found when totalLifetimeDrops is 0", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });
    expect(screen.getByTestId("never-found")).toBeInTheDocument();
  });

  it("does not render stats when totalLifetimeDrops is 0", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });
    expect(screen.queryByTestId("grouped-stats")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Normal render — stat values
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — normal render", () => {
  it("renders GroupedStats container", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByTestId("grouped-stats")).toBeInTheDocument();
  });

  it("shows Total Drops stat with formatted count", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Total Drops")).toBeInTheDocument();
    // 42 toLocaleString() should be "42"
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows Total Drops count formatted with locale separators for large numbers", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 1234,
      },
    });
    // 1234.toLocaleString() → "1,234"
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it('shows "Across all sessions" description for Total Drops', () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Across all sessions")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Drop Rate stat
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — Drop Rate", () => {
  it("shows Drop Rate stat when decks > 0", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Drop Rate")).toBeInTheDocument();
  });

  it('shows "—" for Drop Rate when no decks opened', () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalDecksOpenedAllSessions: 0,
      },
    });
    expect(screen.getByText("Drop Rate")).toBeInTheDocument();
    // The "—" should appear as the stat value
    const statValues = screen.getAllByTestId("stat-value");
    const dropRateValue = statValues[1]; // second stat is Drop Rate
    expect(dropRateValue).toHaveTextContent("—");
  });

  it('shows "Drops per cards opened" description when no decks', () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalDecksOpenedAllSessions: 0,
      },
    });
    expect(screen.getByText("Drops per cards opened")).toBeInTheDocument();
  });

  it("formats drop rate correctly for rates >= 1%", () => {
    // 42 / 1000 * 100 = 4.20%
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 42,
        totalDecksOpenedAllSessions: 1000,
      },
    });
    expect(screen.getByText("4.20%")).toBeInTheDocument();
  });

  it("formats drop rate correctly for very small rates", () => {
    // 1 / 100000 * 100 = 0.001% — rate < 1, leadingZeros = 3, toFixed(5)
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 1,
        totalDecksOpenedAllSessions: 100000,
      },
    });
    expect(screen.getByText("0.00100%")).toBeInTheDocument();
  });

  it("shows drop count and deck count in description when decks > 0", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 42,
        totalDecksOpenedAllSessions: 10000,
      },
    });
    expect(screen.getByText("42 in 10,000 cards")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// First Found stat
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — First Found", () => {
  it("shows First Found stat when firstDiscoveredAt exists", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("First Found")).toBeInTheDocument();
    // Our mock returns "2 days ago" for relative — both First Found and Last Seen
    // render this value, so use getAllByText
    const relativeDates = screen.getAllByText("2 days ago");
    expect(relativeDates.length).toBeGreaterThanOrEqual(1);
  });

  it("shows absolute date in First Found description", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    // Our mock returns "Jan 15, 2024" for absolute
    // There are two instances (First Found + Last Seen), just check it exists
    const absoluteDates = screen.getAllByText("Jan 15, 2024");
    expect(absoluteDates.length).toBeGreaterThanOrEqual(1);
  });

  it("hides First Found stat when firstDiscoveredAt is null", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        firstDiscoveredAt: null,
      },
    });
    expect(screen.queryByText("First Found")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Last Seen stat
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — Last Seen", () => {
  it("shows Last Seen stat when lastSeenAt exists", () => {
    renderComponent({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Last Seen")).toBeInTheDocument();
  });

  it("hides Last Seen stat when lastSeenAt is null", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        lastSeenAt: null,
      },
    });
    expect(screen.queryByText("Last Seen")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Priority of early-return states
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal — state priority", () => {
  it("error takes priority over null personalAnalytics", () => {
    renderComponent({
      personalAnalytics: null,
      personalAnalyticsError: "Error occurred",
    });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
  });

  it("error takes priority over valid personalAnalytics", () => {
    renderComponent({
      personalAnalytics: validPersonalAnalytics,
      personalAnalyticsError: "Error occurred",
    });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.queryByTestId("grouped-stats")).not.toBeInTheDocument();
  });
});
