import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ═══════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card">{card.name}</div>
  ),
}));

vi.mock("~/renderer/components/Link/Link", () => ({
  default: ({
    children,
    to,
    params,
    onMouseEnter,
    onMouseLeave,
    ...props
  }: any) => (
    <a
      href={`${to}/${params?.cardSlug}`}
      data-testid="link"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/hooks/usePopover/usePopover", async () => {
  const { createPopoverMock } = await import(
    "~/renderer/__test-setup__/popover-mock"
  );
  return createPopoverMock();
});

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
  getDisplayRarity: (card: any) => card.rarity ?? 2,
  toCardEntry: (card: any) => ({
    name: card.name,
    stackSize: card.stackSize,
  }),
}));

vi.mock("~/renderer/hooks/useCardImage", () => ({
  useCardImage: (artSrc: string) => (artSrc ? `img-${artSrc}` : ""),
}));

// ─── Component import (after all mocks) ──────────────────────────────────

import RelatedCardChip from "./RelatedCardChip";

// ─── Helpers ─────────────────────────────────────────────────────────────

const makeCard = (overrides: Record<string, any> = {}) => ({
  name: "The Doctor",
  stackSize: 8,
  rarity: 2,
  rewardHtml: "<p>Headhunter</p>",
  artSrc: "doctor.png",
  fromBoss: false,
  poeNinjaRarity: 2,
  plRarity: 2,
  description: "A card",
  flavourHtml: "",
  filterRarity: 2,
  ...overrides,
});

// ─── Cleanup ─────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("RelatedCardChip", () => {
  it("renders card name", () => {
    renderWithProviders(
      <RelatedCardChip card={makeCard({ name: "The Nurse" })} />,
    );
    expect(
      screen.getByText("The Nurse", { selector: "span" }),
    ).toBeInTheDocument();
  });

  it("renders rarity badge with label", () => {
    renderWithProviders(<RelatedCardChip card={makeCard({ rarity: 2 })} />);
    expect(screen.getByText("Uncommon")).toBeInTheDocument();
  });

  it("renders Boss badge when card.fromBoss is true", () => {
    renderWithProviders(
      <RelatedCardChip card={makeCard({ fromBoss: true })} />,
    );
    expect(screen.getByText("Boss")).toBeInTheDocument();
  });

  it("does not render Boss badge when card.fromBoss is false", () => {
    renderWithProviders(
      <RelatedCardChip card={makeCard({ fromBoss: false })} />,
    );
    expect(screen.queryByText("Boss")).not.toBeInTheDocument();
  });

  it("renders thumbnail image when artSrc is present", () => {
    renderWithProviders(
      <RelatedCardChip card={makeCard({ artSrc: "doctor.png" })} />,
    );
    const img = screen.getByRole("img", { name: "The Doctor" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "img-doctor.png");
  });

  it("does not render thumbnail when useCardImage returns empty string", () => {
    renderWithProviders(<RelatedCardChip card={makeCard({ artSrc: null })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a Link pointing to the card slug URL", () => {
    renderWithProviders(
      <RelatedCardChip card={makeCard({ name: "The Doctor" })} />,
    );
    const link = screen.getByTestId("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/cards/$cardSlug/the-doctor");
  });

  it("renders DivinationCard popover", () => {
    renderWithProviders(
      <RelatedCardChip card={makeCard({ name: "The Doctor" })} />,
    );
    const popoverCard = screen.getByTestId("divination-card");
    expect(popoverCard).toBeInTheDocument();
    expect(popoverCard).toHaveTextContent("The Doctor");
  });

  it('renders "Unknown" rarity label when rarity is not in RARITY_LABELS', () => {
    renderWithProviders(<RelatedCardChip card={makeCard({ rarity: 99 })} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("sets inline hover styles on mouseEnter and clears them on mouseLeave", async () => {
    const { user } = renderWithProviders(<RelatedCardChip card={makeCard()} />);
    const link = screen.getByTestId("link");

    // Before hover — no inline styles
    expect(link.style.backgroundColor).toBe("");
    expect(link.style.borderColor).toBe("");

    // Hover over the link
    await user.hover(link);

    // After mouseEnter — inline styles should be set
    expect(link.style.backgroundColor).toBe("rgba(255, 215, 0, 0.1)");
    expect(link.style.borderColor).toBe("rgb(204, 166, 0)");

    // Move away
    await user.unhover(link);

    // After mouseLeave — inline styles should be cleared
    expect(link.style.backgroundColor).toBe("");
    expect(link.style.borderColor).toBe("transparent");
  });
});
