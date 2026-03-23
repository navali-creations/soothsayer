import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Sub-component stubs ───────────────────────────────────────────────────

vi.mock("./PriceChangesRow", () => ({
  default: () => <div data-testid="price-changes-row" />,
}));

vi.mock("./PriceGrid", () => ({
  default: () => <div data-testid="price-grid" />,
}));

vi.mock("./PriceSummaryEmpty", () => ({
  default: () => <div data-testid="empty" />,
}));

vi.mock("./PriceSummaryError", () => ({
  default: ({ error }: { error: string }) => (
    <div data-testid="error">{error}</div>
  ),
}));

vi.mock("./PriceSummaryHeader", () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock("./PriceSummaryLoading", () => ({
  default: () => <div data-testid="loading" />,
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsPriceSummary from "./CardDetailsPriceSummary";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: Record<string, unknown> = {}) {
  return {
    cardDetails: {
      priceHistory: null,
      isLoadingPriceHistory: false,
      priceHistoryError: null,
      ...overrides,
    },
  };
}

function renderComponent(overrides: Record<string, unknown> = {}) {
  const mockState = createMockState(overrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  return renderWithProviders(<CardDetailsPriceSummary />);
}

const validPriceHistory = {
  cardName: "The Doctor",
  detailsId: "the-doctor",
  game: "poe1",
  league: "Settlers",
  currentDivineRate: 5.2,
  currentVolume: 12,
  chaosToDivineRatio: 0.00123,
  priceHistory: [],
  priceChanges: { change24h: 1.5, change7d: -3.2, change30d: 10.0 },
  fetchedAt: "2024-01-15T00:00:00Z",
  isFromCache: false,
};

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Loading state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPriceSummary — loading state", () => {
  it("renders PriceSummaryLoading when isLoadingPriceHistory is true", () => {
    renderComponent({ isLoadingPriceHistory: true });
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("does not render header, grid, or changes row when loading", () => {
    renderComponent({ isLoadingPriceHistory: true });
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("price-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("price-changes-row")).not.toBeInTheDocument();
  });

  it("does not render loading when isLoadingPriceHistory is false", () => {
    renderComponent({ isLoadingPriceHistory: false });
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Error state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPriceSummary — error state", () => {
  it("renders PriceSummaryError with message when priceHistoryError is set", () => {
    renderComponent({ priceHistoryError: "Failed to fetch prices" });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByText("Failed to fetch prices")).toBeInTheDocument();
  });

  it("does not render error when priceHistoryError is null", () => {
    renderComponent({ priceHistoryError: null });
    expect(screen.queryByTestId("error")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPriceSummary — empty state", () => {
  it("renders PriceSummaryEmpty when priceHistory is null and not loading/error", () => {
    renderComponent({ priceHistory: null });
    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("does not render empty when priceHistory exists", () => {
    renderComponent({ priceHistory: validPriceHistory });
    expect(screen.queryByTestId("empty")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Normal render
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPriceSummary — normal render", () => {
  it("renders header, grid, and changes row when priceHistory exists", () => {
    renderComponent({ priceHistory: validPriceHistory });
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("price-grid")).toBeInTheDocument();
    expect(screen.getByTestId("price-changes-row")).toBeInTheDocument();
  });

  it("does not render loading, error, or empty states when priceHistory exists", () => {
    renderComponent({ priceHistory: validPriceHistory });
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("empty")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// State priority
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPriceSummary — state priority", () => {
  it("prioritizes loading over error when both are set", () => {
    renderComponent({
      isLoadingPriceHistory: true,
      priceHistoryError: "Some error",
    });
    expect(screen.getByTestId("loading")).toBeInTheDocument();
    expect(screen.queryByTestId("error")).not.toBeInTheDocument();
  });

  it("prioritizes error over empty when error is set and priceHistory is null", () => {
    renderComponent({
      priceHistory: null,
      priceHistoryError: "Network error",
    });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.queryByTestId("empty")).not.toBeInTheDocument();
  });
});
