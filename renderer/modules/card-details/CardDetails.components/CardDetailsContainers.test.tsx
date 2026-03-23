import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── CardDetailsDropStats sub-component stubs ──────────────────────────────

vi.mock("./CardDetailsDropStats/DropProbabilitySection", () => ({
  default: () => <div data-testid="drop-probability" />,
}));

vi.mock("./CardDetailsDropStats/EvContributionSection", () => ({
  default: () => <div data-testid="ev-contribution" />,
}));

vi.mock("./CardDetailsDropStats/YourLuckSection", () => ({
  default: () => <div data-testid="your-luck" />,
}));

// ─── CardDetailsPersonal sub-component stubs ───────────────────────────────

vi.mock("./CardDetailsPersonal/PersonalStatsError", () => ({
  default: ({ message }: { message: string }) => (
    <div data-testid="stats-error">{message}</div>
  ),
}));

vi.mock("./CardDetailsPersonal/PersonalStatsNeverFound", () => ({
  default: () => <div data-testid="never-found" />,
}));

vi.mock("./CardDetailsPersonal/PersonalStatsPlaceholder", () => ({
  default: () => <div data-testid="placeholder" />,
}));

vi.mock("../helpers", () => ({
  formatRelativeDate: vi.fn(() => ({
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
        <span data-testid="stat-title">{children}</span>
      ),
      Value: ({ children }: any) => (
        <span data-testid="stat-value">{children}</span>
      ),
      Desc: ({ children }: any) => (
        <span data-testid="stat-desc">{children}</span>
      ),
    },
  ),
}));

// ─── CardDetailsRelatedCards sub-component stubs ───────────────────────────

vi.mock("./CardDetailsRelatedCards/RelatedCardsSection", () => ({
  default: ({ title, cards }: { title: string; cards: any[] }) => (
    <div data-testid={`section-${title.toLowerCase().replace(/\s/g, "-")}`}>
      {cards.length} cards
    </div>
  ),
}));

// ─── Icon stubs (used by RelatedCards) ─────────────────────────────────────

