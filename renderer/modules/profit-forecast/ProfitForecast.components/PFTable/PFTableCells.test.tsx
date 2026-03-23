import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { CardForecastRow } from "../../ProfitForecast.slice/ProfitForecast.slice";
import {
  formatPercent,
  formatPnLDivine,
} from "../../ProfitForecast.utils/ProfitForecast.utils";
import PFCardNameCell from "./PFCardNameColumn/PFCardNameCell";
import PFChanceCell from "./PFChanceColumn/PFChanceCell";
import PFExcludeCell from "./PFExcludeColumn/PFExcludeCell";
import PFPlAllDropsCell from "./PFPlAllDropsColumn/PFPlAllDropsCell";
import PFPlCardOnlyCell from "./PFPlCardOnlyColumn/PFPlCardOnlyCell";
import PFPriceCell from "./PFPriceColumn/PFPriceCell";
import PFStatusCell from "./PFStatusColumn/PFStatusCell";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName, className }: any) => (
    <span data-testid="card-name-link" className={className}>
      {cardName}
    </span>
  ),
}));

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid={`divination-card-${card.name}`}>{card.name}</div>
  ),
}));

vi.mock("~/renderer/hooks/usePopover/usePopover", () => ({
  usePopover: () => ({
    triggerRef: { current: null },
    popoverRef: { current: null },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  createLink: () => (props: any) => <a {...props} />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

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

/**
 * Build a minimal CellContext-like object that cell components consume.
 * Only the fields actually read by the components need to be present.
 */
function makeCellContext<TValue = unknown>(
  row: CardForecastRow,
  value?: TValue,
): any {
  return {
    row: { original: row },
    getValue: () => value,
    column: { id: "test-column" },
    cell: { id: "test-cell" },
    table: {},
    renderValue: () => value,
  };
}

function setupStore(overrides: any = {}) {
  const store = {
    profitForecast: {
      toggleCardExclusion: vi.fn(),
      chaosToDivineRatio: 200,
      ...overrides.profitForecast,
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── PFExcludeCell ─────────────────────────────────────────────────────────

describe("PFExcludeCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a checkbox for a row with a price", () => {
    setupStore();
    const row = makeRow();
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("returns null when hasPrice is false", () => {
    setupStore();
    const row = makeRow({ hasPrice: false });
    const { container } = renderWithProviders(
      <PFExcludeCell {...makeCellContext(row)} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("checkbox is checked when the card is included (excludeFromEv = false)", () => {
    setupStore();
    const row = makeRow({ excludeFromEv: false });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("checkbox is unchecked when the card is excluded (excludeFromEv = true)", () => {
    setupStore();
    const row = makeRow({ excludeFromEv: true });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls toggleCardExclusion with cardName on click", async () => {
    const store = setupStore();
    const row = makeRow({ cardName: "Rain of Chaos" });
    const { user } = renderWithProviders(
      <PFExcludeCell {...makeCellContext(row)} />,
    );

    await user.click(screen.getByRole("checkbox"));

    expect(store.profitForecast.toggleCardExclusion).toHaveBeenCalledWith(
      "Rain of Chaos",
    );
  });

  it("has checkbox-info class when userOverride is true", () => {
    setupStore();
    const row = makeRow({ userOverride: true });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toHaveClass("checkbox-info");
  });

  it("does not have checkbox-info class when userOverride is false", () => {
    setupStore();
    const row = makeRow({ userOverride: false });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).not.toHaveClass("checkbox-info");
  });

  it("title: manually included when userOverride + autoExcluded (anomalous)", () => {
    setupStore();
    const row = makeRow({ userOverride: true, isAnomalous: true });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "title",
      "Manually included — auto-detection would exclude this card. Click to revert",
    );
  });

  it("title: manually included when userOverride + autoExcluded (low confidence)", () => {
    setupStore();
    const row = makeRow({ userOverride: true, confidence: 3 });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "title",
      "Manually included — auto-detection would exclude this card. Click to revert",
    );
  });

  it("title: manually excluded when userOverride + normal card", () => {
    setupStore();
    const row = makeRow({
      userOverride: true,
      isAnomalous: false,
      confidence: 1,
    });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "title",
      "Manually excluded from EV calculations. Click to revert",
    );
  });

  it("title: auto-excluded when not userOverride and autoExcluded", () => {
    setupStore();
    const row = makeRow({
      userOverride: false,
      isAnomalous: true,
    });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "title",
      "Auto-excluded — click to override and include in EV calculations",
    );
  });

  it("title: included when not userOverride and not autoExcluded", () => {
    setupStore();
    const row = makeRow({
      userOverride: false,
      isAnomalous: false,
      confidence: 1,
    });
    renderWithProviders(<PFExcludeCell {...makeCellContext(row)} />);

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "title",
      "Included in EV calculations — click to exclude",
    );
  });
});

// ─── PFStatusCell ──────────────────────────────────────────────────────────

describe("PFStatusCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders info icon (check-circle) when userOverride + auto-excluded (anomalous)", () => {
    const row = makeRow({ userOverride: true, isAnomalous: true });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    // FiCheckCircle renders as an SVG; tooltip has tooltip-info class
    const tooltip = container.querySelector(".tooltip-info");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      "data-tip",
      "Manually included — auto-detection flagged anomalous price",
    );
  });

  it("renders info icon when userOverride + auto-excluded (low confidence)", () => {
    const row = makeRow({ userOverride: true, confidence: 3 });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    const tooltip = container.querySelector(".tooltip-info");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      "data-tip",
      "Manually included — auto-detection flagged low confidence price",
    );
  });

  it("renders eye-off icon when userOverride on a normal card", () => {
    const row = makeRow({
      userOverride: true,
      isAnomalous: false,
      confidence: 1,
    });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    const tooltip = container.querySelector(".tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      "data-tip",
      "Manually excluded from EV calculations",
    );
  });

  it("renders error octagon icon when card is anomalous (no override)", () => {
    const row = makeRow({ isAnomalous: true, userOverride: false });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    const tooltip = container.querySelector(".tooltip-error");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      "data-tip",
      "Excluded from EV — price is unusually high for a common card",
    );
  });

  it("renders warning triangle icon when confidence is 3 (no override)", () => {
    const row = makeRow({
      confidence: 3,
      isAnomalous: false,
      userOverride: false,
    });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    const tooltip = container.querySelector(".tooltip-warning");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      "data-tip",
      "Excluded from EV — low confidence price",
    );
  });

  it("returns null for a normal, non-overridden card", () => {
    const row = makeRow({
      isAnomalous: false,
      confidence: 1,
      userOverride: false,
    });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("returns null when confidence is 2 and not anomalous, no override", () => {
    const row = makeRow({
      isAnomalous: false,
      confidence: 2,
      userOverride: false,
    });
    const { container } = renderWithProviders(
      <PFStatusCell {...makeCellContext(row)} />,
    );

    expect(container.innerHTML).toBe("");
  });
});

// ─── PFCardNameCell ────────────────────────────────────────────────────────

describe("PFCardNameCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders CardNameLink with the card name", () => {
    renderWithProviders(<PFCardNameCell cardName="The Doctor" />);

    const link = screen.getByTestId("card-name-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("The Doctor");
  });

  it("renders without popover when cardMetadata is null", () => {
    const { container } = renderWithProviders(
      <PFCardNameCell cardName="The Doctor" cardMetadata={null} />,
    );

    // No popover element should be present
    expect(container.querySelector("[popover]")).not.toBeInTheDocument();
  });

  it("renders with popover when cardMetadata is provided", () => {
    const metadata = {
      artSrc: "https://example.com/art.png",
      rarity: "unique" as const,
      stackSize: 8,
      rewardText: "A Headhunter",
    };
    const { container } = renderWithProviders(
      <PFCardNameCell cardName="The Doctor" cardMetadata={metadata as any} />,
    );

    // Popover element should be present
    expect(container.querySelector("[popover]")).toBeInTheDocument();
  });

  it("shows 'filtered' badge when belowMinPrice is true", () => {
    renderWithProviders(
      <PFCardNameCell cardName="The Doctor" belowMinPrice={true} />,
    );

    expect(screen.getByText("filtered")).toBeInTheDocument();
  });

  it("does not show 'filtered' badge when belowMinPrice is false", () => {
    renderWithProviders(
      <PFCardNameCell cardName="The Doctor" belowMinPrice={false} />,
    );

    expect(screen.queryByText("filtered")).not.toBeInTheDocument();
  });

  it("does not show 'filtered' badge when belowMinPrice is undefined", () => {
    renderWithProviders(<PFCardNameCell cardName="The Doctor" />);

    expect(screen.queryByText("filtered")).not.toBeInTheDocument();
  });
});

// ─── PFPriceCell ───────────────────────────────────────────────────────────

describe("PFPriceCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders chaos value when divineValue < 1", () => {
    const row = makeRow({ chaosValue: 5.3, divineValue: 0.03 });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    expect(screen.getByText("5.3 c")).toBeInTheDocument();
  });

  it("renders divine value when divineValue >= 1", () => {
    const row = makeRow({ chaosValue: 50000, divineValue: 250 });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    expect(screen.getByText("250.00 d")).toBeInTheDocument();
  });

  it("renders a dash when hasPrice is false", () => {
    const row = makeRow({ hasPrice: false });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("has dimmed class when excludeFromEv is true", () => {
    const row = makeRow({ excludeFromEv: true, divineValue: 5.0 });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    const span = screen.getByText("5.00 d");
    expect(span).toHaveClass("text-base-content/50");
  });

  it("does not have dimmed class when excludeFromEv is false", () => {
    const row = makeRow({ excludeFromEv: false, divineValue: 5.0 });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    const span = screen.getByText("5.00 d");
    expect(span).not.toHaveClass("text-base-content/50");
  });

  it("shows chaos format with one decimal", () => {
    const row = makeRow({ chaosValue: 12.75, divineValue: 0.05 });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    expect(screen.getByText("12.8 c")).toBeInTheDocument();
  });

  it("shows divine format with two decimals", () => {
    const row = makeRow({ chaosValue: 1000, divineValue: 5.123 });
    renderWithProviders(
      <PFPriceCell {...makeCellContext(row, row.chaosValue)} />,
    );

    expect(screen.getByText("5.12 d")).toBeInTheDocument();
  });
});

// ─── PFChanceCell ──────────────────────────────────────────────────────────

describe("PFChanceCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the formatted percentage", () => {
    const row = makeRow({ chanceInBatch: 0.5 });
    renderWithProviders(
      <PFChanceCell {...makeCellContext(row, row.chanceInBatch)} />,
    );

    expect(screen.getByText(formatPercent(0.5, 2))).toBeInTheDocument();
    expect(screen.getByText("50.00%")).toBeInTheDocument();
  });

  it("renders small percentages correctly", () => {
    const row = makeRow({ chanceInBatch: 0.00312 });
    renderWithProviders(
      <PFChanceCell {...makeCellContext(row, row.chanceInBatch)} />,
    );

    expect(screen.getByText("0.31%")).toBeInTheDocument();
  });

  it("renders 0% when chance is 0", () => {
    const row = makeRow({ chanceInBatch: 0 });
    renderWithProviders(
      <PFChanceCell {...makeCellContext(row, row.chanceInBatch)} />,
    );

    expect(screen.getByText("0.00%")).toBeInTheDocument();
  });

  it("renders 100% when chance is 1", () => {
    const row = makeRow({ chanceInBatch: 1 });
    renderWithProviders(
      <PFChanceCell {...makeCellContext(row, row.chanceInBatch)} />,
    );

    expect(screen.getByText("100.00%")).toBeInTheDocument();
  });

  it("has font-mono class", () => {
    const row = makeRow({ chanceInBatch: 0.5 });
    renderWithProviders(
      <PFChanceCell {...makeCellContext(row, row.chanceInBatch)} />,
    );

    expect(screen.getByText("50.00%")).toHaveClass("font-mono");
  });
});

