import { makeDivinationCardRow } from "~/renderer/__test-setup__/fixtures";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { CardsGrid } from "./CardsGrid";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("@tanstack/react-router", async () => {
  const { createNavigateOnlyMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createNavigateOnlyMock(mockNavigate);
});

vi.mock("../CardGridItem/CardGridItem", () => ({
  default: ({ card, onNavigate, showAllCards }: any) => (
    <li
      data-testid={`card-item-${card.name}`}
      onClick={() => onNavigate(card.name)}
    >
      {card.name}
      {showAllCards && !card.inPool && <span>Not in league pool</span>}
    </li>
  ),
}));

vi.mock("motion/react", async () => {
  const { createMotionMock } = await import(
    "~/renderer/__test-setup__/motion-mock"
  );
  return createMotionMock();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

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

      expect(screen.queryByTestId(/^card-item-/)).not.toBeInTheDocument();
    });
  });

  describe("rendering cards", () => {
    it("renders a DivinationCard for each item in the cards array", () => {
      setupStore();
      const cards = [
        makeDivinationCardRow({ id: "1", name: "The Doctor" }),
        makeDivinationCardRow({ id: "2", name: "House of Mirrors" }),
        makeDivinationCardRow({ id: "3", name: "The Fiend" }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-item-The Doctor")).toBeInTheDocument();
      expect(
        screen.getByTestId("card-item-House of Mirrors"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("card-item-The Fiend")).toBeInTheDocument();
    });

    it("renders exactly the number of cards provided", () => {
      setupStore();
      const cards = [
        makeDivinationCardRow({ id: "1", name: "Card A" }),
        makeDivinationCardRow({ id: "2", name: "Card B" }),
        makeDivinationCardRow({ id: "3", name: "Card C" }),
        makeDivinationCardRow({ id: "4", name: "Card D" }),
        makeDivinationCardRow({ id: "5", name: "Card E" }),
      ];

      renderWithProviders(<CardsGrid cards={cards} />);

      const renderedCards = screen.getAllByTestId(/^card-item-/);
      expect(renderedCards).toHaveLength(5);
    });

    it("renders a single card correctly", () => {
      setupStore();
      const cards = [makeDivinationCardRow({ id: "1", name: "The Patient" })];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.getByTestId("card-item-The Patient")).toBeInTheDocument();
    });
  });

  describe("grid layout", () => {
    it("creates a grid container (ul element) when cards are present", () => {
      setupStore();
      const cards = [
        makeDivinationCardRow({ id: "1", name: "The Doctor" }),
        makeDivinationCardRow({ id: "2", name: "The Nurse" }),
      ];

      const { container } = renderWithProviders(<CardsGrid cards={cards} />);

      const grid = container.querySelector("ul");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass("grid");
    });

    it("renders each card in a list item", () => {
      setupStore();
      const cards = [
        makeDivinationCardRow({ id: "1", name: "The Doctor" }),
        makeDivinationCardRow({ id: "2", name: "The Nurse" }),
      ];

      const { container } = renderWithProviders(<CardsGrid cards={cards} />);

      const listItems = container.querySelectorAll("li");
      expect(listItems).toHaveLength(2);
    });
  });

  describe("navigation", () => {
    it("calls navigate when clicking a card", async () => {
      setupStore();
      const cards = [makeDivinationCardRow({ id: "1", name: "The Doctor" })];

      const { user } = renderWithProviders(<CardsGrid cards={cards} />);

      // Click the wrapper div containing the card
      await user.click(screen.getByTestId("card-item-The Doctor"));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/cards/$cardSlug",
          params: expect.objectContaining({ cardSlug: expect.any(String) }),
        }),
      );
    });
  });

  describe("does not show empty state when cards exist", () => {
    it('does not show "No Cards Found" when cards are provided', () => {
      setupStore();
      const cards = [makeDivinationCardRow({ id: "1", name: "The Doctor" })];

      renderWithProviders(<CardsGrid cards={cards} />);

      expect(screen.queryByText("No Cards Found")).not.toBeInTheDocument();
    });
  });
});
