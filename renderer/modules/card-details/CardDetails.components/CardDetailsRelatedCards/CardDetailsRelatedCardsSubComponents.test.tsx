import { afterEach, describe, expect, it, vi } from "vitest";

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

// ─── Mocks for RelatedCardChip tests ─────────────────────────────────────

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card">{card.name}</div>
  ),
}));

vi.mock("~/renderer/components/Link/Link", () => ({
  default: ({ children, to, params, ...props }: any) => (
    <a href={`${to}/${params?.cardSlug}`} data-testid="link" {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/hooks/usePopover/usePopover", () => ({
  usePopover: () => ({
    triggerRef: { current: null },
    popoverRef: { current: null },
  }),
}));

vi.mock("~/renderer/utils", () => ({
  cardNameToSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
  getRarityStyles: (_rarity: number) => ({
    glowRgb: "255, 215, 0",
    badgeBg: "#ffd700",
    badgeText: "#000",
    badgeBorder: "#cca600",
  }),
  RARITY_LABELS: {
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Very Rare",
    5: "Extremely Rare",
  } as Record<number, string>,
}));

vi.mock("./helpers", () => ({
  getCardImage: (src: string | null) => (src ? `img-${src}` : null),
  getDisplayRarity: (card: any) => card.rarity ?? 2,
  toCardEntry: (card: any) => ({
    name: card.name,
    stackSize: card.stackSize,
  }),
}));

// ─── Component imports (after all mocks) ─────────────────────────────────

import type RelatedCardChip from "./RelatedCardChip";
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

const makeChipCard = (overrides: Record<string, any> = {}) => ({
  name: "The Doctor",
  stackSize: 8,
  rarity: 2,
  rewardHtml: "<p>Headhunter</p>",
  artSrc: "doctor.png",
  fromBoss: false,
  poeNinjaRarity: 2,
  plRarity: 2,
  ...overrides,
});

// ─── Cleanup ─────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
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

// ═══════════════════════════════════════════════════════════════════════════
// RelatedCardChip
//
// Note: RelatedCardChip is mocked above (for RelatedCardsSection isolation).
// Because vi.mock is module-level and hoisted, we use the *mocked* version
// here. To test the *real* RelatedCardChip we call vi.mocked to get the
// actual implementation via importActual — but since the real component's
// dependencies (Link, DivinationCard, usePopover, utils, helpers) are ALL
// mocked above, we can simply import the real module with importActual
// inside each test.
// ═══════════════════════════════════════════════════════════════════════════

describe("RelatedCardChip", () => {
  // We need the real RelatedCardChip, not the stub used for section tests.
  // Since vi.mock is hoisted and cannot be conditionally toggled per describe,
  // we dynamically import the actual module in each test.
  async function getRealChip() {
    const mod = await vi.importActual<{ default: typeof RelatedCardChip }>(
      "./RelatedCardChip",
    );
    return mod.default;
  }

  it("renders card name", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(
      <RealChip card={makeChipCard({ name: "The Nurse" })} />,
    );
    const nameSpan = screen.getByText("The Nurse", { selector: "span" });
    expect(nameSpan).toBeInTheDocument();
  });

  it("renders rarity badge with label", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(<RealChip card={makeChipCard({ rarity: 2 })} />);
    expect(screen.getByText("Uncommon")).toBeInTheDocument();
  });

  it("renders Boss badge when card.fromBoss is true", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(<RealChip card={makeChipCard({ fromBoss: true })} />);
    expect(screen.getByText("Boss")).toBeInTheDocument();
  });

  it("does not render Boss badge when card.fromBoss is false", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(<RealChip card={makeChipCard({ fromBoss: false })} />);
    expect(screen.queryByText("Boss")).not.toBeInTheDocument();
  });

  it("renders thumbnail image when artSrc is present", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(
      <RealChip card={makeChipCard({ artSrc: "doctor.png" })} />,
    );
    const img = screen.getByRole("img", { name: "The Doctor" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "img-doctor.png");
  });

  it("does not render thumbnail when artSrc is null", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(<RealChip card={makeChipCard({ artSrc: null })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a Link pointing to the card slug URL", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(
      <RealChip card={makeChipCard({ name: "The Doctor" })} />,
    );
    const link = screen.getByTestId("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/cards/$cardSlug/the-doctor");
  });

  it("renders DivinationCard popover", async () => {
    const RealChip = await getRealChip();
    renderWithProviders(
      <RealChip card={makeChipCard({ name: "The Doctor", stackSize: 8 })} />,
    );
    const popoverCard = screen.getByTestId("divination-card");
    expect(popoverCard).toBeInTheDocument();
    expect(popoverCard).toHaveTextContent("The Doctor");
  });
});
