import { render } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import ComparisonTable from "../RarityInsights.components/ComparisonTable";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("../RarityInsights.components/PoeNinjaColumnHeader", () => ({
  default: () => <div data-testid="ninja-header" />,
}));

vi.mock("../RarityInsights.components/PoeNinjaRarityCell", () => ({
  default: () => <div data-testid="ninja-cell" />,
}));

vi.mock("../RarityInsights.components/ProhibitedLibraryColumnHeader", () => ({
  default: () => <div data-testid="pl-header" />,
}));

vi.mock("../RarityInsights.components/ProhibitedLibraryRarityCell", () => ({
  default: () => <div data-testid="pl-cell" />,
}));

vi.mock("../RarityInsights.components/RarityBadgeDropdown", () => ({
  default: ({ rarity, outline }: any) => (
    <div
      data-testid="badge-dropdown"
      data-rarity={rarity}
      data-outline={outline}
    />
  ),
}));

vi.mock("../RarityInsights.components/RarityInsightsCardNameCell", () => ({
  default: () => <div data-testid="card-name-cell" />,
}));

vi.mock("~/renderer/utils", () => ({
  getRarityStyles: vi.fn(() => ({
    badgeBg: "#fff",
    badgeText: "#000",
    badgeBorder: "#ccc",
  })),
}));

let capturedTableProps: any = null;

