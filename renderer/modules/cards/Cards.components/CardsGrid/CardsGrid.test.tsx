import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { DivinationCardRow } from "../../Cards.types";
import { CardsGrid } from "./CardsGrid";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

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

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCard(
  overrides: Partial<DivinationCardRow> = {},
): DivinationCardRow {
  return {
    id: "card-1",
    name: "The Doctor",
    stackSize: 8,
    description: "A test card",
    rewardHtml: "<span>Reward</span>",
    artSrc: "https://example.com/art.png",
    flavourHtml: "<em>Flavour</em>",
    rarity: 1,
    filterRarity: null,
    prohibitedLibraryRarity: null,
    fromBoss: false,
    ...overrides,
  };
}

function setupStore(
  overrides: {
    currentPage?: number;
    searchQuery?: string;
    rarityFilter?: string | number;
    includeBossCards?: boolean;
    sortField?: string;
    sortDirection?: string;
    raritySource?: string;
  } = {},
) {
  mockUseBoundStore.mockReturnValue({
    cards: {
      currentPage: overrides.currentPage ?? 1,
      searchQuery: overrides.searchQuery ?? "",
      rarityFilter: overrides.rarityFilter ?? "all",
      includeBossCards: overrides.includeBossCards ?? false,
      sortField: overrides.sortField ?? "name",
      sortDirection: overrides.sortDirection ?? "asc",
    },
    settings: {
      raritySource: overrides.raritySource ?? "poe.ninja",
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardsGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
  });

  describe("empty state", () => {
    it('shows "No Cards Found" when cards array is empty', () => {
      setupStore();
      renderWithProviders(<CardsGrid cards={[]} />);

      expect(screen.getByText("No Cards Found")).toBeInTheDocument();
    });

    it('shows "Try adjusting your filters" hint when cards array is empty', () => {
      setupStore();
      renderWithProviders(<CardsGrid cards={[]} />);

      expect(
        screen.getByText("Try adjusting your filters"),
      ).toBeInTheDocument();
    });

    it("does not render any card components when empty", () => {
      setupStore();
      renderWithProviders(<CardsGrid cards={[]} />);

      expect(screen.queryByTestId(/^card-/)).not.toBeInTheDocument();
    });
  });

  describe("rendering cards", () => {
    it("renders a DivinationCard for each item in the cards array", () => {
      setupStore();
      const cards = [
        makeCard({ id: "1", name: "The Doctor" }),
        makeCard({ id: "2", name: "House of Mirrors" }),
        makeCard({ id: "3", name: "The Fiend" }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-The Doctor")).toBeInTheDocument();
      expect(screen.getByTestId("card-House of Mirrors")).toBeInTheDocument();
      expect(screen.getByTestId("card-The Fiend")).toBeInTheDocument();
    });

    it("renders exactly the number of cards provided", () => {
      setupStore();
      const cards = [
        makeCard({ id: "1", name: "Card A" }),
        makeCard({ id: "2", name: "Card B" }),
        makeCard({ id: "3", name: "Card C" }),
        makeCard({ id: "4", name: "Card D" }),
        makeCard({ id: "5", name: "Card E" }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      const renderedCards = screen.getAllByTestId(/^card-/);
      expect(renderedCards).toHaveLength(5);
    });

    it("renders a single card correctly", () => {
      setupStore();
      const cards = [makeCard({ id: "1", name: "The Patient" })];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-The Patient")).toBeInTheDocument();
    });
  });

  describe("grid layout", () => {
    it("creates a grid container (ul element) when cards are present", () => {
      setupStore();
      const cards = [
        makeCard({ id: "1", name: "The Doctor" }),
        makeCard({ id: "2", name: "The Nurse" }),
      ];

      const { container } = renderWithProviders(<CardsGrid cards={cards} />);

      const grid = container.querySelector("ul");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass("grid");
    });

    it("renders each card in a list item", () => {
      setupStore();
      const cards = [
        makeCard({ id: "1", name: "The Doctor" }),
        makeCard({ id: "2", name: "The Nurse" }),
      ];

      const { container } = renderWithProviders(<CardsGrid cards={cards} />);

      const listItems = container.querySelectorAll("li");
      expect(listItems).toHaveLength(2);
    });
  });

  describe("navigation", () => {
    it("calls navigate when clicking a card", async () => {
      setupStore();
      const cards = [makeCard({ id: "1", name: "The Doctor" })];

      const { user } = renderWithProviders(<CardsGrid cards={cards} />);

      // Click the wrapper div containing the card
      await user.click(screen.getByTestId("card-The Doctor"));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/cards/$cardSlug",
          params: expect.objectContaining({ cardSlug: expect.any(String) }),
        }),
      );
    });
  });

  describe("getEffectiveRarity / raritySource", () => {
    it("uses filterRarity when raritySource is filter", () => {
      setupStore({ raritySource: "filter" });
      const cards = [
        makeCard({ id: "1", name: "Test", rarity: 1, filterRarity: 5 }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-Test")).toHaveAttribute(
        "data-rarity",
        "5",
      );
    });

    it("falls back to rarity when filterRarity is null and raritySource is filter", () => {
      setupStore({ raritySource: "filter" });
      const cards = [
        makeCard({ id: "1", name: "Test", rarity: 1, filterRarity: null }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-Test")).toHaveAttribute(
        "data-rarity",
        "1",
      );
    });

    it("uses prohibitedLibraryRarity when raritySource is prohibited-library", () => {
      setupStore({ raritySource: "prohibited-library" });
      const cards = [
        makeCard({
          id: "1",
          name: "Test",
          rarity: 1,
          prohibitedLibraryRarity: 7,
        }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-Test")).toHaveAttribute(
        "data-rarity",
        "7",
      );
    });

    it("falls back to rarity when prohibitedLibraryRarity is null", () => {
      setupStore({ raritySource: "prohibited-library" });
      const cards = [
        makeCard({
          id: "1",
          name: "Test",
          rarity: 1,
          prohibitedLibraryRarity: null,
        }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-Test")).toHaveAttribute(
        "data-rarity",
        "1",
      );
    });
  });

  describe("does not show empty state when cards exist", () => {
    it('does not show "No Cards Found" when cards are provided', () => {
      setupStore();
      const cards = [makeCard({ id: "1", name: "The Doctor" })];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.queryByText("No Cards Found")).not.toBeInTheDocument();
    });
  });
});