// ─── PFPlCardOnlyCell ──────────────────────────────────────────────────────

describe("PFPlCardOnlyCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders formatted P&L divine value for positive value", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    // plA = 10000 chaos → 10000/200 = 50 divine → "+50.00 d" (< 100 → .toFixed(2))
    // Wait, 50 >= 100 is false, so "+50.00 d"
    renderWithProviders(
      <PFPlCardOnlyCell {...makeCellContext(row, row.plA)} />,
    );

    const expected = formatPnLDivine(10000, 200);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders green color for positive value when not excluded", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({
      hasPrice: true,
      excludeFromEv: false,
      plA: 5000,
    });
    renderWithProviders(<PFPlCardOnlyCell {...makeCellContext(row, 5000)} />);

    const text = screen.getByText(formatPnLDivine(5000, 200));
    expect(text).toHaveClass("text-success");
  });

  it("renders red color for negative value when not excluded", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({
      hasPrice: true,
      excludeFromEv: false,
    });
    renderWithProviders(<PFPlCardOnlyCell {...makeCellContext(row, -5000)} />);

    const text = screen.getByText(formatPnLDivine(-5000, 200));
    expect(text).toHaveClass("text-error");
  });

  it("renders dimmed when excludeFromEv is true", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({
      hasPrice: true,
      excludeFromEv: true,
    });
    renderWithProviders(<PFPlCardOnlyCell {...makeCellContext(row, 5000)} />);

    const text = screen.getByText(formatPnLDivine(5000, 200));
    expect(text).toHaveClass("text-base-content/50");
    expect(text).not.toHaveClass("text-success");
    expect(text).not.toHaveClass("text-error");
  });

  it("renders dash when hasPrice is false", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: false });
    renderWithProviders(<PFPlCardOnlyCell {...makeCellContext(row, 0)} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders green for zero value (value >= 0)", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    renderWithProviders(<PFPlCardOnlyCell {...makeCellContext(row, 0)} />);

    const text = screen.getByText(formatPnLDivine(0, 200));
    expect(text).toHaveClass("text-success");
  });
});

