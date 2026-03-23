import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Sub-component stubs (for PriceChangesRow & PriceSummaryHeader) ────────

vi.mock("./PriceChangePill", () => ({
  default: ({
    label,
    change,
  }: {
    label: string;
    change: number | undefined;
  }) => (
    <div data-testid={`price-change-pill-${label}`} data-change={change}>
      {label}:{change !== undefined ? change : "n/a"}
    </div>
  ),
}));

vi.mock("./ConfidenceBadge", () => ({
  default: ({ confidence }: { confidence: number | null }) => (
    <div data-testid="confidence-badge" data-confidence={confidence} />
  ),
}));

// ─── Utils mock (for PriceSummaryHeader) ───────────────────────────────────

vi.mock("~/renderer/utils", async () => {
  const actual =
    await vi.importActual<typeof import("~/renderer/utils")>(
      "~/renderer/utils",
    );
  return {
    ...actual,
    formatRelativeTime: vi.fn(() => "5m ago"),
  };
});

// ─── Component imports (after all mocks) ───────────────────────────────────

import PriceChangesRow from "./PriceChangesRow";
import PriceGrid from "./PriceGrid";
import PriceSummaryEmpty from "./PriceSummaryEmpty";
import PriceSummaryError from "./PriceSummaryError";
import PriceSummaryHeader from "./PriceSummaryHeader";
import PriceSummaryLoading from "./PriceSummaryLoading";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceChangesRow
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceChangesRow", () => {
  function createMockState(
    priceChanges: {
      change24h?: number;
      change7d?: number;
      change30d?: number;
    } = {},
  ) {
    return {
      cardDetails: {
        getPriceChanges: () => priceChanges,
      },
    };
  }

  function renderComponent(
    priceChanges: {
      change24h?: number;
      change7d?: number;
      change30d?: number;
    } = {},
  ) {
    vi.mocked(useBoundStore).mockReturnValue(
      createMockState(priceChanges) as any,
    );
    return renderWithProviders(<PriceChangesRow />);
  }

  it("returns null when all price changes are undefined", () => {
    const { container } = renderComponent({});
    expect(container.innerHTML).toBe("");
  });

  it("renders when only change24h is defined", () => {
    renderComponent({ change24h: 2.5 });
    expect(screen.getByTestId("price-change-pill-24h")).toBeInTheDocument();
    expect(screen.getByTestId("price-change-pill-7d")).toBeInTheDocument();
    expect(screen.getByTestId("price-change-pill-30d")).toBeInTheDocument();
  });

  it("renders all three PriceChangePill components when all changes are defined", () => {
    renderComponent({ change24h: 1.5, change7d: -3.2, change30d: 10.0 });
    expect(screen.getByTestId("price-change-pill-24h")).toBeInTheDocument();
    expect(screen.getByTestId("price-change-pill-7d")).toBeInTheDocument();
    expect(screen.getByTestId("price-change-pill-30d")).toBeInTheDocument();
  });

  it("passes correct change props to each pill", () => {
    renderComponent({ change24h: 1.5, change7d: -3.2, change30d: 10.0 });
    expect(screen.getByTestId("price-change-pill-24h")).toHaveAttribute(
      "data-change",
      "1.5",
    );
    expect(screen.getByTestId("price-change-pill-7d")).toHaveAttribute(
      "data-change",
      "-3.2",
    );
    expect(screen.getByTestId("price-change-pill-30d")).toHaveAttribute(
      "data-change",
      "10",
    );
  });

  it("renders when only change30d is defined", () => {
    const { container } = renderComponent({ change30d: 5.0 });
    expect(container.innerHTML).not.toBe("");
    expect(screen.getByTestId("price-change-pill-30d")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceGrid
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceGrid", () => {
  function createMockState(
    overrides: {
      currentDivineRate?: number | null;
      currentVolume?: number | null;
      stackSize?: number | null;
      fullSetValue?: number | null;
      fullSetChaosValue?: number | null;
    } = {},
  ) {
    return {
      cardDetails: {
        card:
          overrides.stackSize !== undefined
            ? { stackSize: overrides.stackSize }
            : null,
        priceHistory:
          overrides.currentDivineRate !== undefined ||
          overrides.currentVolume !== undefined
            ? {
                currentDivineRate: overrides.currentDivineRate ?? null,
                currentVolume: overrides.currentVolume ?? null,
              }
            : null,
        getFullSetValue: () => overrides.fullSetValue ?? null,
        getFullSetChaosValue: () => overrides.fullSetChaosValue ?? null,
      },
    };
  }

  function renderComponent(
    overrides: {
      currentDivineRate?: number | null;
      currentVolume?: number | null;
      stackSize?: number | null;
      fullSetValue?: number | null;
      fullSetChaosValue?: number | null;
    } = {},
  ) {
    vi.mocked(useBoundStore).mockReturnValue(createMockState(overrides) as any);
    return renderWithProviders(<PriceGrid />);
  }

  it('renders "—" for Unit Price when currentDivineRate is null', () => {
    renderComponent({ currentDivineRate: null });
    expect(screen.getByText("Unit Price")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted divine rate when available", () => {
    renderComponent({ currentDivineRate: 5.2 });
    expect(screen.getByText("5.20 div")).toBeInTheDocument();
  });

  it('renders "—" for Trade Volume when currentVolume is null', () => {
    renderComponent({ currentVolume: null });
    expect(screen.getByText("Trade Volume")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders volume with toLocaleString when available", () => {
    renderComponent({ currentVolume: 1234 });
    expect(screen.getByText((1234).toLocaleString())).toBeInTheDocument();
  });

  it("shows full set value row when getFullSetValue returns non-null, including chaos equivalent", () => {
    renderComponent({
      stackSize: 8,
      fullSetValue: 41.6,
      fullSetChaosValue: 9500,
    });
    expect(screen.getByText("Full Set (8×)")).toBeInTheDocument();
    expect(screen.getByText(/41\.60 div/)).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) => content.includes("9,500") && content.includes("chaos"),
      ),
    ).toBeInTheDocument();
  });

  it("hides full set value row when getFullSetValue returns null", () => {
    renderComponent({ fullSetValue: null });
    expect(screen.queryByText(/Full Set/)).not.toBeInTheDocument();
  });

  it("shows stack size defaulting to 1 when card is null", () => {
    renderComponent({ fullSetValue: 10.0 });
    expect(screen.getByText("Full Set (1×)")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceSummaryEmpty
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceSummaryEmpty", () => {
  it('renders "Price Data" heading', () => {
    renderWithProviders(<PriceSummaryEmpty />);
    expect(screen.getByText("Price Data")).toBeInTheDocument();
  });

  it("renders the empty message text", () => {
    renderWithProviders(<PriceSummaryEmpty />);
    expect(
      screen.getByText("No price data available for this card."),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceSummaryError
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceSummaryError", () => {
  it('renders "Price Data" heading', () => {
    renderWithProviders(<PriceSummaryError error="Something went wrong" />);
    expect(screen.getByText("Price Data")).toBeInTheDocument();
  });

  it("renders the error prop text", () => {
    renderWithProviders(<PriceSummaryError error="Network request failed" />);
    expect(screen.getByText("Network request failed")).toBeInTheDocument();
  });

  it("renders an alert icon element", () => {
    const { container } = renderWithProviders(
      <PriceSummaryError error="Error" />,
    );
    // FiAlertCircle renders as an <svg> element
    const svgIcon = container.querySelector("svg");
    expect(svgIcon).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceSummaryHeader
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceSummaryHeader", () => {
  function createMockState(
    overrides: { isFromCache?: boolean; fetchedAt?: string | null } = {},
  ) {
    return {
      cardDetails: {
        priceHistory:
          overrides.isFromCache !== undefined ||
          overrides.fetchedAt !== undefined
            ? {
                isFromCache: overrides.isFromCache ?? false,
                fetchedAt: overrides.fetchedAt ?? null,
              }
            : null,
      },
    };
  }

  function renderComponent(
    overrides: { isFromCache?: boolean; fetchedAt?: string | null } = {},
  ) {
    vi.mocked(useBoundStore).mockReturnValue(createMockState(overrides) as any);
    return renderWithProviders(<PriceSummaryHeader />);
  }

  it('renders "Price Data" heading', () => {
    renderComponent();
    expect(screen.getByText("Price Data")).toBeInTheDocument();
  });

  it("renders ConfidenceBadge", () => {
    renderComponent();
    expect(screen.getByTestId("confidence-badge")).toBeInTheDocument();
  });

  it("shows cache badge when isFromCache is true and fetchedAt is set", () => {
    renderComponent({
      isFromCache: true,
      fetchedAt: "2024-01-15T00:00:00Z",
    });
    expect(screen.getByText(/Cached · 5m ago/)).toBeInTheDocument();
  });

  it("hides cache badge when isFromCache is false", () => {
    renderComponent({
      isFromCache: false,
      fetchedAt: "2024-01-15T00:00:00Z",
    });
    expect(screen.queryByText(/Cached/)).not.toBeInTheDocument();
  });

  it("hides cache badge when fetchedAt is null", () => {
    renderComponent({
      isFromCache: true,
      fetchedAt: null,
    });
    expect(screen.queryByText(/Cached/)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceSummaryLoading
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceSummaryLoading", () => {
  it('renders "Price Data" heading', () => {
    renderWithProviders(<PriceSummaryLoading />);
    expect(screen.getByText("Price Data")).toBeInTheDocument();
  });

  it('renders loading text "Loading price data…"', () => {
    renderWithProviders(<PriceSummaryLoading />);
    expect(screen.getByText("Loading price data…")).toBeInTheDocument();
  });
});
