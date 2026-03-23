import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Sub-component stubs ───────────────────────────────────────────────────

vi.mock("./RelatedCardsSection", () => ({
  default: ({ title, cards }: any) => (
    <div data-testid={`section-${title}`}>{cards.length} cards</div>
  ),
}));

// ─── Icon stubs ────────────────────────────────────────────────────────────

vi.mock("react-icons/fi", () => ({
  FiGitBranch: (props: any) => <span {...props} />,
  FiLink: (props: any) => <span {...props} />,
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsRelatedCards from "./CardDetailsRelatedCards";

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function createMockState(overrides: Record<string, any> = {}) {
  return {
    cardDetails: {
      relatedCards: null,
      isLoadingRelatedCards: false,
      ...overrides,
    },
  };
}

function renderComponent(overrides: Record<string, any> = {}) {
  const mockState = createMockState(overrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  return renderWithProviders(<CardDetailsRelatedCards />);
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Null / early-return states
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsRelatedCards — null states", () => {
  it("returns null when isLoadingRelatedCards is true", () => {
    const { container } = renderComponent({ isLoadingRelatedCards: true });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when relatedCards is null", () => {
    const { container } = renderComponent({ relatedCards: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when loading even if relatedCards has data", () => {
    const { container } = renderComponent({
      isLoadingRelatedCards: true,
      relatedCards: {
        similarCards: [makeRelatedCard("Card A")],
        chainCards: [makeRelatedCard("Card B")],
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when both similarCards and chainCards are empty", () => {
    const { container } = renderComponent({
      relatedCards: {
        similarCards: [],
        chainCards: [],
      },
    });
    expect(container.innerHTML).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Normal render — both sections
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsRelatedCards — normal render", () => {
  it("renders Card Chain section with chain cards", () => {
    renderComponent({
      relatedCards: {
        chainCards: [
          makeRelatedCard("The Patient"),
          makeRelatedCard("The Nurse"),
        ],
        similarCards: [],
      },
    });
    const section = screen.getByTestId("section-Card Chain");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("2 cards");
  });

  it("renders Similar Cards section with similar cards", () => {
    renderComponent({
      relatedCards: {
        chainCards: [],
        similarCards: [
          makeRelatedCard("The Fiend"),
          makeRelatedCard("The Doctor"),
        ],
      },
    });
    const section = screen.getByTestId("section-Similar Cards");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("2 cards");
  });

  it("renders both sections when both have cards", () => {
    renderComponent({
      relatedCards: {
        chainCards: [makeRelatedCard("The Patient")],
        similarCards: [makeRelatedCard("The Fiend")],
      },
    });
    expect(screen.getByTestId("section-Card Chain")).toBeInTheDocument();
    expect(screen.getByTestId("section-Similar Cards")).toBeInTheDocument();
  });

  it("renders only Card Chain when similarCards is empty", () => {
    renderComponent({
      relatedCards: {
        chainCards: [makeRelatedCard("The Nurse")],
        similarCards: [],
      },
    });
    expect(screen.getByTestId("section-Card Chain")).toBeInTheDocument();
    // RelatedCardsSection returns null for empty cards array (our stub still renders),
    // but the container component passes the cards through regardless — the section
    // stub will render "0 cards" for the empty array.
    expect(screen.getByTestId("section-Similar Cards")).toHaveTextContent(
      "0 cards",
    );
  });

  it("renders only Similar Cards when chainCards is empty", () => {
    renderComponent({
      relatedCards: {
        chainCards: [],
        similarCards: [makeRelatedCard("The Fiend")],
      },
    });
    expect(screen.getByTestId("section-Similar Cards")).toBeInTheDocument();
    expect(screen.getByTestId("section-Card Chain")).toHaveTextContent(
      "0 cards",
    );
  });

  it("passes correct card count to Card Chain section", () => {
    const chainCards = [
      makeRelatedCard("The Patient"),
      makeRelatedCard("The Nurse"),
      makeRelatedCard("The Doctor"),
    ];
    renderComponent({
      relatedCards: {
        chainCards,
        similarCards: [],
      },
    });
    expect(screen.getByTestId("section-Card Chain")).toHaveTextContent(
      "3 cards",
    );
  });

  it("passes correct card count to Similar Cards section", () => {
    const similarCards = [
      makeRelatedCard("Card A"),
      makeRelatedCard("Card B"),
      makeRelatedCard("Card C"),
      makeRelatedCard("Card D"),
    ];
    renderComponent({
      relatedCards: {
        chainCards: [],
        similarCards,
      },
    });
    expect(screen.getByTestId("section-Similar Cards")).toHaveTextContent(
      "4 cards",
    );
  });
});
