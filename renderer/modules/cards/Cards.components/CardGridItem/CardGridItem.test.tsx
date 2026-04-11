import { makeDivinationCardRow } from "~/renderer/__test-setup__/fixtures";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { DivinationCardRow } from "../../Cards.types";
import CardGridItem, { getEffectiveRarity } from "./CardGridItem";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div
      data-testid={`card-${card.name}`}
      data-rarity={card.divinationCard.rarity}
    >
      {card.name}
    </div>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderCardGridItem(
  overrides: {
    card?: DivinationCardRow;
    raritySource?: string;
    showAllCards?: boolean;
    gridKey?: string;
    onNavigate?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const props = {
    card: overrides.card ?? makeDivinationCardRow(),
    raritySource: (overrides.raritySource ?? "poe.ninja") as any,
    showAllCards: overrides.showAllCards ?? false,
    gridKey: overrides.gridKey ?? "test-grid",
    onNavigate: overrides.onNavigate ?? vi.fn(),
  };

  return { ...renderWithProviders(<CardGridItem {...props} />), props };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("getEffectiveRarity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns filterRarity when raritySource is 'filter' and filterRarity is set", () => {
    const card = makeDivinationCardRow({ rarity: 1, filterRarity: 5 });
    expect(getEffectiveRarity(card, "filter")).toBe(5);
  });

  it("falls back to rarity when raritySource is 'filter' and filterRarity is null", () => {
    const card = makeDivinationCardRow({ rarity: 1, filterRarity: null });
    expect(getEffectiveRarity(card, "filter")).toBe(1);
  });

  it("returns prohibitedLibraryRarity when raritySource is 'prohibited-library' and it is set", () => {
    const card = makeDivinationCardRow({
      rarity: 1,
      prohibitedLibraryRarity: 7,
    });
    expect(getEffectiveRarity(card, "prohibited-library")).toBe(7);
  });

  it("falls back to rarity when raritySource is 'prohibited-library' and prohibitedLibraryRarity is null", () => {
    const card = makeDivinationCardRow({
      rarity: 1,
      prohibitedLibraryRarity: null,
    });
    expect(getEffectiveRarity(card, "prohibited-library")).toBe(1);
  });

  it("returns rarity for default/unknown raritySource", () => {
    const card = makeDivinationCardRow({ rarity: 3 });
    expect(getEffectiveRarity(card, "poe.ninja")).toBe(3);
  });
});

describe("CardGridItem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders the DivinationCard component", () => {
      const card = makeDivinationCardRow({ name: "The Doctor" });
      renderCardGridItem({ card });

      expect(screen.getByTestId("card-The Doctor")).toBeInTheDocument();
    });

    it("passes the correct rarity from getEffectiveRarity to DivinationCard", () => {
      const card = makeDivinationCardRow({ rarity: 1, filterRarity: 5 });
      renderCardGridItem({ card, raritySource: "filter" });

      expect(screen.getByTestId("card-The Doctor")).toHaveAttribute(
        "data-rarity",
        "5",
      );
    });

    it("renders within a list item", () => {
      const { container } = renderCardGridItem();

      const li = container.querySelector("li");
      expect(li).toBeInTheDocument();
      // The outermost rendered element should be the <li>
      expect(container.firstElementChild).toBe(li);
    });
  });

  describe("out-of-pool badge", () => {
    it("shows 'Not in league pool' badge when showAllCards is true and card is not in pool", () => {
      const card = makeDivinationCardRow({ inPool: false });
      renderCardGridItem({ card, showAllCards: true });

      expect(screen.getByText("Not in league pool")).toBeInTheDocument();
    });

    it("does not show badge when showAllCards is false", () => {
      const card = makeDivinationCardRow({ inPool: false });
      renderCardGridItem({ card, showAllCards: false });

      expect(screen.queryByText("Not in league pool")).not.toBeInTheDocument();
    });

    it("does not show badge when card is in pool", () => {
      const card = makeDivinationCardRow({ inPool: true });
      renderCardGridItem({ card, showAllCards: true });

      expect(screen.queryByText("Not in league pool")).not.toBeInTheDocument();
    });

    it("applies opacity-40 class when card is out of pool", () => {
      const card = makeDivinationCardRow({ inPool: false });
      const { container } = renderCardGridItem({ card, showAllCards: true });

      const li = container.querySelector("li");
      expect(li).toHaveClass("opacity-40");
    });

    it("does not apply opacity-40 class when card is in pool", () => {
      const card = makeDivinationCardRow({ inPool: true });
      const { container } = renderCardGridItem({ card, showAllCards: true });

      const li = container.querySelector("li");
      expect(li).not.toHaveClass("opacity-40");
    });
  });

  describe("navigation", () => {
    it("calls onNavigate with card name when clicked", async () => {
      const onNavigate = vi.fn();
      const card = makeDivinationCardRow({ name: "The Doctor" });
      const { user } = renderCardGridItem({ card, onNavigate });

      await user.click(screen.getByTestId("card-The Doctor"));

      expect(onNavigate).toHaveBeenCalledWith("The Doctor");
    });

    it("does not call onNavigate before clicking", () => {
      const onNavigate = vi.fn();
      renderCardGridItem({ onNavigate });

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