vi.mock("react-icons/fi", () => ({
  FiGitBranch: (props: any) => <span {...props} />,
  FiLink: (props: any) => <span {...props} />,
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import CardDetailsDropStats from "./CardDetailsDropStats/CardDetailsDropStats";
import CardDetailsPersonal from "./CardDetailsPersonal/CardDetailsPersonal";
import CardDetailsRelatedCards from "./CardDetailsRelatedCards/CardDetailsRelatedCards";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
//  CardDetailsDropStats
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropStats", () => {
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

  function renderDropStats(
    overrides: { personalAnalytics?: any; totalWeight?: number } = {},
  ) {
    const mockState = {
      cardDetails: {
        personalAnalytics: overrides.personalAnalytics ?? null,
      },
      profitForecast: {
        totalWeight: overrides.totalWeight ?? 1000,
      },
    };
    vi.mocked(useBoundStore).mockReturnValue(mockState as any);
    return renderWithProviders(<CardDetailsDropStats />);
  }

  // ── Null / early-return states ───────────────────────────────────────────

  it("returns null when personalAnalytics is null", () => {
    const { container } = renderDropStats({ personalAnalytics: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when prohibitedLibrary is missing", () => {
    const { container } = renderDropStats({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: undefined,
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when weight is 0", () => {
    const { container } = renderDropStats({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: { weight: 0, rarity: 2, fromBoss: false },
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalWeight is 0", () => {
    const { container } = renderDropStats({
      personalAnalytics: validPersonalAnalytics,
      totalWeight: 0,
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null with negative weight", () => {
    const { container } = renderDropStats({
      personalAnalytics: {
        ...validPersonalAnalytics,
        prohibitedLibrary: { weight: -5, rarity: 2, fromBoss: false },
      },
    });
    expect(container.innerHTML).toBe("");
  });

  // ── Normal render ────────────────────────────────────────────────────────

  it('renders "Drop Statistics" heading', () => {
    renderDropStats({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Drop Statistics")).toBeInTheDocument();
  });

  it("renders DropProbabilitySection", () => {
    renderDropStats({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByTestId("drop-probability")).toBeInTheDocument();
  });

  it("renders EvContributionSection", () => {
    renderDropStats({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByTestId("ev-contribution")).toBeInTheDocument();
  });

  it("renders YourLuckSection when totalLifetimeDrops > 0", () => {
    renderDropStats({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 5,
      },
    });
    expect(screen.getByTestId("your-luck")).toBeInTheDocument();
  });

  it("does not render YourLuckSection when totalLifetimeDrops is 0", () => {
    renderDropStats({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });
    expect(screen.queryByTestId("your-luck")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CardDetailsPersonal
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPersonal", () => {
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

  function renderPersonal(overrides: Record<string, any> = {}) {
    const mockState = {
      cardDetails: {
        personalAnalytics: null,
        personalAnalyticsError: null,
        ...overrides,
      },
    };
    vi.mocked(useBoundStore).mockReturnValue(mockState as any);
    return renderWithProviders(<CardDetailsPersonal />);
  }

  // ── Error state ──────────────────────────────────────────────────────────

  it("renders error state with message", () => {
    renderPersonal({ personalAnalyticsError: "Failed to load analytics" });
    expect(screen.getByTestId("stats-error")).toBeInTheDocument();
    expect(screen.getByText("Failed to load analytics")).toBeInTheDocument();
  });

  // ── Placeholder state ────────────────────────────────────────────────────

  it("renders placeholder when no personalAnalytics", () => {
    renderPersonal({ personalAnalytics: null });
    expect(screen.getByTestId("placeholder")).toBeInTheDocument();
  });

  // ── Never-found state ────────────────────────────────────────────────────

  it("renders never-found when totalLifetimeDrops is 0", () => {
    renderPersonal({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });
    expect(screen.getByTestId("never-found")).toBeInTheDocument();
  });

  // ── Normal render — stat labels ──────────────────────────────────────────

  it("renders Total Drops stat text", () => {
    renderPersonal({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Total Drops")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders Drop Rate when totalDecksOpenedAllSessions > 0", () => {
    renderPersonal({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Drop Rate")).toBeInTheDocument();
    // 42 / 10000 * 100 = 0.42% → rate < 1, leadingZeros = 0, toFixed(2)
    expect(screen.getByText("0.42%")).toBeInTheDocument();
  });

  it('shows "—" for Drop Rate when 0 decks opened', () => {
    renderPersonal({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalDecksOpenedAllSessions: 0,
      },
    });
    expect(screen.getByText("Drop Rate")).toBeInTheDocument();
    const statValues = screen.getAllByTestId("stat-value");
    // Second stat is Drop Rate (index 1)
    const dropRateValue = statValues[1];
    expect(dropRateValue).toHaveTextContent("—");
  });

  it("renders First Found when firstDiscoveredAt exists", () => {
    renderPersonal({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("First Found")).toBeInTheDocument();
    // Both First Found and Last Seen share the same mocked relative date
    expect(screen.getAllByText("2 days ago").length).toBeGreaterThanOrEqual(1);
  });

  it("hides First Found when firstDiscoveredAt is null", () => {
    renderPersonal({
      personalAnalytics: {
        ...validPersonalAnalytics,
        firstDiscoveredAt: null,
      },
    });
    expect(screen.queryByText("First Found")).not.toBeInTheDocument();
  });

  it("renders Last Seen when lastSeenAt exists", () => {
    renderPersonal({ personalAnalytics: validPersonalAnalytics });
    expect(screen.getByText("Last Seen")).toBeInTheDocument();
  });

  it("hides Last Seen when lastSeenAt is null", () => {
    renderPersonal({
      personalAnalytics: {
        ...validPersonalAnalytics,
        lastSeenAt: null,
      },
    });
    expect(screen.queryByText("Last Seen")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CardDetailsRelatedCards
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsRelatedCards", () => {
  const makeRelatedCard = (name: string) => ({
    name,
    stackSize: 5,
    rarity: 2,
    rewardHtml: "<p>Reward</p>",
    artSrc: `${name}.png`,
    fromBoss: false,
    poeNinjaRarity: 2,
    plRarity: 2,
  });

  function renderRelated(overrides: Record<string, any> = {}) {
    const mockState = {
      cardDetails: {
        relatedCards: null,
        isLoadingRelatedCards: false,
        ...overrides,
      },
    };
    vi.mocked(useBoundStore).mockReturnValue(mockState as any);
    return renderWithProviders(<CardDetailsRelatedCards />);
  }

  // ── Null / early-return states ───────────────────────────────────────────

  it("returns null when loading", () => {
    const { container } = renderRelated({ isLoadingRelatedCards: true });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when relatedCards is null", () => {
    const { container } = renderRelated({ relatedCards: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when both lists are empty", () => {
    const { container } = renderRelated({
      relatedCards: { similarCards: [], chainCards: [] },
    });
    expect(container.innerHTML).toBe("");
  });

  // ── Normal render ────────────────────────────────────────────────────────

  it("renders Card Chain section when chainCards has items", () => {
    renderRelated({
      relatedCards: {
        chainCards: [makeRelatedCard("The Patient")],
        similarCards: [],
      },
    });
    const section = screen.getByTestId("section-card-chain");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("1 cards");
  });

  it("renders Similar Cards section when similarCards has items", () => {
    renderRelated({
      relatedCards: {
        chainCards: [],
        similarCards: [makeRelatedCard("The Fiend")],
      },
    });
    const section = screen.getByTestId("section-similar-cards");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("1 cards");
  });

  it("renders both sections when both have data", () => {
    renderRelated({
      relatedCards: {
        chainCards: [makeRelatedCard("The Patient")],
        similarCards: [makeRelatedCard("The Fiend")],
      },
    });
    expect(screen.getByTestId("section-card-chain")).toBeInTheDocument();
    expect(screen.getByTestId("section-similar-cards")).toBeInTheDocument();
  });

  it("renders only chain section content when similar is empty", () => {
    renderRelated({
      relatedCards: {
        chainCards: [
          makeRelatedCard("The Patient"),
          makeRelatedCard("The Nurse"),
        ],
        similarCards: [],
      },
    });
    expect(screen.getByTestId("section-card-chain")).toHaveTextContent(
      "2 cards",
    );
    // Similar Cards section still renders (component always passes both),
    // but with 0 cards
    expect(screen.getByTestId("section-similar-cards")).toHaveTextContent(
      "0 cards",
    );
  });

  it("renders only similar section content when chain is empty", () => {
    renderRelated({
      relatedCards: {
        chainCards: [],
        similarCards: [
          makeRelatedCard("The Fiend"),
          makeRelatedCard("The Doctor"),
          makeRelatedCard("House of Mirrors"),
        ],
      },
    });
    expect(screen.getByTestId("section-similar-cards")).toHaveTextContent(
      "3 cards",
    );
    expect(screen.getByTestId("section-card-chain")).toHaveTextContent(
      "0 cards",
    );
  });
});
