import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import type { CardEntry } from "~/types/data-stores";

import DivinationCard from "./DivinationCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("./hooks/useCardMouseEffects/useCardMouseEffects", () => ({
  useCardMouseEffects: () => ({
    mousePos: { x: 0, y: 0 },
    isHovered: false,
    rotateX: 0,
    rotateY: 0,
  }),
}));

vi.mock("./components/card-content/CardArt", () => ({
  CardArt: ({ artSrc, cardName }: { artSrc: string; cardName: string }) => (
    <div
      data-testid="card-art"
      data-art-src={artSrc}
      data-card-name={cardName}
    />
  ),
}));

vi.mock("./components/CardFrame", () => ({
  CardFrame: () => <div data-testid="card-frame" />,
}));

vi.mock("./effects/RarityEffects", () => ({
  RarityEffects: ({ rarity }: { rarity: number }) => (
    <div data-testid="rarity-effects" data-rarity={rarity} />
  ),
}));

vi.mock("./components/card-content/CardPlaceholder", () => ({
  CardPlaceholder: ({ cardName }: { cardName: string }) => (
    <div data-testid="card-placeholder" data-card-name={cardName}>
      Card data not available yet
    </div>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CardEntry> = {}): CardEntry {
  return {
    name: "The Doctor",
    count: 3,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("DivinationCard", () => {
  describe("placeholder fallback when divinationCard is missing", () => {
    it("renders placeholder card frame when divinationCard is undefined", () => {
      const card = makeCard({ divinationCard: undefined });
      const { container } = renderWithProviders(<DivinationCard card={card} />);
      expect(container.innerHTML).not.toBe("");
      expect(screen.getByTestId("card-frame")).toBeInTheDocument();
      expect(screen.getByTestId("card-placeholder")).toBeInTheDocument();
    });

    it("shows card name in the placeholder", () => {
      const card = makeCard({
        name: "House of Mirrors",
        divinationCard: undefined,
      });
      renderWithProviders(<DivinationCard card={card} />);

      const placeholder = screen.getByTestId("card-placeholder");
      expect(placeholder).toHaveAttribute("data-card-name", "House of Mirrors");
    });

    it("shows placeholder message text", () => {
      const card = makeCard({ divinationCard: undefined });
      renderWithProviders(<DivinationCard card={card} />);

      expect(
        screen.getByText("Card data not available yet"),
      ).toBeInTheDocument();
    });

    it("does not render CardArt in placeholder mode", () => {
      const card = makeCard({ divinationCard: undefined });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.queryByTestId("card-art")).not.toBeInTheDocument();
    });

    it("does not render RarityEffects in placeholder mode", () => {
      const card = makeCard({ divinationCard: undefined });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.queryByTestId("rarity-effects")).not.toBeInTheDocument();
    });

    it("does not render BossIndicator in placeholder mode", () => {
      const card = makeCard({ divinationCard: undefined });
      renderWithProviders(<DivinationCard card={card} />);

      expect(
        screen.queryByTitle("Boss-exclusive card"),
      ).not.toBeInTheDocument();
    });

    it("renders with data-mode='placeholder'", () => {
      const card = makeCard({ divinationCard: undefined });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("divination-card")).toHaveAttribute(
        "data-mode",
        "placeholder",
      );
    });
  });

  describe("full card rendering with divinationCard metadata", () => {
    it("renders with data-mode='full' when divinationCard is present", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("divination-card")).toHaveAttribute(
        "data-mode",
        "full",
      );
    });

    it("renders frame, art, and rarity effects", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("card-frame")).toBeInTheDocument();
      expect(screen.getByTestId("card-art")).toBeInTheDocument();
      expect(screen.getByTestId("rarity-effects")).toBeInTheDocument();
    });

    it("does not render placeholder when divinationCard is present", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.queryByTestId("card-placeholder")).not.toBeInTheDocument();
    });

    it("renders card name", () => {
      const card = makeCard({
        name: "House of Mirrors",
        divinationCard: {},
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByText("House of Mirrors")).toBeInTheDocument();
    });

    it("renders stack size in count/stackSize format", () => {
      const card = makeCard({
        count: 2,
        divinationCard: { stackSize: 8 },
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByText("2/8")).toBeInTheDocument();
    });

    it("shows BossIndicator when fromBoss is true", () => {
      const card = makeCard({
        divinationCard: { fromBoss: true },
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTitle("Boss-exclusive card")).toBeInTheDocument();
    });

    it("hides BossIndicator when fromBoss is false", () => {
      const card = makeCard({
        divinationCard: { fromBoss: false },
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(
        screen.queryByTitle("Boss-exclusive card"),
      ).not.toBeInTheDocument();
    });

    it("hides BossIndicator when fromBoss is not provided (defaults to false)", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      expect(
        screen.queryByTitle("Boss-exclusive card"),
      ).not.toBeInTheDocument();
    });
  });

  describe("rarity forwarding to RarityEffects", () => {
    it.each([
      0, 1, 2, 3, 4,
    ] as const)("passes rarity %i to RarityEffects", (rarity) => {
      const card = makeCard({ divinationCard: { rarity } });
      renderWithProviders(<DivinationCard card={card} />);

      const effects = screen.getByTestId("rarity-effects");
      expect(effects).toHaveAttribute("data-rarity", String(rarity));
    });

    it("defaults rarity to 4 when not provided", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      const effects = screen.getByTestId("rarity-effects");
      expect(effects).toHaveAttribute("data-rarity", "4");
    });
  });

  describe("CardArt props", () => {
    it("passes correct artSrc to CardArt", () => {
      const card = makeCard({
        name: "The Fiend",
        divinationCard: { artSrc: "https://example.com/fiend.png" },
      });
      renderWithProviders(<DivinationCard card={card} />);

      const art = screen.getByTestId("card-art");
      expect(art).toHaveAttribute(
        "data-art-src",
        "https://example.com/fiend.png",
      );
      expect(art).toHaveAttribute("data-card-name", "The Fiend");
    });
  });

  describe("default values when metadata fields are null or missing", () => {
    it("defaults artSrc to empty string when null", () => {
      const card = makeCard({
        divinationCard: { artSrc: null },
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("card-art")).toHaveAttribute(
        "data-art-src",
        "",
      );
    });

    it("defaults stackSize to 1 when null", () => {
      const card = makeCard({
        count: 5,
        divinationCard: { stackSize: null },
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByText("5/1")).toBeInTheDocument();
    });

    it("defaults rarity to 4 when not provided", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("rarity-effects")).toHaveAttribute(
        "data-rarity",
        "4",
      );
    });

    it("defaults artSrc to empty string when not provided", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("card-art")).toHaveAttribute(
        "data-art-src",
        "",
      );
    });
  });

  describe("rewardHtml processing", () => {
    it("processes rewardHtml and passes it to CardRewardFlavour", () => {
      const card = makeCard({
        divinationCard: {
          rewardHtml: '<span class="-mod">some reward</span>',
        },
      });
      const { container } = renderWithProviders(<DivinationCard card={card} />);

      // processRewardHtml converts class attributes to inline styles.
      // The processed output should contain a style attribute instead of class.
      const rewardSpan = container.querySelector("span[style]");
      expect(rewardSpan).toBeInTheDocument();
      expect(rewardSpan?.textContent).toBe("some reward");
    });

    it("renders empty reward when rewardHtml is not provided", () => {
      const card = makeCard({ divinationCard: {} });
      renderWithProviders(<DivinationCard card={card} />);

      // Component should still render without errors
      expect(screen.getByTestId("card-frame")).toBeInTheDocument();
    });

    it("renders empty reward when rewardHtml is null", () => {
      const card = makeCard({
        divinationCard: { rewardHtml: null },
      });
      renderWithProviders(<DivinationCard card={card} />);

      expect(screen.getByTestId("card-frame")).toBeInTheDocument();
    });
  });

  describe("flavour text", () => {
    it("renders flavour text when flavourHtml is provided", () => {
      const card = makeCard({
        divinationCard: {
          flavourHtml: "<em>A taste of power.</em>",
        },
      });
      const { container } = renderWithProviders(<DivinationCard card={card} />);

      expect(container.querySelector("em")?.textContent).toBe(
        "A taste of power.",
      );
    });

    it("does not render flavour separator when flavourHtml is empty", () => {
      const card = makeCard({
        divinationCard: { flavourHtml: "" },
      });
      const { container } = renderWithProviders(<DivinationCard card={card} />);

      // The separator image is only rendered when flavourHtml is truthy
      const separatorImg = container.querySelector("img");
      expect(separatorImg).not.toBeInTheDocument();
    });
  });
});
