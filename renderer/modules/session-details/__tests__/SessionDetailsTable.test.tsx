import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SessionDetailsTable from "../SessionDetails.components/SessionDetailsTable/SessionDetailsTable";
import type { CardEntry } from "../SessionDetails.types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName, className }: any) => (
    <span data-testid={`card-name-link-${cardName}`} className={className}>
      {cardName}
    </span>
  ),
}));

vi.mock("~/renderer/hooks/usePopover", () => ({
  usePopover: () => ({
    triggerRef: { current: null },
    popoverRef: { current: null },
  }),
}));

vi.mock("~/renderer/components", () => ({
  DivinationCard: ({ card }: any) => (
    <div data-testid={`divination-card-${card.name}`} />
  ),
  Table: ({ data, columns }: any) => {
    // Render a simplified table to allow us to test column rendering
    return (
      <table data-testid="table" data-rows={data.length}>
        <thead>
          <tr>
            {columns.map((col: any, i: number) => {
              const header = col.header;
              const headerContent =
                typeof header === "function" ? header({}) : header;
              return (
                <th
                  key={col.id ?? col.accessorKey ?? i}
                  data-testid={`header-${col.id ?? col.accessorKey ?? i}`}
                >
                  {headerContent}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, rowIdx: number) => (
            <tr key={rowIdx} data-testid={`row-${rowIdx}`}>
              {columns.map((col: any, colIdx: number) => {
                const cellFn = col.cell;
                if (!cellFn)
                  return <td key={colIdx}>{row[col.accessorKey]}</td>;
                const value = col.accessorKey
                  ? row[col.accessorKey]
                  : col.accessorFn
                    ? col.accessorFn(row)
                    : undefined;
                const cellContext = {
                  getValue: () => value,
                  row: { original: row },
                };
                return (
                  <td
                    key={colIdx}
                    data-testid={`cell-${rowIdx}-${
                      col.id ?? col.accessorKey ?? colIdx
                    }`}
                  >
                    {typeof cellFn === "function" ? cellFn(cellContext) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

vi.mock("~/renderer/utils", () => ({
  formatCurrency: vi.fn((chaosValue: number, chaosToDivineRatio: number) => {
    if (Math.abs(chaosValue) >= chaosToDivineRatio && chaosToDivineRatio > 0) {
      return `${(chaosValue / chaosToDivineRatio).toFixed(2)}d`;
    }
    return `${chaosValue.toFixed(2)}c`;
  }),
}));

vi.mock("react-icons/fi", () => ({
  FiEye: (props: any) => <span data-testid="icon-eye" {...props} />,
  FiEyeOff: (props: any) => <span data-testid="icon-eye-off" {...props} />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockToggleCardPriceVisibility = vi.fn();

function createMockStore(overrides: any = {}) {
  return {
    sessionDetails: {
      toggleCardPriceVisibility: mockToggleCardPriceVisibility,
      ...overrides.sessionDetails,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function makeCardEntry(overrides: Partial<CardEntry> = {}): CardEntry {
  return {
    name: "The Doctor",
    count: 5,
    ratio: 10.0,
    chaosValue: 1200,
    totalValue: 6000,
    hidePrice: false,
    ...overrides,
  };
}

const defaultProps = {
  cardData: [
    makeCardEntry({
      name: "The Doctor",
      count: 5,
      ratio: 10.0,
      chaosValue: 1200,
      totalValue: 6000,
    }),
    makeCardEntry({
      name: "Rain of Chaos",
      count: 30,
      ratio: 60.0,
      chaosValue: 1,
      totalValue: 30,
    }),
  ],
  chaosToDivineRatio: 150,
  priceSource: "exchange" as const,
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Empty State ────────────────────────────────────────────────────────

  describe("empty state", () => {
    it('shows "No cards in this session" when cardData is empty', () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(screen.getByText("No cards in this session")).toBeInTheDocument();
    });

    it("does not render the table when cardData is empty", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(screen.queryByTestId("table")).not.toBeInTheDocument();
    });
  });

  // ── Header / Title ─────────────────────────────────────────────────────

  describe("header text", () => {
    it('renders "Cards Obtained" heading when cards exist', () => {
      setupStore();
      renderWithProviders(<SessionDetailsTable {...defaultProps} />);

      expect(screen.getByText("Cards Obtained")).toBeInTheDocument();
    });

    it('shows "Viewing Exchange prices (Snapshot)" when priceSource is exchange', () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable {...defaultProps} priceSource="exchange" />,
      );

      expect(
        screen.getByText("Viewing Exchange prices (Snapshot)"),
      ).toBeInTheDocument();
    });

    it('shows "Viewing Stash prices (Snapshot)" when priceSource is stash', () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable {...defaultProps} priceSource="stash" />,
      );

      expect(
        screen.getByText("Viewing Stash prices (Snapshot)"),
      ).toBeInTheDocument();
    });
  });

  // ── Table Rendering ────────────────────────────────────────────────────

  describe("table rendering", () => {
    it("renders table with correct number of rows", () => {
      setupStore();
      renderWithProviders(<SessionDetailsTable {...defaultProps} />);

      const table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();
      expect(table).toHaveAttribute("data-rows", "2");
    });

    it("renders card names via CardNameLink", () => {
      setupStore();
      renderWithProviders(<SessionDetailsTable {...defaultProps} />);

      expect(
        screen.getByTestId("card-name-link-The Doctor"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("card-name-link-Rain of Chaos"),
      ).toBeInTheDocument();
    });

    it("displays card count values", () => {
      setupStore();
      renderWithProviders(<SessionDetailsTable {...defaultProps} />);

      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();
    });

    it("displays ratio as percentage", () => {
      setupStore();
      renderWithProviders(<SessionDetailsTable {...defaultProps} />);

      expect(screen.getByText("10.00%")).toBeInTheDocument();
      expect(screen.getByText("60.00%")).toBeInTheDocument();
    });
  });

  // ── Visibility Toggle ──────────────────────────────────────────────────

  describe("visibility toggle", () => {
    it("renders eye icon for visible cards", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Doctor", hidePrice: false })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      const eyeIcons = screen.getAllByTestId("icon-eye");
      // At least one from the row (header also has one)
      expect(eyeIcons.length).toBeGreaterThanOrEqual(1);
    });

    it("renders eye-off icon for hidden cards", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Nurse", hidePrice: true })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(screen.getByTestId("icon-eye-off")).toBeInTheDocument();
    });

    it("calls toggleCardPriceVisibility with card name and priceSource on click", async () => {
      setupStore();
      const { user } = renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Doctor", hidePrice: false })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      // Find the toggle button in the row (not the header)
      const toggleButtons = screen.getAllByRole("button");
      const toggleButton = toggleButtons.find(
        (btn) =>
          btn.title === "Click to exclude from totals" ||
          btn.title === "Click to include in totals",
      );
      expect(toggleButton).toBeDefined();
      await user.click(toggleButton!);

      expect(mockToggleCardPriceVisibility).toHaveBeenCalledWith(
        "The Doctor",
        "exchange",
      );
    });

    it("calls toggleCardPriceVisibility with stash priceSource", async () => {
      setupStore();
      const { user } = renderWithProviders(
        <SessionDetailsTable
          cardData={[
            makeCardEntry({ name: "Rain of Chaos", hidePrice: false }),
          ]}
          chaosToDivineRatio={150}
          priceSource="stash"
        />,
      );

      const toggleButtons = screen.getAllByRole("button");
      const toggleButton = toggleButtons.find(
        (btn) =>
          btn.title === "Click to exclude from totals" ||
          btn.title === "Click to include in totals",
      );
      expect(toggleButton).toBeDefined();
      await user.click(toggleButton!);

      expect(mockToggleCardPriceVisibility).toHaveBeenCalledWith(
        "Rain of Chaos",
        "stash",
      );
    });

    it('toggle button has "Click to exclude from totals" title when visible', () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Doctor", hidePrice: false })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(
        screen.getByTitle("Click to exclude from totals"),
      ).toBeInTheDocument();
    });

    it('toggle button has "Click to include in totals" title when hidden', () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Doctor", hidePrice: true })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(
        screen.getByTitle("Click to include in totals"),
      ).toBeInTheDocument();
    });
  });

  // ── Hidden Card Styling ────────────────────────────────────────────────

  describe("hidden card styling", () => {
    it("applies opacity-40 class to hidden card name link", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Nurse", hidePrice: true })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      const cardLink = screen.getByTestId("card-name-link-The Nurse");
      expect(cardLink).toHaveClass("opacity-40");
    });

    it("shows Hidden badge on hidden cards", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Nurse", hidePrice: true })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(screen.getByText("Hidden")).toBeInTheDocument();
    });

    it("does not show Hidden badge on visible cards", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ name: "The Doctor", hidePrice: false })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
    });
  });

  // ── Value Formatting ───────────────────────────────────────────────────

  describe("value formatting", () => {
    it('displays "—" for zero chaos value', () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ chaosValue: 0, totalValue: 0 })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(2); // chaos and total value
    });

    it("formats non-zero values using formatCurrency", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ chaosValue: 1200, totalValue: 6000 })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      // 1200 / 150 = 8.00d
      expect(screen.getByText("8.00d")).toBeInTheDocument();
      // 6000 / 150 = 40.00d
      expect(screen.getByText("40.00d")).toBeInTheDocument();
    });

    it("formats small values in chaos", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[makeCardEntry({ chaosValue: 50, totalValue: 100 })]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(screen.getByText("50.00c")).toBeInTheDocument();
      expect(screen.getByText("100.00c")).toBeInTheDocument();
    });
  });

  // ── Card Popover ───────────────────────────────────────────────────────

  describe("card popover", () => {
    it("renders DivinationCard popover when divinationCard data exists", () => {
      setupStore();
      const cardWithDivCard = makeCardEntry({
        name: "The Doctor",
        divinationCard: {
          name: "The Doctor",
          stackSize: 8,
          artFilename: "TheDoctor",
          flavourText: "A doctor a day...",
          explicitModifiers: [{ text: "Headhunter" }],
        } as any,
      });

      renderWithProviders(
        <SessionDetailsTable
          cardData={[cardWithDivCard]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(
        screen.getByTestId("divination-card-The Doctor"),
      ).toBeInTheDocument();
    });

    it("does not render DivinationCard popover when divinationCard data is absent", () => {
      setupStore();
      renderWithProviders(
        <SessionDetailsTable
          cardData={[
            makeCardEntry({ name: "Unknown Card", divinationCard: undefined }),
          ]}
          chaosToDivineRatio={150}
          priceSource="exchange"
        />,
      );

      expect(
        screen.queryByTestId("divination-card-Unknown Card"),
      ).not.toBeInTheDocument();
    });
  });
});