// ─── PFPlAllDropsCell ──────────────────────────────────────────────────────

describe("PFPlAllDropsCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders formatted P&L divine value for positive value", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    renderWithProviders(
      <PFPlAllDropsCell {...makeCellContext(row, row.plB)} />,
    );

    const expected = formatPnLDivine(12000, 200);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders green color for positive value when not excluded", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    renderWithProviders(<PFPlAllDropsCell {...makeCellContext(row, 8000)} />);

    const text = screen.getByText(formatPnLDivine(8000, 200));
    expect(text).toHaveClass("text-success");
  });

  it("renders red color for negative value when not excluded", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    renderWithProviders(<PFPlAllDropsCell {...makeCellContext(row, -3000)} />);

    const text = screen.getByText(formatPnLDivine(-3000, 200));
    expect(text).toHaveClass("text-error");
  });

  it("renders dimmed when excludeFromEv is true", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: true });
    renderWithProviders(<PFPlAllDropsCell {...makeCellContext(row, 8000)} />);

    const text = screen.getByText(formatPnLDivine(8000, 200));
    expect(text).toHaveClass("text-base-content/50");
    expect(text).not.toHaveClass("text-success");
  });

  it("renders dash when hasPrice is false", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: false });
    renderWithProviders(<PFPlAllDropsCell {...makeCellContext(row, 0)} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders green for zero value (value >= 0)", () => {
    setupStore({ profitForecast: { chaosToDivineRatio: 200 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    renderWithProviders(<PFPlAllDropsCell {...makeCellContext(row, 0)} />);

    const text = screen.getByText(formatPnLDivine(0, 200));
    expect(text).toHaveClass("text-success");
  });

  it("uses chaosToDivineRatio from the store for formatting", () => {
    // Use a different ratio to confirm it reads from store
    setupStore({ profitForecast: { chaosToDivineRatio: 100 } });
    const row = makeRow({ hasPrice: true, excludeFromEv: false });
    renderWithProviders(<PFPlAllDropsCell {...makeCellContext(row, 5000)} />);

    // 5000 / 100 = 50 divine → "+50.00 d"
    const expected = formatPnLDivine(5000, 100);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
