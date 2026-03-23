import {
  act,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFTable from "../ProfitForecast.components/PFTable/PFTable";
import type { CardForecastRow } from "../ProfitForecast.slice";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

let lastTableProps: any = {};

vi.mock("~/renderer/components", () => ({
  Table: ({ data, columns, globalFilter, ...props }: any) => {
    lastTableProps = { data, columns, globalFilter, ...props };
    return (
      <div
        data-testid="table"
        data-rows={data.length}
        data-global-filter={globalFilter}
      >
        {data.length === 0 && <span>empty</span>}
      </div>
    );
  },
}));

vi.mock("../ProfitForecast.components/PFTable/columns", () => ({
  createPFCardNameColumn: vi.fn(() => ({ id: "cardName" })),
  createPFChanceColumn: vi.fn(() => ({ id: "chanceInBatch" })),
  createPFExcludeColumn: vi.fn(() => ({ id: "exclude" })),
  createPFPlAllDropsColumn: vi.fn(() => ({ id: "plB" })),
  createPFPlCardOnlyColumn: vi.fn(() => ({ id: "plA" })),
  createPFPriceColumn: vi.fn(() => ({ id: "divineValue" })),
  createPFStatusColumn: vi.fn(() => ({ id: "status" })),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// Re-import column factories so we can assert on calls
import { createPFCardNameColumn } from "../ProfitForecast.components/PFTable/columns";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<CardForecastRow> = {}): CardForecastRow {
  return {
    cardName: "The Doctor",
    weight: 100,
    fromBoss: false,
    probability: 0.001,
    chaosValue: 50000,
    divineValue: 250,
    evContribution: 50,
    hasPrice: true,
    confidence: 1,
    isAnomalous: false,
    excludeFromEv: false,
    userOverride: false,
    belowMinPrice: false,
    chanceInBatch: 0.5,
    expectedDecks: 1000,
    costToPull: 40000,
    plA: 10000,
    plB: 12000,
    ...overrides,
  };
}

function setupStore(overrides: any = {}) {
  const store = {
    profitForecast: {
      rows: [],
      minPriceThreshold: 10,
      isComputing: false,
      isLoading: false,
      getFilteredRows: vi.fn(() => []),
      getExcludedCount: vi.fn(() => ({
        anomalous: 0,
        lowConfidence: 0,
        userOverridden: 0,
      })),
      ...overrides.profitForecast,
    },
    poeNinja: {
      isRefreshing: false,
      ...overrides.poeNinja,
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

const defaultProps = {
  globalFilter: "",
  cardMetadataMap: new Map(),
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    lastTableProps = {};
  });

  // ── Empty / basic rendering ──────────────────────────────────────────

  describe("Empty state", () => {
    it("shows empty message when rows are empty, not loading, and no filter bar", () => {
      setupStore();
      renderWithProviders(<PFTable {...defaultProps} />);

      expect(
        screen.getByText("No cards match the current filters."),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("table")).not.toBeInTheDocument();
    });

    it("does not show empty message when isLoading is true", () => {
      setupStore({
        profitForecast: { isLoading: true },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      // The early return requires !isLoading, so when isLoading is true
      // we should NOT see the standalone empty message (the early return path)
      // Instead we enter the main layout branch.
      expect(
        screen.queryByText("No cards match the current filters."),
      ).not.toBeInTheDocument();
    });
  });

  // ── Table rendering ──────────────────────────────────────────────────

  describe("Table rendering", () => {
    it("renders Table with correct row count when rows exist", () => {
      const rows = [makeRow(), makeRow({ cardName: "House of Mirrors" })];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      const table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();
      expect(table).toHaveAttribute("data-rows", "2");
    });

    it("passes globalFilter prop to Table component", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} globalFilter="doctor" />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-global-filter", "doctor");
    });
  });

  // ── Loading / refreshing overlay ─────────────────────────────────────

  describe("Loading overlay", () => {
    it("shows spinner when isComputing is true", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          isComputing: true,
          getFilteredRows: vi.fn(() => rows),
        },
      });
      const { container } = renderWithProviders(<PFTable {...defaultProps} />);

      const spinner = container.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
    });

    it("shows spinner when isRefreshing is true", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
        poeNinja: { isRefreshing: true },
      });
      const { container } = renderWithProviders(<PFTable {...defaultProps} />);

      const spinner = container.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
    });

    it("does not show spinner when neither computing nor refreshing", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      const { container } = renderWithProviders(<PFTable {...defaultProps} />);

      const spinner = container.querySelector(".loading-spinner");
      expect(spinner).not.toBeInTheDocument();
    });
  });

  // ── Filter bar ───────────────────────────────────────────────────────

  describe("Filter bar", () => {
    it("shows 'Hide anomalous prices' checkbox when excludedCount.anomalous > 0", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 3,
            lowConfidence: 0,
            userOverridden: 0,
          })),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      expect(screen.getByText(/Hide anomalous prices/)).toBeInTheDocument();
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    it("shows 'Hide low confidence prices' checkbox when excludedCount.lowConfidence > 0", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 0,
            lowConfidence: 5,
            userOverridden: 0,
          })),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      expect(
        screen.getByText(/Hide low confidence prices/),
      ).toBeInTheDocument();
      expect(screen.getByText("(5)")).toBeInTheDocument();
    });

    it("shows 'N manually overridden' text when excludedCount.userOverridden > 0", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 0,
            lowConfidence: 0,
            userOverridden: 7,
          })),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      expect(screen.getByText("7 manually overridden")).toBeInTheDocument();
    });

    it("does not show filter bar when all excludedCounts are 0", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      expect(
        screen.queryByText(/Hide anomalous prices/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Hide low confidence prices/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/manually overridden/)).not.toBeInTheDocument();
    });

    it("shows all filter bar items simultaneously when all excludedCounts > 0", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 2,
            lowConfidence: 4,
            userOverridden: 1,
          })),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      expect(screen.getByText(/Hide anomalous prices/)).toBeInTheDocument();
      expect(
        screen.getByText(/Hide low confidence prices/),
      ).toBeInTheDocument();
      expect(screen.getByText("1 manually overridden")).toBeInTheDocument();
    });
  });

  // ── Toggle filters ───────────────────────────────────────────────────

  describe("Toggle filters", () => {
    it("hides anomalous rows after clicking the anomalous checkbox", async () => {
      const rows = [
        makeRow({ cardName: "Normal Card", isAnomalous: false }),
        makeRow({ cardName: "Anomalous Card", isAnomalous: true }),
      ];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 1,
            lowConfidence: 0,
            userOverridden: 0,
          })),
        },
      });
      const { user } = renderWithProviders(<PFTable {...defaultProps} />);

      // Before clicking — both rows are present
      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "2");

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      // After clicking — anomalous row should be filtered out
      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "1");
    });

    it("hides low confidence rows after clicking the low confidence checkbox", async () => {
      const rows = [
        makeRow({ cardName: "High Confidence", confidence: 1 }),
        makeRow({ cardName: "Low Confidence", confidence: 3 }),
      ];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 0,
            lowConfidence: 1,
            userOverridden: 0,
          })),
        },
      });
      const { user } = renderWithProviders(<PFTable {...defaultProps} />);

      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "2");

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "1");
    });

    it("shows empty message with filter bar when all rows are toggled off", async () => {
      const rows = [
        makeRow({ cardName: "Anomalous 1", isAnomalous: true }),
        makeRow({ cardName: "Anomalous 2", isAnomalous: true }),
      ];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 2,
            lowConfidence: 0,
            userOverridden: 0,
          })),
        },
      });
      const { user } = renderWithProviders(<PFTable {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      // Filter bar should still be visible
      expect(screen.getByText(/Hide anomalous prices/)).toBeInTheDocument();

      // Empty message should be shown instead of table
      expect(
        screen.getByText("No cards match the current filters."),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("table")).not.toBeInTheDocument();
    });

    it("can toggle both anomalous and low confidence filters simultaneously", async () => {
      const rows = [
        makeRow({ cardName: "Normal", isAnomalous: false, confidence: 1 }),
        makeRow({
          cardName: "Anomalous",
          isAnomalous: true,
          confidence: 1,
        }),
        makeRow({
          cardName: "Low Conf",
          isAnomalous: false,
          confidence: 3,
        }),
      ];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
          getExcludedCount: vi.fn(() => ({
            anomalous: 1,
            lowConfidence: 1,
            userOverridden: 0,
          })),
        },
      });
      const { user } = renderWithProviders(<PFTable {...defaultProps} />);

      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "3");

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);

      // Click both checkboxes
      await user.click(checkboxes[0]); // hide anomalous
      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "2");

      await user.click(checkboxes[1]); // hide low confidence
      expect(screen.getByTestId("table")).toHaveAttribute("data-rows", "1");
    });
  });

  // ── Global filter merging ────────────────────────────────────────────

  describe("Global filter merging", () => {
    it("merges below-threshold rows that match the global filter", () => {
      const filteredRows = [makeRow({ cardName: "The Doctor" })];
      const allStoreRows = [
        makeRow({ cardName: "The Doctor" }),
        makeRow({
          cardName: "The Nurse",
          chaosValue: 5,
          hasPrice: true,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} globalFilter="nurse" />);

      // The Doctor (from filteredRows) + The Nurse (below threshold but matches filter)
      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-rows", "2");
    });

    it("does not merge below-threshold rows that don't match the filter", () => {
      const filteredRows = [makeRow({ cardName: "The Doctor" })];
      const allStoreRows = [
        makeRow({ cardName: "The Doctor" }),
        makeRow({
          cardName: "The Nurse",
          chaosValue: 5,
          hasPrice: true,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} globalFilter="doctor" />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-rows", "1");
    });

    it("does not merge rows when globalFilter is empty", () => {
      const filteredRows = [makeRow({ cardName: "The Doctor" })];
      const allStoreRows = [
        makeRow({ cardName: "The Doctor" }),
        makeRow({
          cardName: "The Nurse",
          chaosValue: 5,
          hasPrice: true,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} globalFilter="" />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-rows", "1");
    });

    it("does not merge rows when globalFilter is whitespace only", () => {
      const filteredRows = [makeRow({ cardName: "The Doctor" })];
      const allStoreRows = [
        makeRow({ cardName: "The Doctor" }),
        makeRow({
          cardName: "The Nurse",
          chaosValue: 5,
          hasPrice: true,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} globalFilter="   " />);

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-rows", "1");
    });

    it("does not duplicate rows already in filteredRows when merging", () => {
      const doctor = makeRow({ cardName: "The Doctor" });
      const filteredRows = [doctor];
      const allStoreRows = [
        doctor,
        makeRow({
          cardName: "The Doctor's Bag",
          chaosValue: 2,
          hasPrice: true,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} globalFilter="doctor" />);

      const table = screen.getByTestId("table");
      // The Doctor (filtered) + The Doctor's Bag (below threshold, matches)
      expect(table).toHaveAttribute("data-rows", "2");
    });

    it("merges rows without price (hasPrice: false) that match the filter", () => {
      const filteredRows = [makeRow({ cardName: "The Doctor" })];
      const allStoreRows = [
        makeRow({ cardName: "The Doctor" }),
        makeRow({
          cardName: "Mysterious Card",
          chaosValue: 0,
          hasPrice: false,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(
        <PFTable {...defaultProps} globalFilter="mysterious" />,
      );

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-rows", "2");
    });

    it("performs case-insensitive matching for globalFilter", () => {
      const filteredRows: CardForecastRow[] = [];
      const allStoreRows = [
        makeRow({
          cardName: "The Nurse",
          chaosValue: 2,
          hasPrice: true,
        }),
      ];

      setupStore({
        profitForecast: {
          rows: allStoreRows,
          minPriceThreshold: 10,
          getFilteredRows: vi.fn(() => filteredRows),
        },
      });
      renderWithProviders(
        <PFTable {...defaultProps} globalFilter="THE NURSE" />,
      );

      const table = screen.getByTestId("table");
      expect(table).toHaveAttribute("data-rows", "1");
    });
  });

  // ── handleSortingChange ────────────────────────────────────────────

  describe("handleSortingChange", () => {
    it("resolves a direct value and updates sorting state", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      const onSortingChange = lastTableProps.onSortingChange;
      expect(onSortingChange).toBeDefined();

      // Call with a direct value (not a function)
      const newSorting = [{ id: "divineValue", desc: false }];
      act(() => {
        onSortingChange(newSorting);
      });

      // The sorting prop passed to Table should now reflect the new value
      expect(lastTableProps.sorting).toEqual(newSorting);
    });

    it("resolves a function updater and updates sorting state", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      const onSortingChange = lastTableProps.onSortingChange;
      expect(onSortingChange).toBeDefined();

      // The default sorting is [{ id: "chanceInBatch", desc: true }]
      // Call with a function updater that derives from previous state
      act(() => {
        onSortingChange((prev: any) => [
          ...prev,
          { id: "divineValue", desc: false },
        ]);
      });

      expect(lastTableProps.sorting).toEqual([
        { id: "chanceInBatch", desc: true },
        { id: "divineValue", desc: false },
      ]);
    });
  });

  // ── rowClassName ───────────────────────────────────────────────────

  describe("rowClassName", () => {
    it("returns opacity class for rows with belowMinPrice: true", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      const rowClassName = lastTableProps.rowClassName;
      expect(rowClassName).toBeDefined();

      const mockRow = { original: { belowMinPrice: true } } as any;
      const className = rowClassName(mockRow);

      expect(className).toContain("opacity-45");
      expect(className).toContain("hover:opacity-70");
    });

    it("returns default hover class for rows with belowMinPrice: false", () => {
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(<PFTable {...defaultProps} />);

      const rowClassName = lastTableProps.rowClassName;
      expect(rowClassName).toBeDefined();

      const mockRow = { original: { belowMinPrice: false } } as any;
      const className = rowClassName(mockRow);

      expect(className).not.toContain("opacity-45");
      expect(className).toContain("transition-colors");
    });
  });

  // ── Column factory ───────────────────────────────────────────────────

  describe("Column factory", () => {
    it("passes cardMetadataMap to createPFCardNameColumn", () => {
      const metadataMap = new Map([
        ["The Doctor", { artFilename: "doctor.png" } as any],
      ]);
      const rows = [makeRow()];
      setupStore({
        profitForecast: {
          getFilteredRows: vi.fn(() => rows),
        },
      });
      renderWithProviders(
        <PFTable globalFilter="" cardMetadataMap={metadataMap} />,
      );

      expect(createPFCardNameColumn).toHaveBeenCalledWith(metadataMap);
    });
  });
});