vi.mock("~/renderer/components", () => ({
  Table: Object.assign(
    ({ children, data, columns, emptyMessage, ...rest }: any) => {
      capturedTableProps = { data, columns, emptyMessage, ...rest };
      return (
        <div
          data-testid="table"
          data-row-count={data?.length ?? 0}
          data-column-count={columns?.length ?? 0}
        >
          {data?.length === 0 && emptyMessage && (
            <div data-testid="table-empty">{emptyMessage}</div>
          )}
          {children}
        </div>
      );
    },
    {
      Header: ({ children }: any) => (
        <div data-testid="table-header">{children}</div>
      ),
      Body: ({ children }: any) => (
        <div data-testid="table-body">{children}</div>
      ),
      Row: ({ children }: any) => <div data-testid="table-row">{children}</div>,
      Cell: ({ children }: any) => (
        <div data-testid="table-cell">{children}</div>
      ),
    },
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCard(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "poe1_test-card",
    name: overrides.name ?? "Test Card",
    stackSize: overrides.stackSize ?? 5,
    description: overrides.description ?? "test description",
    rewardHtml: overrides.rewardHtml ?? "<p>Reward</p>",
    artSrc: overrides.artSrc ?? "art.png",
    flavourHtml: overrides.flavourHtml ?? "",
    rarity: overrides.rarity ?? 3,
    filterRarity: overrides.filterRarity ?? null,
    prohibitedLibraryRarity: overrides.prohibitedLibraryRarity ?? null,
    fromBoss: overrides.fromBoss ?? false,
    game: overrides.game ?? "poe1",
    createdAt: overrides.createdAt ?? "2024-01-01",
    updatedAt: overrides.updatedAt ?? "2024-01-01",
  };
}

function makeFilter(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "f1",
    type: overrides.type ?? "local",
    filePath: overrides.filePath ?? "/path/to/filter",
    fileName: overrides.fileName ?? "Filter1.filter",
    name: overrides.name ?? "Filter1",
    lastUpdate: overrides.lastUpdate ?? "2024-01-01",
    isFullyParsed: overrides.isFullyParsed ?? true,
    isOutdated: overrides.isOutdated ?? false,
  };
}

function createMockStoreState(overrides: Record<string, any> = {}) {
  return {
    rarityInsightsComparison: {
      priorityPoeNinjaRarity: null,
      priorityPlRarity: null,
      tableSorting: [],
      handlePoeNinjaRarityClick: vi.fn(),
      handlePlRarityClick: vi.fn(),
      handleFilterRarityClick: vi.fn(),
      priorityFilterRarities: {},
      handleTableSortingChange: vi.fn(),
      selectedFilters: ["f1"],
      parsingFilterId: null,
      parsedResults: new Map([
        [
          "f1",
          {
            filterId: "f1",
            filterName: "Filter1",
            rarities: new Map([["Test Card", 3]]),
            totalCards: 1,
          },
        ],
      ]),
      showDiffsOnly: false,
      includeBossCards: true,
      updateFilterCardRarity: vi.fn(),
      ...overrides.rarityInsightsComparison,
    },
    cards: {
      allCards: [makeCard()],
      ...overrides.cards,
    },
    rarityInsights: {
      availableFilters: [makeFilter()],
      ...overrides.rarityInsights,
    },
  };
}

function setupStore(overrides: Record<string, any> = {}) {
  const mockStoreState = createMockStoreState(overrides);

  vi.mocked(useBoundStore).mockImplementation((selector?: any) => {
    if (selector) return selector(mockStoreState);
    return mockStoreState;
  });

  return mockStoreState;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ComparisonTable", () => {
  afterEach(() => {
    capturedTableProps = null;
    vi.restoreAllMocks();
  });

  // ── Basic rendering ────────────────────────────────────────────────────

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      setupStore();
      renderWithProviders(<ComparisonTable />);

      // The component should render — either the table or the empty message
      expect(document.body).toBeTruthy();
    });

    it("renders the table component when cards exist", () => {
      setupStore();
      renderWithProviders(<ComparisonTable />);

      expect(screen.getByTestId("table")).toBeInTheDocument();
    });

    it("renders with empty cards list", () => {
      setupStore({ cards: { allCards: [] } });
      renderWithProviders(<ComparisonTable />);

      expect(
        screen.getByText("No cards match your criteria"),
      ).toBeInTheDocument();
    });

    it("renders with no selected filters (shows placeholders)", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: [],
          parsedResults: new Map(),
        },
      });
      renderWithProviders(<ComparisonTable />);

      // With 0 selected filters, there should be 3 placeholder columns
      // The table should still render
      expect(screen.getByTestId("table")).toBeInTheDocument();
    });
  });

  // ── Display rows ───────────────────────────────────────────────────────

  describe("display rows", () => {
    it("includes cards that have data", () => {
      setupStore({
        cards: {
          allCards: [
            makeCard({ id: "1", name: "The Doctor", rarity: 1 }),
            makeCard({ id: "2", name: "The Nurse", rarity: 2 }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-row-count", "2");
    });

    it("filters boss cards when includeBossCards is false", () => {
      setupStore({
        rarityInsightsComparison: { includeBossCards: false },
        cards: {
          allCards: [
            makeCard({ id: "1", name: "The Doctor", fromBoss: false }),
            makeCard({ id: "2", name: "Boss Card", fromBoss: true }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-row-count", "1");
    });

    it("shows all cards including boss cards when includeBossCards is true", () => {
      setupStore({
        rarityInsightsComparison: { includeBossCards: true },
        cards: {
          allCards: [
            makeCard({ id: "1", name: "The Doctor", fromBoss: false }),
            makeCard({ id: "2", name: "Boss Card", fromBoss: true }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-row-count", "2");
    });

    it("shows only different rarities when showDiffsOnly is true", () => {
      const parsedResults = new Map([
        [
          "f1",
          {
            filterId: "f1",
            filterName: "Filter1",
            rarities: new Map([
              ["Same Card", 3], // same as poe.ninja rarity
              ["Diff Card", 1], // different from poe.ninja rarity (3)
            ]),
            totalCards: 2,
          },
        ],
      ]);

      setupStore({
        rarityInsightsComparison: {
          showDiffsOnly: true,
          selectedFilters: ["f1"],
          parsedResults,
        },
        cards: {
          allCards: [
            makeCard({ id: "1", name: "Same Card", rarity: 3 }),
            makeCard({ id: "2", name: "Diff Card", rarity: 3 }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // "Diff Card" has filter rarity 1 vs ninja rarity 3 → different
      // "Same Card" has filter rarity 3 vs ninja rarity 3 → same
      expect(table).toHaveAttribute("data-row-count", "1");
    });
  });

  // ── Column generation ──────────────────────────────────────────────────

  describe("column generation", () => {
    it("creates columns including card name column", () => {
      setupStore();
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // With includeBossCards=true: fromBoss + name + poeNinja + PL + 1 filter + 2 placeholders = 7
      const columnCount = parseInt(
        table.getAttribute("data-column-count") ?? "0",
        10,
      );
      expect(columnCount).toBeGreaterThanOrEqual(4); // at minimum: name + ninja + PL + filter
    });

    it("creates correct number of columns with one selected filter", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // name + poeNinja + PL + 1 filter + 2 placeholders = 6
      const columnCount = parseInt(
        table.getAttribute("data-column-count") ?? "0",
        10,
      );
      expect(columnCount).toBe(6);
    });

    it("creates dynamic filter column for each selected filter", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1", "f2"],
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
            [
              "f2",
              {
                filterId: "f2",
                filterName: "Filter2",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
          ]),
          includeBossCards: false,
        },
        rarityInsights: {
          availableFilters: [
            makeFilter({ id: "f1", name: "Filter1" }),
            makeFilter({ id: "f2", name: "Filter2" }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // name + poeNinja + PL + 2 filters + 1 placeholder = 6
      const columnCount = parseInt(
        table.getAttribute("data-column-count") ?? "0",
        10,
      );
      expect(columnCount).toBe(6);
    });

    it("creates placeholder columns when fewer than max filters selected", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: [],
          parsedResults: new Map(),
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // name + poeNinja + PL + 0 filters + 3 placeholders = 6
      const columnCount = parseInt(
        table.getAttribute("data-column-count") ?? "0",
        10,
      );
      expect(columnCount).toBe(6);
    });

    it("includes boss column when includeBossCards is true", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          includeBossCards: true,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // fromBoss + name + poeNinja + PL + 1 filter + 2 placeholders = 7
      const columnCount = parseInt(
        table.getAttribute("data-column-count") ?? "0",
        10,
      );
      expect(columnCount).toBe(7);
    });

    it("omits boss column when includeBossCards is false", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      // name + poeNinja + PL + 1 filter + 2 placeholders = 6
      const columnCount = parseInt(
        table.getAttribute("data-column-count") ?? "0",
        10,
      );
      expect(columnCount).toBe(6);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty parsedResults gracefully", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsedResults: new Map(),
        },
      });
      renderWithProviders(<ComparisonTable />);

      expect(screen.getByTestId("table")).toBeInTheDocument();
    });

    it("handles empty selectedFilters", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: [],
          parsedResults: new Map(),
        },
      });
      renderWithProviders(<ComparisonTable />);

      expect(screen.getByTestId("table")).toBeInTheDocument();
    });

    it("handles parsingFilterId showing a filter is being parsed", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: "f1",
          parsedResults: new Map(),
        },
      });
      renderWithProviders(<ComparisonTable />);

      // Should render without crashing even when a filter is being parsed
      expect(screen.getByTestId("table")).toBeInTheDocument();
    });

    it("works with globalFilter prop", () => {
      setupStore({
        cards: {
          allCards: [
            makeCard({ id: "1", name: "The Doctor" }),
            makeCard({ id: "2", name: "The Nurse" }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable globalFilter="Doctor" />);

      expect(screen.getByTestId("table")).toBeInTheDocument();
    });

    it("handles null prohibitedLibraryRarity on cards", () => {
      setupStore({
        cards: {
          allCards: [
            makeCard({
              id: "1",
              name: "Test Card",
              prohibitedLibraryRarity: null,
            }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      expect(screen.getByTestId("table")).toBeInTheDocument();
    });

    it("shows empty message when all cards are boss cards and includeBossCards is false", () => {
      setupStore({
        rarityInsightsComparison: { includeBossCards: false },
        cards: {
          allCards: [makeCard({ id: "1", name: "Boss Only", fromBoss: true })],
        },
      });
      renderWithProviders(<ComparisonTable />);

      expect(
        screen.getByText("No cards match your criteria"),
      ).toBeInTheDocument();
    });

    it("handles multiple cards with varying rarities", () => {
      setupStore({
        cards: {
          allCards: [
            makeCard({ id: "1", name: "Card A", rarity: 1 }),
            makeCard({ id: "2", name: "Card B", rarity: 2 }),
            makeCard({ id: "3", name: "Card C", rarity: 3 }),
            makeCard({ id: "4", name: "Card D", rarity: 4 }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-row-count", "4");
    });
  });

  // ── Filter column header rendering ─────────────────────────────────────

  describe("filter column header rendering", () => {
    function getFilterColumn(filterId: string) {
      return capturedTableProps?.columns?.find(
        (col: any) => col.id === `filter_${filterId}`,
      );
    }

    it("renders spinner and 'Parsing…' text when isParsing is true", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: "f1",
          parsedResults: new Map(), // no results yet → isParsing = true
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const headerFn = filterCol.columnDef?.header ?? filterCol.header;
      const { container } = render(
        typeof headerFn === "function" ? headerFn() : headerFn,
      );

      // Should show the spinning refresh icon
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
      // Should show "Parsing…" text
      expect(container.textContent).toContain("Parsing");
    });

    it("renders filter name and outdated badge when isOutdated is true", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: null,
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
          ]),
        },
        rarityInsights: {
          availableFilters: [
            makeFilter({ id: "f1", name: "MyFilter", isOutdated: true }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const headerFn = filterCol.columnDef?.header ?? filterCol.header;
      const { container } = render(
        typeof headerFn === "function" ? headerFn() : headerFn,
      );

      // Should show filter name
      expect(container.textContent).toContain("MyFilter");
      // Should show outdated badge
      expect(container.textContent).toContain("outdated");
      expect(container.querySelector(".badge-warning")).toBeInTheDocument();
    });

    it("renders filter name only when not parsing and not outdated", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: null,
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
          ]),
        },
        rarityInsights: {
          availableFilters: [
            makeFilter({ id: "f1", name: "MyFilter", isOutdated: false }),
          ],
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const headerFn = filterCol.columnDef?.header ?? filterCol.header;
      const { container } = render(
        typeof headerFn === "function" ? headerFn() : headerFn,
      );

      // Should show filter name
      expect(container.textContent).toContain("MyFilter");
      // Should NOT show outdated badge
      expect(container.querySelector(".badge-warning")).not.toBeInTheDocument();
      // Should NOT show spinner
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  // ── Filter column cell rendering ───────────────────────────────────────

  describe("filter column cell rendering", () => {
    function getFilterColumn(filterId: string) {
      return capturedTableProps?.columns?.find(
        (col: any) => col.id === `filter_${filterId}`,
      );
    }

    function makeCellContext(
      filterRarities: Record<string, number | null>,
      ninjaRarity = 3,
    ) {
      return {
        row: {
          original: {
            id: "poe1_test-card",
            name: "Test Card",
            rarity: ninjaRarity,
            filterRarities,
            isDifferent: false,
            fromBoss: false,
          },
        },
        getValue: () => filterRarities.f1 ?? null,
      };
    }

    it("renders loading dots when filterRarity is null", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: null,
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
          ]),
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const cellFn = filterCol.columnDef?.cell ?? filterCol.cell;
      const ctx = makeCellContext({ f1: null });
      const { container } = render(
        typeof cellFn === "function" ? cellFn(ctx) : cellFn,
      );

      expect(container.querySelector(".loading-dots")).toBeInTheDocument();
    });

    it("renders loading dots when filterRarity is undefined", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: null,
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
          ]),
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const cellFn = filterCol.columnDef?.cell ?? filterCol.cell;
      const ctx = makeCellContext({});
      const { container } = render(
        typeof cellFn === "function" ? cellFn(ctx) : cellFn,
      );

      expect(container.querySelector(".loading-dots")).toBeInTheDocument();
    });

    it("renders RarityBadgeDropdown when filterRarity is a number", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: null,
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map([["Test Card", 2]]),
                totalCards: 1,
              },
            ],
          ]),
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const cellFn = filterCol.columnDef?.cell ?? filterCol.cell;
      const ctx = makeCellContext({ f1: 2 }, 3);
      const { container } = render(
        typeof cellFn === "function" ? cellFn(ctx) : cellFn,
      );

      const badge = container.querySelector("[data-testid='badge-dropdown']");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-rarity", "2");
      // rarity 2 !== ninja rarity 3 → outline should be true
      expect(badge).toHaveAttribute("data-outline", "true");
    });

    it("renders RarityBadgeDropdown without outline when rarity matches ninja", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsingFilterId: null,
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map([["Test Card", 3]]),
                totalCards: 1,
              },
            ],
          ]),
        },
      });
      renderWithProviders(<ComparisonTable />);

      const filterCol = getFilterColumn("f1");
      expect(filterCol).toBeDefined();

      const cellFn = filterCol.columnDef?.cell ?? filterCol.cell;
      const ctx = makeCellContext({ f1: 3 }, 3);
      const { container } = render(
        typeof cellFn === "function" ? cellFn(ctx) : cellFn,
      );

      const badge = container.querySelector("[data-testid='badge-dropdown']");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-rarity", "3");
      // rarity 3 === ninja rarity 3 → outline should be false
      expect(badge).toHaveAttribute("data-outline", "false");
    });
  });

  // ── Placeholder column rendering ───────────────────────────────────────

  describe("placeholder column rendering", () => {
    function getPlaceholderColumns() {
      return (capturedTableProps?.columns ?? []).filter((col: any) =>
        (col.id ?? "").startsWith("placeholder_"),
      );
    }

    it("renders placeholder header with name and disabled RarityChips", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: [],
          parsedResults: new Map(),
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const placeholders = getPlaceholderColumns();
      expect(placeholders.length).toBe(3);

      // Render the first placeholder header
      const headerFn =
        placeholders[0].columnDef?.header ?? placeholders[0].header;
      const { container } = render(
        typeof headerFn === "function" ? headerFn() : headerFn,
      );

      // Should show placeholder name "Filter 1"
      expect(container.textContent).toContain("Filter 1");

      // Should render disabled RarityChip buttons
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(4); // R1, R2, R3, R4
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });

    it("renders placeholder cell as a dash", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: [],
          parsedResults: new Map(),
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const placeholders = getPlaceholderColumns();
      expect(placeholders.length).toBe(3);

      // Render the first placeholder cell
      const cellFn = placeholders[0].columnDef?.cell ?? placeholders[0].cell;
      const { container } = render(
        typeof cellFn === "function" ? cellFn() : cellFn,
      );

      expect(container.textContent).toContain("—");
    });

    it("renders correct placeholder names for each slot", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: [],
          parsedResults: new Map(),
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const placeholders = getPlaceholderColumns();
      const expectedNames = ["Filter 1", "Filter 2", "Filter 3"];

      placeholders.forEach((placeholder: any, i: number) => {
        const headerFn = placeholder.columnDef?.header ?? placeholder.header;
        const { container } = render(
          typeof headerFn === "function" ? headerFn() : headerFn,
        );
        expect(container.textContent).toContain(expectedNames[i]);
      });
    });

    it("fills remaining placeholder slots when some filters are selected", () => {
      setupStore({
        rarityInsightsComparison: {
          selectedFilters: ["f1"],
          parsedResults: new Map([
            [
              "f1",
              {
                filterId: "f1",
                filterName: "Filter1",
                rarities: new Map(),
                totalCards: 0,
              },
            ],
          ]),
          includeBossCards: false,
        },
      });
      renderWithProviders(<ComparisonTable />);

      const placeholders = getPlaceholderColumns();
      // 1 selected filter → 2 placeholders
      expect(placeholders.length).toBe(2);

      // First placeholder should be "Filter 2" (index 1)
      const headerFn =
        placeholders[0].columnDef?.header ?? placeholders[0].header;
      const { container } = render(
        typeof headerFn === "function" ? headerFn() : headerFn,
      );
      expect(container.textContent).toContain("Filter 2");
    });
  });
});
