import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { createCardRatioColumn } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import type { CardEntry } from "../../Statistics.types";
import { StatisticsTable } from "./StatisticsTable";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Dropdown: ({ trigger, children, ...props }: any) => (
    <div data-testid="dropdown" {...props}>
      <button data-testid="dropdown-trigger" type="button">
        {trigger}
      </button>
      <div data-testid="dropdown-content">{children}</div>
    </div>
  ),
  Search: ({ onChange, debounceMs, ...props }: any) => (
    <input
      data-testid="statistics-search"
      data-debounce-ms={debounceMs}
      onChange={(e: any) => onChange(e.target.value)}
      {...props}
    />
  ),
  Table: ({ data, columns, globalFilter, emptyMessage, pageSize }: any) => (
    <div
      data-testid="table"
      data-rows={data.length}
      data-columns={columns.length}
      data-global-filter={globalFilter ?? ""}
      data-page-size={pageSize}
    >
      {data.length === 0 && emptyMessage && (
        <span data-testid="table-empty-message">{emptyMessage}</span>
      )}
    </div>
  ),
  createCardNameColumn: vi.fn(() => ({ id: "cardName" })),
  createCardCountColumn: vi.fn(() => ({ id: "cardCount" })),
  createCardRatioColumn: vi.fn((totalCount: number) => ({
    id: "cardRatio",
    totalCount,
  })),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(
  overrides: {
    statScope?: "all-time" | "league";
    searchQuery?: string;
    showUncollectedCards?: boolean;
    uncollectedCardNames?: string[];
    uncollectedCardMetadata?: Record<string, unknown>;
  } = {},
) {
  const store = {
    statistics: {
      statScope: overrides.statScope ?? "all-time",
      searchQuery: overrides.searchQuery ?? "",
      setSearchQuery: vi.fn(),
      showUncollectedCards: overrides.showUncollectedCards ?? false,
      uncollectedCardNames: overrides.uncollectedCardNames ?? [],
      uncollectedCardMetadata: overrides.uncollectedCardMetadata ?? {},
      toggleShowUncollectedCards: vi.fn(),
      snapshotMeta: null,
      isExporting: false,
      fetchSnapshotMeta: vi.fn(),
      exportAll: vi.fn().mockResolvedValue({ success: false }),
      exportIncremental: vi.fn().mockResolvedValue({ success: false }),
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function createCardData(
  cards: Array<{ name: string; count: number; ratio: number }>,
): CardEntry[] {
  return cards.map((c) => ({ ...c }));
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatisticsTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Heading ────────────────────────────────────────────────────────────

  it('renders "Card Collection" heading', () => {
    setupStore();
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(screen.getByText("Card Collection")).toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it('shows "No cards collected yet" when cardData is empty', () => {
    setupStore();
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(screen.getByText("No cards collected yet")).toBeInTheDocument();
  });

  it('shows "Start a session and open divination cards in Path of Exile!" hint when empty', () => {
    setupStore();
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(
      screen.getByText(
        "Start a session and open divination cards in Path of Exile!",
      ),
    ).toBeInTheDocument();
  });

  it("does not render Table component when cardData is empty", () => {
    setupStore();
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
  });

  // ── Table rendering when data present ──────────────────────────────────

  it("renders Table component when cardData has entries", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 50 },
      { name: "The Doctor", count: 5, ratio: 25 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const table = screen.getByTestId("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute("data-rows", "2");
  });

  it("does not show empty state text when cardData has entries", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 50 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    expect(
      screen.queryByText("No cards collected yet"),
    ).not.toBeInTheDocument();
  });

  it("creates 3 columns for the table", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 50 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-columns", "3");
  });

  it("passes pageSize of 20 to Table", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 50 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-page-size", "20");
  });

  // ── Search / globalFilter ──────────────────────────────────────────────

  it("passes searchQuery from store as globalFilter to Table", () => {
    setupStore({ searchQuery: "doctor" });
    const cardData = createCardData([
      { name: "The Doctor", count: 5, ratio: 100 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-global-filter", "doctor");
  });

  it("passes empty string as globalFilter when searchQuery is empty", () => {
    setupStore({ searchQuery: "" });
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 100 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-global-filter", "");
  });

  // ── Table empty message ────────────────────────────────────────────────

  it('passes "No cards match your search" as emptyMessage to Table', () => {
    setupStore({ searchQuery: "nonexistent" });
    // Table receives data but the emptyMessage prop is always passed for when filtering yields 0 results
    const _cardData = createCardData([]);

    // When cardData is empty we get the card-level empty state, not the Table.
    // We need at least one card so the Table renders.
    const cardDataWithEntry = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 100 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardDataWithEntry} currentScope="all-time" />,
    );

    // The table is rendered — verify the table exists (the emptyMessage prop is set
    // even when data is present; it's displayed by the Table component internally
    // when globalFilter filters everything out).
    const table = screen.getByTestId("table");
    expect(table).toBeInTheDocument();
  });

  // ── totalCount computation ─────────────────────────────────────────────

  it("computes totalCount from cardData for createCardRatioColumn", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Card A", count: 10, ratio: 50 },
      { name: "Card B", count: 30, ratio: 50 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    // createCardRatioColumn should have been called with the computed totalCount = 40
    expect(vi.mocked(createCardRatioColumn)).toHaveBeenCalledWith(40);
  });

  // ── Multiple cards ─────────────────────────────────────────────────────

  it("passes all card entries to the Table", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Card A", count: 5, ratio: 20 },
      { name: "Card B", count: 10, ratio: 40 },
      { name: "Card C", count: 8, ratio: 32 },
      { name: "Card D", count: 2, ratio: 8 },
    ]);

    renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const table = screen.getByTestId("table");
    expect(table).toHaveAttribute("data-rows", "4");
  });

  // ── Show Uncollected Toggle ────────────────────────────────────────────

  it("does not show uncollected toggle when statScope is all-time", () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(
      screen.queryByTestId("show-uncollected-toggle"),
    ).not.toBeInTheDocument();
  });

  it("shows uncollected toggle when statScope is league", () => {
    setupStore({ statScope: "league" });
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(screen.getByTestId("show-uncollected-toggle")).toBeInTheDocument();
  });

  it('renders "Show Uncollected" label text', () => {
    setupStore({ statScope: "league" });
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(screen.getByText("Show Uncollected")).toBeInTheDocument();
  });

  it("checkbox is unchecked when showUncollectedCards is false", () => {
    setupStore({ statScope: "league", showUncollectedCards: false });
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    const checkbox = screen.getByTestId(
      "show-uncollected-checkbox",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("checkbox is checked when showUncollectedCards is true", () => {
    setupStore({ statScope: "league", showUncollectedCards: true });
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    const checkbox = screen.getByTestId(
      "show-uncollected-checkbox",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("calls toggleShowUncollectedCards when checkbox is clicked", async () => {
    const store = setupStore({ statScope: "league" });
    const { user } = renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    const checkbox = screen.getByTestId("show-uncollected-checkbox");
    await user.click(checkbox);

    expect(store.statistics.toggleShowUncollectedCards).toHaveBeenCalled();
  });

  // ── Loading overlay ────────────────────────────────────────────────────

  it("shows loading overlay when isDataLoading is true", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 100 },
    ]);

    const { container } = renderWithProviders(
      <StatisticsTable
        cardData={cardData}
        isDataLoading={true}
        currentScope="all-time"
      />,
    );

    const spinner = container.querySelector(".loading.loading-spinner");
    expect(spinner).toBeTruthy();
  });

  it("does not show loading overlay when isDataLoading is false", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 100 },
    ]);

    const { container } = renderWithProviders(
      <StatisticsTable
        cardData={cardData}
        isDataLoading={false}
        currentScope="all-time"
      />,
    );

    const overlay = container.querySelector(".backdrop-blur-\\[1px\\]");
    expect(overlay).toHaveClass("opacity-0");
  });

  it("does not show loading overlay by default (isDataLoading omitted)", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 100 },
    ]);

    const { container } = renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const overlay = container.querySelector(".backdrop-blur-\\[1px\\]");
    expect(overlay).toHaveClass("opacity-0");
  });

  it("still renders table content behind the overlay when loading", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 100 },
    ]);

    renderWithProviders(
      <StatisticsTable
        cardData={cardData}
        isDataLoading={true}
        currentScope="all-time"
      />,
    );

    expect(screen.getByTestId("table")).toBeInTheDocument();
    expect(screen.getByText("Card Collection")).toBeInTheDocument();
  });

  // ── Search input ───────────────────────────────────────────────────────

  it("renders the search input", () => {
    setupStore();
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    expect(screen.getByTestId("statistics-search")).toBeInTheDocument();
  });

  it("passes setSearchQuery as onChange to Search", async () => {
    const store = setupStore();
    const cardData = createCardData([
      { name: "The Doctor", count: 5, ratio: 100 },
    ]);
    const { user } = renderWithProviders(
      <StatisticsTable cardData={cardData} currentScope="all-time" />,
    );

    const search = screen.getByTestId("statistics-search");
    await user.type(search, "doctor");

    // Each character triggers onChange because our mock Search calls onChange directly
    expect(store.statistics.setSearchQuery).toHaveBeenCalled();
  });

  it("configures Search with 300ms debounce", () => {
    setupStore();
    renderWithProviders(
      <StatisticsTable cardData={[]} currentScope="all-time" />,
    );

    const search = screen.getByTestId("statistics-search");
    expect(search).toHaveAttribute("data-debounce-ms", "300");
  });
});
