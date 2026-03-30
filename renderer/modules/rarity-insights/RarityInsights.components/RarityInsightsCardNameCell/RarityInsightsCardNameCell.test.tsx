import { render, screen } from "@testing-library/react";

import RarityInsightsCardNameCell from "./RarityInsightsCardNameCell";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName }: any) => (
    <span data-testid="card-name-link">{cardName}</span>
  ),
}));

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card" data-card={JSON.stringify(card)}>
      {card.name}
    </div>
  ),
}));

vi.mock("~/renderer/hooks/usePopover/usePopover", () => ({
  usePopover: () => ({
    triggerRef: { current: null },
    popoverRef: { current: null },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  createLink: () => (props: any) => <a {...props} />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeComparisonRow(overrides = {}): any {
  return {
    id: "the-doctor",
    name: "The Doctor",
    stackSize: 8,
    description: "A stack of 8",
    rewardHtml: "<p>Headhunter</p>",
    artSrc: "https://example.com/art.png",
    flavourHtml: "<p>Flavour</p>",
    rarity: 1,
    isDifferent: false,
    filterRarities: {},
    prohibitedLibraryRarity: null,
    fromBoss: false,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityInsightsCardNameCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders CardNameLink with the card name", () => {
    const card = makeComparisonRow();
    render(<RarityInsightsCardNameCell card={card} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("The Doctor");
  });

  it("renders DivinationCard inside popover", () => {
    const card = makeComparisonRow();
    render(<RarityInsightsCardNameCell card={card} />);

    const divCard = screen.getByTestId("divination-card");
    expect(divCard).toBeInTheDocument();
    expect(divCard).toHaveTextContent("The Doctor");
  });

  it("has cursor-help class on trigger span", () => {
    const card = makeComparisonRow();
    render(<RarityInsightsCardNameCell card={card} />);

    const link = screen.getByTestId("card-name-link");
    const triggerSpan = link.closest("span.cursor-help");
    expect(triggerSpan).toBeInTheDocument();
  });

  it("has font-fontin class on trigger span", () => {
    const card = makeComparisonRow();
    render(<RarityInsightsCardNameCell card={card} />);

    const link = screen.getByTestId("card-name-link");
    const triggerSpan = link.closest("span.font-fontin");
    expect(triggerSpan).toBeInTheDocument();
  });

  it('popover has popover="manual" attribute', () => {
    const card = makeComparisonRow();
    render(<RarityInsightsCardNameCell card={card} />);

    const divCard = screen.getByTestId("divination-card");
    const popoverDiv = divCard.closest("div[popover]");
    expect(popoverDiv).toBeInTheDocument();
    expect(popoverDiv).toHaveAttribute("popover", "manual");
  });

  it("DivinationCard receives correct cardEntry with divinationCard metadata", () => {
    const card = makeComparisonRow({
      id: "house-of-mirrors",
      name: "House of Mirrors",
      stackSize: 9,
      description: "Nine mirrors",
      rewardHtml: "<p>Mirror of Kalandra</p>",
      artSrc: "https://example.com/hom.png",
      flavourHtml: "<p>Reflections</p>",
      rarity: 2,
    });
    render(<RarityInsightsCardNameCell card={card} />);

    const divCard = screen.getByTestId("divination-card");
    const cardData = JSON.parse(divCard.getAttribute("data-card")!);

    expect(cardData.name).toBe("House of Mirrors");
    expect(cardData.count).toBe(0);
    expect(cardData.divinationCard).toEqual({
      id: "house-of-mirrors",
      stackSize: 9,
      description: "Nine mirrors",
      rewardHtml: "<p>Mirror of Kalandra</p>",
      artSrc: "https://example.com/hom.png",
      flavourHtml: "<p>Reflections</p>",
      rarity: 2,
      fromBoss: false,
    });
  });

  it("renders with different card names", () => {
    const card = makeComparisonRow({ name: "The Fiend" });
    render(<RarityInsightsCardNameCell card={card} />);

    expect(screen.getByTestId("card-name-link")).toHaveTextContent("The Fiend");
    expect(screen.getByTestId("divination-card")).toHaveTextContent(
      "The Fiend",
    );
  });

  it('has displayName "RarityInsightsCardNameCell"', () => {
    expect(RarityInsightsCardNameCell.displayName).toBe(
      "RarityInsightsCardNameCell",
    );
  });

  describe("memo comparator", () => {
    it("does NOT re-render when only non-tracked fields change (e.g. description)", () => {
      const card = makeComparisonRow();
      const { rerender } = render(<RarityInsightsCardNameCell card={card} />);

      rerender(
        <RarityInsightsCardNameCell
          card={makeComparisonRow({ description: "Changed!" })}
        />,
      );

      const divCard = screen.getByTestId("divination-card");
      const cardData = JSON.parse(divCard.getAttribute("data-card")!);
      expect(cardData.divinationCard.description).toBe("A stack of 8");
    });

    it("re-renders when name changes", () => {
      const card = makeComparisonRow({ name: "The Doctor" });
      const { rerender } = render(<RarityInsightsCardNameCell card={card} />);

      rerender(
        <RarityInsightsCardNameCell
          card={makeComparisonRow({ name: "The Nurse" })}
        />,
      );

      expect(screen.getByTestId("card-name-link")).toHaveTextContent(
        "The Nurse",
      );
    });

    it("re-renders when rarity changes", () => {
      const card = makeComparisonRow({ rarity: 1 });
      const { rerender } = render(<RarityInsightsCardNameCell card={card} />);

      rerender(
        <RarityInsightsCardNameCell card={makeComparisonRow({ rarity: 5 })} />,
      );

      const divCard = screen.getByTestId("divination-card");
      const cardData = JSON.parse(divCard.getAttribute("data-card")!);
      expect(cardData.divinationCard.rarity).toBe(5);
    });

    it("re-renders when artSrc changes", () => {
      const card = makeComparisonRow({ artSrc: "old.png" });
      const { rerender } = render(<RarityInsightsCardNameCell card={card} />);

      rerender(
        <RarityInsightsCardNameCell
          card={makeComparisonRow({ artSrc: "new.png" })}
        />,
      );

      const divCard = screen.getByTestId("divination-card");
      const cardData = JSON.parse(divCard.getAttribute("data-card")!);
      expect(cardData.divinationCard.artSrc).toBe("new.png");
    });
  });
});
