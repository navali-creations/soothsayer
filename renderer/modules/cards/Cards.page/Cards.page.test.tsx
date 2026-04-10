import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCards } from "~/renderer/store";

import type { DivinationCardRow } from "../Cards.types";
import CardsPage from "./Cards.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCards: vi.fn(),
}));

const mockUseCards = vi.mocked(useCards);

vi.mock("../Cards.components", () => ({
  CardsActions: ({ onFilterChange }: any) => (
    <div data-testid="cards-actions" onClick={onFilterChange} />
  ),
  CardsGrid: ({ cards }: any) => (
    <div data-testid="cards-grid" data-count={cards.length} />
  ),
  CardsPagination: ({ totalPages, onPageChange }: any) => (
    <div
      data-testid="cards-pagination"
      data-total-pages={totalPages}
      onClick={onPageChange}
    />
  ),
}));

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle, actions }: any) => (
        <div data-testid="page-header">
          <span data-testid="page-title">{title}</span>
          <span data-testid="page-subtitle">{subtitle}</span>
          <div data-testid="page-actions">{actions}</div>
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
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

const mockAllCards: DivinationCardRow[] = [
  makeCard({ id: "1", name: "The Doctor" }),
  makeCard({ id: "2", name: "House of Mirrors" }),
  makeCard({ id: "3", name: "The Fiend" }),
  makeCard({ id: "4", name: "The Nurse" }),
  makeCard({ id: "5", name: "The Patient" }),
];

const mockFilteredCards: DivinationCardRow[] = [
  makeCard({ id: "1", name: "The Doctor" }),
  makeCard({ id: "2", name: "House of Mirrors" }),
  makeCard({ id: "3", name: "The Fiend" }),
];

const mockLoadCards = vi.fn();

function setupStore(
  overrides: {
    allCards?: DivinationCardRow[];
    filteredCards?: DivinationCardRow[];
    currentPage?: number;
    pageSize?: number;
  } = {},
) {
  mockUseCards.mockReturnValue({
    allCards: overrides.allCards ?? mockAllCards,
    loadCards: mockLoadCards,
    getFilteredAndSortedCards: () =>
      overrides.filteredCards ?? mockFilteredCards,
    currentPage: overrides.currentPage ?? 1,
    pageSize: overrides.pageSize ?? 20,
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls loadCards on mount", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(mockLoadCards).toHaveBeenCalledTimes(1);
  });

  it('renders page title "Divination Cards"', () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent(
      "Divination Cards",
    );
  });

  it("shows filtered/total count in subtitle", () => {
    setupStore({
      allCards: mockAllCards,
      filteredCards: mockFilteredCards,
    });
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "3 of 5 cards",
    );
  });

  it("shows correct counts when all cards match filter", () => {
    setupStore({
      allCards: mockAllCards,
      filteredCards: mockAllCards,
    });
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "5 of 5 cards",
    );
  });

  it("renders CardsActions component", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("cards-actions")).toBeInTheDocument();
  });

  it("renders CardsActions inside the page header actions slot", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    const actionsSlot = screen.getByTestId("page-actions");
    expect(actionsSlot).toContainElement(screen.getByTestId("cards-actions"));
  });

  it("renders CardsGrid component", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("cards-grid")).toBeInTheDocument();
  });

  it("renders CardsPagination component", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("cards-pagination")).toBeInTheDocument();
  });

  it("passes paginatedCards to CardsGrid", () => {
    // filteredCards has 3 items, pageSize=20, currentPage=1 → all 3 shown
    setupStore({ filteredCards: mockFilteredCards, pageSize: 20 });
    renderWithProviders(<CardsPage />);

    const grid = screen.getByTestId("cards-grid");
    expect(grid).toHaveAttribute(
      "data-count",
      String(mockFilteredCards.length),
    );
  });

  it("paginates cards based on currentPage and pageSize", () => {
    // 3 filtered cards, pageSize=2, page 1 → first 2 shown
    setupStore({
      filteredCards: mockFilteredCards,
      pageSize: 2,
      currentPage: 1,
    });
    renderWithProviders(<CardsPage />);

    const grid = screen.getByTestId("cards-grid");
    expect(grid).toHaveAttribute("data-count", "2");
  });

  it("passes totalPages to CardsPagination", () => {
    // 3 filtered cards / pageSize 1 = 3 pages
    setupStore({ filteredCards: mockFilteredCards, pageSize: 1 });
    renderWithProviders(<CardsPage />);

    const pagination = screen.getByTestId("cards-pagination");
    expect(pagination).toHaveAttribute("data-total-pages", "3");
  });

  it("renders the page container", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("page-container")).toBeInTheDocument();
  });

  it("renders page content area", () => {
    setupStore();
    renderWithProviders(<CardsPage />);

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("calls scrollTo when scrollToTop is triggered via onFilterChange", () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    setupStore();
    renderWithProviders(<CardsPage />);

    screen.getByTestId("cards-actions").click();

    expect(scrollToSpy).toHaveBeenCalled();
  });
});
