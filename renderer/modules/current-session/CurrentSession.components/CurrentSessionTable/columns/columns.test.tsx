import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanup,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
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

import CurrentSessionChaosValueCell from "../CurrentSessionChaosValueColumn/CurrentSessionChaosValueCell";
import { createCurrentSessionChaosValueColumn } from "../CurrentSessionChaosValueColumn/createCurrentSessionChaosValueColumn";
import CurrentSessionHidePriceCell from "../CurrentSessionHidePriceColumn/CurrentSessionHidePriceCell";
import { createCurrentSessionHidePriceColumn } from "../CurrentSessionHidePriceColumn/createCurrentSessionHidePriceColumn";
import CurrentSessionRatioCell from "../CurrentSessionRatioColumn/CurrentSessionRatioCell";
import { createCurrentSessionRatioColumn } from "../CurrentSessionRatioColumn/createCurrentSessionRatioColumn";
import CurrentSessionTotalValueCell from "../CurrentSessionTotalValueColumn/CurrentSessionTotalValueCell";
import { createCurrentSessionTotalValueColumn } from "../CurrentSessionTotalValueColumn/createCurrentSessionTotalValueColumn";

function setupStore(overrides: any = {}) {
  const store = {
    currentSession: {
      getChaosToDivineRatio: vi.fn(() => 200),
      getSession: vi.fn(() => ({
        totalCount: 100,
        priceSnapshot: { timestamp: "2024-01-01" },
      })),
      toggleCardPriceVisibility: vi.fn(),
      ...overrides.currentSession,
    },
    settings: {
      ...overrides.settings,
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

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

function createRow(original: Record<string, any>) {
  return { original } as any;
}

function makeCardEntry(overrides: Record<string, any> = {}) {
  return {
    name: "The Doctor",
    count: 5,
    price: {
      chaosValue: 950,
      divineValue: 4.75,
      totalValue: 4750,
      hidePrice: false,
    },
    ...overrides,
  };
}

describe("CurrentSessionChaosValueColumn", () => {
  beforeEach(() => {
    setupStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe("createCurrentSessionChaosValueColumn", () => {
    it("creates a column with id 'chaosValue'", () => {
      const column = createCurrentSessionChaosValueColumn();

      expect(column.id).toBe("chaosValue");
    });

    it("has sorting enabled", () => {
      const column = createCurrentSessionChaosValueColumn();

      expect(column.enableSorting).toBe(true);
    });

    it("renders a TableHeader with 'Value (Each)' text", () => {
      const column = createCurrentSessionChaosValueColumn();

      renderWithProviders((column as any).header({}));

      expect(screen.getByTestId("table-header")).toHaveTextContent(
        "Value (Each)",
      );
    });

    it("sorts by chaosValue ascending", () => {
      const column = createCurrentSessionChaosValueColumn();
      const sortingFn = (column as any).sortingFn;

      expect(
        sortingFn(
          createRow(makeCardEntry({ price: { chaosValue: 100 } })),
          createRow(makeCardEntry({ price: { chaosValue: 200 } })),
        ),
      ).toBe(-100);
    });

    it("sorts equal chaos values as 0", () => {
      const column = createCurrentSessionChaosValueColumn();
      const sortingFn = (column as any).sortingFn;

      expect(
        sortingFn(
          createRow(makeCardEntry({ price: { chaosValue: 100 } })),
          createRow(makeCardEntry({ price: { chaosValue: 100 } })),
        ),
      ).toBe(0);
    });

    it("handles missing price by defaulting chaosValue to 0", () => {
      const column = createCurrentSessionChaosValueColumn();
      const sortingFn = (column as any).sortingFn;

      expect(
        sortingFn(
          createRow(makeCardEntry({ price: undefined })),
          createRow(makeCardEntry({ price: { chaosValue: 50 } })),
        ),
      ).toBe(-50);
    });
  });

  describe("CurrentSessionChaosValueCell", () => {
    it("renders formatted divine currency for large values", () => {
      renderWithProviders(
        <CurrentSessionChaosValueCell
          {...createCellContext(makeCardEntry({ price: { chaosValue: 950 } }))}
        />,
      );

      expect(screen.getByText("4.75d")).toBeInTheDocument();
    });

    it("renders chaos format for small values", () => {
      renderWithProviders(
        <CurrentSessionChaosValueCell
          {...createCellContext(makeCardEntry({ price: { chaosValue: 50 } }))}
        />,
      );

      expect(screen.getByText("50.00c")).toBeInTheDocument();
    });

    it("renders N/A when chaosValue is 0", () => {
      renderWithProviders(
        <CurrentSessionChaosValueCell
          {...createCellContext(makeCardEntry({ price: { chaosValue: 0 } }))}
        />,
      );

      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("renders N/A when price is undefined", () => {
      renderWithProviders(
        <CurrentSessionChaosValueCell
          {...createCellContext(makeCardEntry({ price: undefined }))}
        />,
      );

      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("applies opacity-50 class when hidePrice is true", () => {
      renderWithProviders(
        <CurrentSessionChaosValueCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 500, hidePrice: true } }),
          )}
        />,
      );

      expect(screen.getByText("2.50d")).toHaveClass("opacity-50");
    });

    it("does not apply opacity-50 class when hidePrice is false", () => {
      renderWithProviders(
        <CurrentSessionChaosValueCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 500, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByText("2.50d")).not.toHaveClass("opacity-50");
    });
  });
});

describe("CurrentSessionHidePriceColumn", () => {
  beforeEach(() => {
    setupStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
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

      renderWithProviders((column as any).header({}));

      expect(screen.getByTestId("fi-eye")).toBeInTheDocument();
      expect(screen.getByTestId("table-header")).toHaveAttribute(
        "data-tooltip",
        "Hide anomalous prices from total calculations",
      );
      expect(screen.getByTestId("table-header")).toHaveClass(
        "flex",
        "w-full",
        "justify-center",
        "pl-1",
      );
    });
  });

  describe("CurrentSessionHidePriceCell", () => {
    it("renders a checkbox that is checked when hidePrice is false", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("renders a checkbox that is unchecked when hidePrice is true", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: true } }),
          )}
        />,
      );

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("calls toggleCardPriceVisibility on change", async () => {
      const store = setupStore();

      const { user } = renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: false } }),
            "The Doctor",
          )}
        />,
      );

      await user.click(screen.getByRole("checkbox"));

      expect(
        store.currentSession.toggleCardPriceVisibility,
      ).toHaveBeenCalledWith("The Doctor");
    });

    it("disables checkbox when session has no price snapshot", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ priceSnapshot: null })),
        },
      });

      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("disables checkbox when price is undefined", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(makeCardEntry({ price: undefined }))}
        />,
      );

      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("enables checkbox when session has a snapshot and price", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByRole("checkbox")).toBeEnabled();
    });

    it("shows correct title when no snapshot disables price visibility", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({ priceSnapshot: null })),
        },
      });

      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(makeCardEntry({ price: undefined }))}
        />,
      );

      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "title",
        "Price visibility can only be changed when using snapshot prices",
      );
    });

    it("shows 'Price included' title when not hidden and has snapshot", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "title",
        "Price included in calculations",
      );
    });

    it("shows 'Price hidden' title when hidden and has snapshot", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(
            makeCardEntry({ price: { chaosValue: 100, hidePrice: true } }),
          )}
        />,
      );

      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "title",
        "Price hidden from calculations",
      );
    });

    it("defaults hidePrice to false when price has no hidePrice field", () => {
      renderWithProviders(
        <CurrentSessionHidePriceCell
          {...createCellContext(makeCardEntry({ price: { chaosValue: 100 } }))}
        />,
      );

      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });
});

