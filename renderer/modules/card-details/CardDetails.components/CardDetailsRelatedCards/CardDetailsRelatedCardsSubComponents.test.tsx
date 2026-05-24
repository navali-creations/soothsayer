import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ═══════════════════════════════════════════════════════════════════════════
// Mocks — vi.mock() calls are hoisted to the top by Vitest automatically
// ═══════════════════════════════════════════════════════════════════════════

// ─── Mock RelatedCardChip (for RelatedCardsSection tests) ────────────────

vi.mock("./RelatedCardChip", () => ({
  default: ({ card }: any) => (
    <div data-testid={`chip-${card.name}`}>{card.name}</div>
  ),
}));

// ─── Component imports (after all mocks) ─────────────────────────────────

import RelatedCardsSection from "./RelatedCardsSection";

// ─── Helpers ─────────────────────────────────────────────────────────────

const makeRelatedCard = (
  name: string,
  overrides: Record<string, any> = {},
) => ({
  name,
  stackSize: 5,
  rarity: 2,
  rewardHtml: "<p>Reward</p>",
  artSrc: `${name}.png`,
  fromBoss: false,
  poeNinjaRarity: 2,
  plRarity: 2,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// RelatedCardsSection
// ═══════════════════════════════════════════════════════════════════════════

describe("RelatedCardsSection", () => {
  it("returns null when cards array is empty", () => {
    const { container } = renderWithProviders(
      <RelatedCardsSection
        title="Card Chain"
        icon={<span data-testid="icon">🔗</span>}
        cards={[]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the title text", () => {
    renderWithProviders(
      <RelatedCardsSection
        title="Card Chain"
        icon={<span>🔗</span>}
        cards={[makeRelatedCard("The Doctor")]}
      />,
    );
    expect(screen.getByText("Card Chain")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    renderWithProviders(
      <RelatedCardsSection
        title="Similar Cards"
        icon={<span data-testid="section-icon">⭐</span>}
        cards={[makeRelatedCard("The Fiend")]}
      />,
    );
    expect(screen.getByTestId("section-icon")).toBeInTheDocument();
  });

  it("renders correct number of RelatedCardChip components", () => {
    const cards = [
      makeRelatedCard("The Doctor"),
      makeRelatedCard("The Nurse"),
      makeRelatedCard("The Patient"),
    ];
    renderWithProviders(
      <RelatedCardsSection
        title="Card Chain"
        icon={<span>🔗</span>}
        cards={cards}
      />,
    );
    expect(screen.getByTestId("chip-The Doctor")).toBeInTheDocument();
    expect(screen.getByTestId("chip-The Nurse")).toBeInTheDocument();
    expect(screen.getByTestId("chip-The Patient")).toBeInTheDocument();
  });

  it("passes correct card to each chip", () => {
    const cards = [
      makeRelatedCard("The Fiend"),
      makeRelatedCard("The Immortal"),
    ];
    renderWithProviders(
      <RelatedCardsSection
        title="Similar Cards"
        icon={<span>⭐</span>}
        cards={cards}
      />,
    );
    expect(screen.getByTestId("chip-The Fiend")).toHaveTextContent("The Fiend");
    expect(screen.getByTestId("chip-The Immortal")).toHaveTextContent(
      "The Immortal",
    );
  });
});
