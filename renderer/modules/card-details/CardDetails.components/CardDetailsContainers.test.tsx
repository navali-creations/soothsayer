import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useProfitForecast } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useProfitForecast: vi.fn(),
}));

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
import CardDetailsRelatedCards from "./CardDetailsRelatedCards/CardDetailsRelatedCards";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
//  CardDetailsDropStats
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropStats", () => {
  it("returns null when personalAnalytics has no weight", () => {
    vi.mocked(useCardDetails).mockReturnValue({
      personalAnalytics: null,
    } as any);
    vi.mocked(useProfitForecast).mockReturnValue({
      totalWeight: 0,
      rows: [],
    } as any);
    const { container } = renderWithProviders(<CardDetailsDropStats />);
    expect(container.innerHTML).toBe("");
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
    vi.mocked(useCardDetails).mockReturnValue({
      relatedCards: null,
      isLoadingRelatedCards: false,
      ...overrides,
    } as any);
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