describe("CurrentSessionRatioColumn", () => {
  beforeEach(() => {
    setupStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe("createCurrentSessionRatioColumn", () => {
    it("creates a column with id 'ratio'", () => {
      const column = createCurrentSessionRatioColumn();

      expect(column.id).toBe("ratio");
    });

    it("renders a TableHeader with tooltip and 'Ratio' text", () => {
      const column = createCurrentSessionRatioColumn();

      renderWithProviders((column as any).header({}));

      expect(screen.getByTestId("table-header")).toHaveTextContent("Ratio");
      expect(screen.getByTestId("table-header")).toHaveAttribute(
        "data-tooltip",
        "How often you've found this card compared to all other cards",
      );
    });
  });

  describe("CurrentSessionRatioCell", () => {
    it("renders the ratio percentage based on count and totalCount", () => {
      renderWithProviders(
        <CurrentSessionRatioCell {...createCellContext(makeCardEntry())} />,
      );

      expect(screen.getByText("5.00%")).toBeInTheDocument();
    });

    it("renders ratio with high precision", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({
            totalCount: 3,
            priceSnapshot: { timestamp: "2024-01-01" },
          })),
        },
      });

      renderWithProviders(
        <CurrentSessionRatioCell
          {...createCellContext(makeCardEntry({ count: 1 }))}
        />,
      );

      expect(screen.getByText("33.33%")).toBeInTheDocument();
    });

    it("defaults totalCount to 1 when session totalCount is 0", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => ({
            totalCount: 0,
            priceSnapshot: { timestamp: "2024-01-01" },
          })),
        },
      });

      renderWithProviders(
        <CurrentSessionRatioCell
          {...createCellContext(makeCardEntry({ count: 0 }))}
        />,
      );

      expect(screen.getByText("0.00%")).toBeInTheDocument();
    });

    it("defaults totalCount to 1 when session is null", () => {
      setupStore({
        currentSession: {
          getSession: vi.fn(() => null),
        },
      });

      renderWithProviders(
        <CurrentSessionRatioCell
          {...createCellContext(makeCardEntry({ count: 1 }))}
        />,
      );

      expect(screen.getByText("100.00%")).toBeInTheDocument();
    });

    it("renders in a badge", () => {
      renderWithProviders(
        <CurrentSessionRatioCell {...createCellContext(makeCardEntry())} />,
      );

      expect(screen.getByText("5.00%")).toHaveClass("badge", "badge-soft");
    });

    it("handles count of 0 as 0.00%", () => {
      renderWithProviders(
        <CurrentSessionRatioCell
          {...createCellContext(makeCardEntry({ count: 0 }))}
        />,
      );

      expect(screen.getByText("0.00%")).toBeInTheDocument();
    });
  });
});

