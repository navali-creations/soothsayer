import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useBoundStore } from "~/renderer/store";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => {
  const useBoundStore = vi.fn();
  return {
    useBoundStore,
    useCurrentSession: () => useBoundStore().currentSession,
    useSettings: () => useBoundStore().settings,
    usePoeNinja: () => useBoundStore().poeNinja,
    useSessionDetails: () => useBoundStore().sessionDetails,
    useOverlay: () => useBoundStore().overlay,
    useAppMenu: () => useBoundStore().appMenu,
    useSetup: () => useBoundStore().setup,
    useStorage: () => useBoundStore().storage,
    useGameInfo: () => useBoundStore().gameInfo,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useProhibitedLibrary: () => useBoundStore().prohibitedLibrary,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useCardDetails: () => useBoundStore().cardDetails,
    useRootActions: () => {
      const s = useBoundStore();
      return {
        hydrate: s.hydrate,
        startListeners: s.startListeners,
        reset: s.reset,
      };
    },
    useSlice: (key: string) => useBoundStore()?.[key],
  };
});

vi.mock("~/renderer/components", () => ({
  TableHeader: ({ children, tooltip, className }: any) => (
    <div
      data-testid="table-header"
      data-tooltip={tooltip}
      className={className}
    >
      {children}
    </div>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiEye: (props: any) => <span data-testid="fi-eye" {...props} />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

interface MockStoreOverrides {
  currentSession?: Record<string, any>;
  settings?: Record<string, any>;
}

function createMockStore(overrides: MockStoreOverrides = {}) {
  return {
    currentSession: {
      getChaosToDivineRatio: vi.fn(() => 200),
      getSession: vi.fn(() => ({
        totalCount: 100,
        priceSnapshot: { timestamp: "2024-01-01" },
        cards: [],
      })),
      toggleCardPriceVisibility: vi.fn(),
      ...overrides.currentSession,
    },
    settings: {
      getActiveGameViewPriceSource: vi.fn(() => "exchange" as const),
      ...overrides.settings,
    },
  } as any;
}

function setupStore(overrides: MockStoreOverrides = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

/**
 * Builds a minimal CellContext-like object for testing cell renderers.
 */
function createCellContext(original: Record<string, any>, value?: any) {
  return {
    row: { original },
    getValue: () => value,
    column: { id: "test" },
    cell: { id: "test-cell", getValue: () => value },
    table: {},
    renderValue: () => value,
  } as any;
}

/**
 * Builds a minimal Row-like object for testing sortingFn.
 */
function createRow(original: Record<string, any>) {
  return { original } as any;
}

function makeCardEntry(overrides: Record<string, any> = {}) {
  return {
    name: "The Doctor",
    count: 5,
    stashPrice: {
      chaosValue: 1000,
      divineValue: 5,
      totalValue: 5000,
      hidePrice: false,
    },
    exchangePrice: {
      chaosValue: 950,
      divineValue: 4.75,
      totalValue: 4750,
      hidePrice: false,
    },
    ...overrides,
  };
}

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import CurrentSessionChaosValueCell from "../CurrentSessionChaosValueColumn/CurrentSessionChaosValueCell";
import { createCurrentSessionChaosValueColumn } from "../CurrentSessionChaosValueColumn/createCurrentSessionChaosValueColumn";
import CurrentSessionHidePriceCell from "../CurrentSessionHidePriceColumn/CurrentSessionHidePriceCell";
import { createCurrentSessionHidePriceColumn } from "../CurrentSessionHidePriceColumn/createCurrentSessionHidePriceColumn";
import CurrentSessionRatioCell from "../CurrentSessionRatioColumn/CurrentSessionRatioCell";
import { createCurrentSessionRatioColumn } from "../CurrentSessionRatioColumn/createCurrentSessionRatioColumn";
import CurrentSessionTotalValueCell from "../CurrentSessionTotalValueColumn/CurrentSessionTotalValueCell";
import { createCurrentSessionTotalValueColumn } from "../CurrentSessionTotalValueColumn/createCurrentSessionTotalValueColumn";

// ═══════════════════════════════════════════════════════════════════════════
// ChaosValue Column
// ═══════════════════════════════════════════════════════════════════════════

describe("CurrentSessionChaosValueColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createCurrentSessionChaosValueColumn", () => {
    it("creates a column with id 'chaosValue'", () => {
      const column = createCurrentSessionChaosValueColumn("exchange");
      expect(column.id).toBe("chaosValue");
    });

    it("has sorting enabled", () => {
      const column = createCurrentSessionChaosValueColumn("exchange");
      expect(column.enableSorting).toBe(true);
    });

    it("renders a TableHeader with 'Value (Each)' text", () => {
      const column = createCurrentSessionChaosValueColumn("exchange");
      const HeaderComponent = column.header as any;
      render(<HeaderComponent />);
      expect(screen.getByTestId("table-header")).toHaveTextContent(
        "Value (Each)",
      );
    });

    describe("sortingFn (exchange)", () => {
      it("sorts by exchange chaosValue ascending", () => {
        const column = createCurrentSessionChaosValueColumn("exchange");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(
          makeCardEntry({ exchangePrice: { chaosValue: 100 } }),
        );
        const rowB = createRow(
          makeCardEntry({ exchangePrice: { chaosValue: 200 } }),
        );
        expect(sortFn(rowA, rowB)).toBeLessThan(0);
      });

      it("sorts equal values as 0", () => {
        const column = createCurrentSessionChaosValueColumn("exchange");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(
          makeCardEntry({ exchangePrice: { chaosValue: 100 } }),
        );
        const rowB = createRow(
          makeCardEntry({ exchangePrice: { chaosValue: 100 } }),
        );
        expect(sortFn(rowA, rowB)).toBe(0);
      });

      it("handles missing exchangePrice by defaulting to 0", () => {
        const column = createCurrentSessionChaosValueColumn("exchange");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(makeCardEntry({ exchangePrice: undefined }));
        const rowB = createRow(
          makeCardEntry({ exchangePrice: { chaosValue: 50 } }),
        );
        expect(sortFn(rowA, rowB)).toBeLessThan(0);
      });
    });

    describe("sortingFn (stash)", () => {
      it("sorts by stash chaosValue ascending", () => {
        const column = createCurrentSessionChaosValueColumn("stash");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(
          makeCardEntry({ stashPrice: { chaosValue: 300 } }),
        );
        const rowB = createRow(
          makeCardEntry({ stashPrice: { chaosValue: 100 } }),
        );
        expect(sortFn(rowA, rowB)).toBeGreaterThan(0);
      });

      it("handles missing stashPrice by defaulting to 0", () => {
        const column = createCurrentSessionChaosValueColumn("stash");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(makeCardEntry({ stashPrice: undefined }));
        const rowB = createRow(makeCardEntry({ stashPrice: undefined }));
        expect(sortFn(rowA, rowB)).toBe(0);
      });
    });
  });

  describe("CurrentSessionChaosValueCell", () => {
    it("renders formatted currency for exchange price", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 950, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      // 950 >= 200 (divine ratio) → divine format: 950/200 = 4.75d
      expect(screen.getByText("4.75d")).toBeInTheDocument();
    });

    it("renders formatted currency for stash price when source is stash", () => {
      setupStore({
        settings: { getActiveGameViewPriceSource: vi.fn(() => "stash") },
      });
      const card = makeCardEntry({
        stashPrice: { chaosValue: 100, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      // 100 < 200 (divine ratio) → chaos format: 100.00c
      expect(screen.getByText("100.00c")).toBeInTheDocument();
    });

    it("renders N/A when chaosValue is 0", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 0, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("renders N/A when priceInfo is undefined", () => {
      setupStore();
      const card = makeCardEntry({ exchangePrice: undefined });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("applies opacity-50 class when hidePrice is true", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 500, hidePrice: true },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      const badge = screen.getByText("2.50d").closest("div");
      expect(badge).toHaveClass("opacity-50");
    });

    it("does not apply opacity-50 class when hidePrice is false", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 500, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      const badge = screen.getByText("2.50d").closest("div");
      expect(badge).not.toHaveClass("opacity-50");
    });

    it("renders chaos format for small values", () => {
      setupStore({
        currentSession: { getChaosToDivineRatio: vi.fn(() => 200) },
      });
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 50, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionChaosValueCell {...ctx} />);
      expect(screen.getByText("50.00c")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HidePrice Column
// ═══════════════════════════════════════════════════════════════════════════

describe("CurrentSessionHidePriceColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createCurrentSessionHidePriceColumn", () => {
    it("creates a column with id 'hidePrice'", () => {
      const column = createCurrentSessionHidePriceColumn();
      expect(column.id).toBe("hidePrice");
    });

    it("has sorting disabled", () => {
      const column = createCurrentSessionHidePriceColumn();
      expect(column.enableSorting).toBe(false);
    });

    it("has a size of 50", () => {
      const column = createCurrentSessionHidePriceColumn();
      expect(column.size).toBe(50);
    });

    it("renders header with eye icon and tooltip", () => {
      const column = createCurrentSessionHidePriceColumn();
      const HeaderComponent = column.header as any;
      render(<HeaderComponent />);
      const header = screen.getByTestId("table-header");
      expect(header).toHaveAttribute(
        "data-tooltip",
        "Hide anomalous prices from total calculations",
      );
      expect(screen.getByTestId("fi-eye")).toBeInTheDocument();
    });
  });

  describe("CurrentSessionHidePriceCell", () => {
    it("renders a checkbox that is checked when hidePrice is false (exchange)", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 100, hidePrice: false },
      });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("renders a checkbox that is unchecked when hidePrice is true", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 100, hidePrice: true },
      });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("reads hidePrice from stash source when priceSource is stash", () => {
      setupStore({
        settings: { getActiveGameViewPriceSource: vi.fn(() => "stash") },
      });
      const card = makeCardEntry({
        stashPrice: { chaosValue: 100, hidePrice: true },
        exchangePrice: { chaosValue: 100, hidePrice: false },
      });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      const checkbox = screen.getByRole("checkbox");
      // stashPrice.hidePrice = true → unchecked
      expect(checkbox).not.toBeChecked();
    });

    it("calls toggleCardPriceVisibility on change", async () => {
      const store = setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 100, hidePrice: false },
      });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      const checkbox = screen.getByRole("checkbox");
      await userEvent.click(checkbox);
      expect(
        store.currentSession.toggleCardPriceVisibility,
      ).toHaveBeenCalledWith("The Doctor", "exchange");
    });

    it("calls toggleCardPriceVisibility with stash source", async () => {
      const store = setupStore({
        settings: { getActiveGameViewPriceSource: vi.fn(() => "stash") },
      });
      const card = makeCardEntry();
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      await userEvent.click(screen.getByRole("checkbox"));
      expect(
        store.currentSession.toggleCardPriceVisibility,
      ).toHaveBeenCalledWith("The Doctor", "stash");
    });

    it("disables checkbox when session has no price snapshot", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ priceSnapshot: null })),
        },
      });
      const card = makeCardEntry();
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("enables checkbox when session has a price snapshot", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({
            priceSnapshot: { timestamp: "2024-01-01" },
          })),
        },
      });
      const card = makeCardEntry();
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      expect(screen.getByRole("checkbox")).toBeEnabled();
    });

    it("shows correct title when no snapshot (disabled)", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ priceSnapshot: null })),
        },
      });
      const card = makeCardEntry();
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "title",
        "Price visibility can only be changed when using snapshot prices",
      );
    });

    it("shows 'Price included' title when not hidden and has snapshot", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 100, hidePrice: false },
      });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "title",
        "Price included in calculations",
      );
    });

    it("shows 'Price hidden' title when hidden and has snapshot", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { chaosValue: 100, hidePrice: true },
      });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "title",
        "Price hidden from calculations",
      );
    });

    it("defaults hidePrice to false when priceInfo is undefined", () => {
      setupStore();
      const card = makeCardEntry({ exchangePrice: undefined });
      const ctx = createCellContext(card, card.name);
      render(<CurrentSessionHidePriceCell {...ctx} />);
      // hidePrice defaults to false → checked = !false = true
      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Ratio Column
// ═══════════════════════════════════════════════════════════════════════════

describe("CurrentSessionRatioColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createCurrentSessionRatioColumn", () => {
    it("creates a column with id 'ratio'", () => {
      const column = createCurrentSessionRatioColumn();
      expect(column.id).toBe("ratio");
    });

    it("renders a TableHeader with tooltip and 'Ratio' text", () => {
      const column = createCurrentSessionRatioColumn();
      const HeaderComponent = column.header as any;
      render(<HeaderComponent />);
      const header = screen.getByTestId("table-header");
      expect(header).toHaveTextContent("Ratio");
      expect(header).toHaveAttribute(
        "data-tooltip",
        "How often you've found this card compared to all other cards",
      );
    });
  });

  describe("CurrentSessionRatioCell", () => {
    it("renders the ratio percentage based on count and totalCount", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ totalCount: 100 })),
        },
      });
      const card = makeCardEntry({ count: 5 });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionRatioCell {...ctx} />);
      // (5 / 100) * 100 = 5.00%
      expect(screen.getByText("5.00%")).toBeInTheDocument();
    });

    it("renders ratio with high precision", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ totalCount: 300 })),
        },
      });
      const card = makeCardEntry({ count: 1 });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionRatioCell {...ctx} />);
      // (1 / 300) * 100 = 0.33%
      expect(screen.getByText("0.33%")).toBeInTheDocument();
    });

    it("defaults totalCount to 1 when session totalCount is 0", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ totalCount: 0 })),
        },
      });
      const card = makeCardEntry({ count: 5 });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionRatioCell {...ctx} />);
      // (5 / 1) * 100 = 500.00%
      expect(screen.getByText("500.00%")).toBeInTheDocument();
    });

    it("defaults totalCount to 1 when session is null", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => null),
        },
      });
      const card = makeCardEntry({ count: 3 });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionRatioCell {...ctx} />);
      // (3 / 1) * 100 = 300.00%
      expect(screen.getByText("300.00%")).toBeInTheDocument();
    });

    it("renders in a badge", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ totalCount: 50 })),
        },
      });
      const card = makeCardEntry({ count: 10 });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionRatioCell {...ctx} />);
      const badge = screen.getByText("20.00%").closest("div");
      expect(badge).toHaveClass("badge", "badge-soft");
    });

    it("handles count of 0 as 0.00%", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ totalCount: 100 })),
        },
      });
      const card = makeCardEntry({ count: 0 });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionRatioCell {...ctx} />);
      expect(screen.getByText("0.00%")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TotalValue Column
// ═══════════════════════════════════════════════════════════════════════════

describe("CurrentSessionTotalValueColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createCurrentSessionTotalValueColumn", () => {
    it("creates a column with id 'totalValue'", () => {
      const column = createCurrentSessionTotalValueColumn("exchange");
      expect(column.id).toBe("totalValue");
    });

    it("has sorting enabled", () => {
      const column = createCurrentSessionTotalValueColumn("exchange");
      expect(column.enableSorting).toBe(true);
    });

    it("renders a TableHeader with 'Total Value' text", () => {
      const column = createCurrentSessionTotalValueColumn("exchange");
      const HeaderComponent = column.header as any;
      render(<HeaderComponent />);
      expect(screen.getByTestId("table-header")).toHaveTextContent(
        "Total Value",
      );
    });

    describe("sortingFn (exchange)", () => {
      it("sorts by exchange totalValue ascending", () => {
        const column = createCurrentSessionTotalValueColumn("exchange");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(
          makeCardEntry({ exchangePrice: { totalValue: 1000 } }),
        );
        const rowB = createRow(
          makeCardEntry({ exchangePrice: { totalValue: 5000 } }),
        );
        expect(sortFn(rowA, rowB)).toBeLessThan(0);
      });

      it("returns 0 for equal values", () => {
        const column = createCurrentSessionTotalValueColumn("exchange");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(
          makeCardEntry({ exchangePrice: { totalValue: 3000 } }),
        );
        const rowB = createRow(
          makeCardEntry({ exchangePrice: { totalValue: 3000 } }),
        );
        expect(sortFn(rowA, rowB)).toBe(0);
      });

      it("defaults to 0 when exchangePrice is undefined", () => {
        const column = createCurrentSessionTotalValueColumn("exchange");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(makeCardEntry({ exchangePrice: undefined }));
        const rowB = createRow(
          makeCardEntry({ exchangePrice: { totalValue: 100 } }),
        );
        expect(sortFn(rowA, rowB)).toBeLessThan(0);
      });
    });

    describe("sortingFn (stash)", () => {
      it("sorts by stash totalValue ascending", () => {
        const column = createCurrentSessionTotalValueColumn("stash");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(
          makeCardEntry({ stashPrice: { totalValue: 8000 } }),
        );
        const rowB = createRow(
          makeCardEntry({ stashPrice: { totalValue: 2000 } }),
        );
        expect(sortFn(rowA, rowB)).toBeGreaterThan(0);
      });

      it("defaults to 0 when stashPrice is undefined", () => {
        const column = createCurrentSessionTotalValueColumn("stash");
        const sortFn = column.sortingFn as any;
        const rowA = createRow(makeCardEntry({ stashPrice: undefined }));
        const rowB = createRow(makeCardEntry({ stashPrice: undefined }));
        expect(sortFn(rowA, rowB)).toBe(0);
      });
    });
  });

  describe("CurrentSessionTotalValueCell", () => {
    it("renders formatted divine currency for exchange total value", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 4750, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      // 4750 >= 200 → 4750/200 = 23.75d
      expect(screen.getByText("23.75d")).toBeInTheDocument();
    });

    it("renders formatted chaos currency for small total values", () => {
      setupStore({
        currentSession: { getChaosToDivineRatio: vi.fn(() => 200) },
      });
      const card = makeCardEntry({
        exchangePrice: { totalValue: 50, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      expect(screen.getByText("50.00c")).toBeInTheDocument();
    });

    it("renders stash total value when source is stash", () => {
      setupStore({
        settings: { getActiveGameViewPriceSource: vi.fn(() => "stash") },
      });
      const card = makeCardEntry({
        stashPrice: { totalValue: 5000, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      // 5000 / 200 = 25.00d
      expect(screen.getByText("25.00d")).toBeInTheDocument();
    });

    it("renders N/A when totalValue is 0", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 0, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("renders N/A when priceInfo is undefined", () => {
      setupStore();
      const card = makeCardEntry({ exchangePrice: undefined });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("applies badge-success class when not hidden", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 1000, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      const badge = screen.getByText("5.00d").closest("div");
      expect(badge).toHaveClass("badge-success");
      expect(badge).not.toHaveClass("badge-warning");
      expect(badge).not.toHaveClass("opacity-50");
    });

    it("applies badge-warning and opacity-50 class when hidden", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 1000, hidePrice: true },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      // Text should include " (hidden)"
      const badge = screen.getByText(/5\.00d/).closest("div");
      expect(badge).toHaveClass("badge-warning");
      expect(badge).toHaveClass("opacity-50");
    });

    it("appends ' (hidden)' text when hidePrice is true", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 1000, hidePrice: true },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      expect(screen.getByText(/\(hidden\)/)).toBeInTheDocument();
    });

    it("does not append ' (hidden)' text when hidePrice is false", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 1000, hidePrice: false },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      expect(screen.queryByText(/\(hidden\)/)).not.toBeInTheDocument();
    });

    it("defaults hidePrice to false when priceInfo has no hidePrice field", () => {
      setupStore();
      const card = makeCardEntry({
        exchangePrice: { totalValue: 400, chaosValue: 80 },
      });
      const ctx = createCellContext(card, card.count);
      render(<CurrentSessionTotalValueCell {...ctx} />);
      const badge = screen.getByText("2.00d").closest("div");
      expect(badge).toHaveClass("badge-success");
      expect(badge).not.toHaveClass("opacity-50");
    });
  });
});