describe("CurrentSessionTotalValueColumn", () => {
  beforeEach(() => {
    setupStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe("createCurrentSessionTotalValueColumn", () => {
    it("creates a column with id 'totalValue'", () => {
      const column = createCurrentSessionTotalValueColumn();

      expect(column.id).toBe("totalValue");
    });

    it("has sorting enabled", () => {
      const column = createCurrentSessionTotalValueColumn();

      expect(column.enableSorting).toBe(true);
    });

    it("renders a TableHeader with 'Total Value' text", () => {
      const column = createCurrentSessionTotalValueColumn();

      renderWithProviders((column as any).header({}));

      expect(screen.getByTestId("table-header")).toHaveTextContent(
        "Total Value",
      );
    });

    it("sorts by totalValue ascending", () => {
      const column = createCurrentSessionTotalValueColumn();
      const sortingFn = (column as any).sortingFn;

      expect(
        sortingFn(
          createRow(makeCardEntry({ price: { totalValue: 1000 } })),
          createRow(makeCardEntry({ price: { totalValue: 5000 } })),
        ),
      ).toBe(-4000);
    });

    it("returns 0 for equal total values", () => {
      const column = createCurrentSessionTotalValueColumn();
      const sortingFn = (column as any).sortingFn;

      expect(
        sortingFn(
          createRow(makeCardEntry({ price: { totalValue: 3000 } })),
          createRow(makeCardEntry({ price: { totalValue: 3000 } })),
        ),
      ).toBe(0);
    });

    it("defaults to 0 when price is undefined", () => {
      const column = createCurrentSessionTotalValueColumn();
      const sortingFn = (column as any).sortingFn;

      expect(
        sortingFn(
          createRow(makeCardEntry({ price: undefined })),
          createRow(makeCardEntry({ price: { totalValue: 100 } })),
        ),
      ).toBe(-100);
    });
  });

  describe("CurrentSessionTotalValueCell", () => {
    it("renders formatted divine currency for total value", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 4750, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByText("23.75d")).toBeInTheDocument();
    });

    it("renders formatted chaos currency for small total values", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 50, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByText("50.00c")).toBeInTheDocument();
    });

    it("renders N/A when totalValue is 0", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 0, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("renders N/A when price is undefined", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(makeCardEntry({ price: undefined }))}
        />,
      );

      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("applies badge-success class when not hidden", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 1000, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByText("5.00d")).toHaveClass("badge-success");
    });

    it("applies badge-warning and opacity-50 class when hidden", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 1000, hidePrice: true } }),
          )}
        />,
      );

      expect(screen.getByText(/hidden/)).toHaveClass(
        "badge-warning",
        "opacity-50",
      );
    });

    it("appends ' (hidden)' text when hidePrice is true", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 1000, hidePrice: true } }),
          )}
        />,
      );

      expect(screen.getByText("5.00d (hidden)")).toBeInTheDocument();
    });

    it("does not append ' (hidden)' text when hidePrice is false", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 1000, hidePrice: false } }),
          )}
        />,
      );

      expect(screen.getByText("5.00d")).toBeInTheDocument();
      expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
    });

    it("defaults hidePrice to false when price has no hidePrice field", () => {
      renderWithProviders(
        <CurrentSessionTotalValueCell
          {...createCellContext(
            makeCardEntry({ price: { totalValue: 400, chaosValue: 80 } }),
          )}
        />,
      );

      expect(screen.getByText("2.00d")).toHaveClass("badge-success");
      expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
    });
  });
});
