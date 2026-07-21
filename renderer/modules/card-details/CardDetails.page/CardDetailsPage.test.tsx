import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useSettings } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useSettings: vi.fn(),
}));

// ─── Router mock ───────────────────────────────────────────────────────────

const { mockUseParams } = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ cardSlug: "test-card" })),
}));

vi.mock("@tanstack/react-router", async () => {
  const { createRouterMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createRouterMock({ useParamsReturn: mockUseParams });
});

// ─── Child component stubs ─────────────────────────────────────────────────

vi.mock("../CardDetails.components/CardDetailsError", () => ({
  default: ({ error }: any) => (
    <div data-testid="error">{error ?? "Card not found"}</div>
  ),
}));

vi.mock(
  "../CardDetails.components/CardDetailsExternalLinks/CardDetailsExternalLinks",
  () => ({
    CardDetailsExternalLinks: () => <div data-testid="external-links" />,
  }),
);

vi.mock("../CardDetails.components/CardDetailsHeader", () => ({
  default: (props: any) => <div data-testid="header">{props.cardName}</div>,
}));

vi.mock("../CardDetails.components/CardDetailsLoading", () => ({
  default: () => <div data-testid="loading" />,
}));

vi.mock("../CardDetails.components/CardDetailsRelatedCards", () => ({
  default: () => <div data-testid="related-cards" />,
}));

vi.mock("../CardDetails.components/CardDetailsVisual", () => ({
  default: () => <div data-testid="visual" />,
}));

vi.mock("../CardDetails.components/MarketTabContent", () => ({
  default: () => <div data-testid="market-tab" />,
}));

vi.mock("../CardDetails.components/YourDataTabContent", () => ({
  default: (props: any) => (
    <div
      data-testid="your-data-tab"
      data-loading={String(props.isLoading)}
      data-card-name={props.cardName}
      data-game={props.game}
    />
  ),
}));

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, actions }: any) => (
        <div data-testid="page-header">
          {title}
          {actions}
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsPage from "./CardDetails.page";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockSlices(overrides: Record<string, any> = {}) {
  const settings = {
    getSelectedGame: vi.fn(() => "poe1"),
    getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
    ...overrides.settings,
  };

  const cardDetails = {
    card: {
      name: "Test Card",
      id: 1,
      stackSize: 5,
      description: "test",
      rewardHtml: "<p>R</p>",
      artSrc: "art.png",
      flavourHtml: "",
      rarity: 3,
      filterRarity: 3,
      fromBoss: false,
      isDisabled: false,
      inPool: true,
    },
    isLoadingCard: false,
    cardError: null,
    initializeCardDetails: vi.fn(),
    fetchCommunityDropRate: vi.fn(),
    fetchPriceHistory: vi.fn(),
    clearCardDetails: vi.fn(),
    isLoadingPersonalAnalytics: false,
    selectedLeague: "all",
    setSelectedLeague: vi.fn(),
    activeTab: "market",
    getDisplayRarity: vi.fn(() => 3),
    ...overrides.cardDetails,
  };

  return { settings, cardDetails };
}

function renderPage(overrides: Record<string, any> = {}) {
  const mockSlices = createMockSlices(overrides);
  vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
  vi.mocked(useCardDetails).mockReturnValue(mockSlices.cardDetails as any);
  const result = renderWithProviders(<CardDetailsPage />);
  return { ...result, mockSlices };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
  mockUseParams.mockReturnValue({ cardSlug: "test-card" });
});

// ═══════════════════════════════════════════════════════════════════════════
// Loading state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPage — loading state", () => {
  it("renders CardDetailsLoading when isLoadingCard is true", () => {
    renderPage({ cardDetails: { isLoadingCard: true } });
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("does not render main content when loading", () => {
    renderPage({ cardDetails: { isLoadingCard: true } });
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("visual")).not.toBeInTheDocument();
    expect(screen.queryByTestId("market-tab")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Error state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPage — error state", () => {
  it("renders CardDetailsError when cardError is set", () => {
    renderPage({ cardDetails: { cardError: "Something went wrong" } });
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders CardDetailsError when card is null", () => {
    renderPage({ cardDetails: { card: null } });
    expect(screen.getByTestId("error")).toBeInTheDocument();
  });

  it("renders CardDetailsError when both cardError is set and card is null", () => {
    renderPage({
      cardDetails: { cardError: "Missing card", card: null },
    });
    expect(screen.getByTestId("error")).toHaveTextContent("Missing card");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Normal render
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPage — normal render", () => {
  it("renders CardDetailsHeader with card name", () => {
    renderPage();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByText("Test Card")).toBeInTheDocument();
  });

  it("renders CardDetailsVisual", () => {
    renderPage();
    expect(screen.getByTestId("visual")).toBeInTheDocument();
  });

  it("renders CardDetailsExternalLinks", () => {
    renderPage();
    expect(screen.getByTestId("external-links")).toBeInTheDocument();
  });

  it("renders CardDetailsRelatedCards", () => {
    renderPage();
    expect(screen.getByTestId("related-cards")).toBeInTheDocument();
  });

  it('renders MarketTabContent when activeTab is "market"', () => {
    renderPage({ cardDetails: { activeTab: "market" } });
    expect(screen.getByTestId("market-tab")).toBeInTheDocument();
  });

  it('renders YourDataTabContent when activeTab is "your-data"', () => {
    renderPage({ cardDetails: { activeTab: "your-data" } });
    expect(screen.getByTestId("your-data-tab")).toBeInTheDocument();
  });

  it('does not render MarketTabContent when activeTab is "your-data"', () => {
    renderPage({ cardDetails: { activeTab: "your-data" } });
    expect(screen.queryByTestId("market-tab")).not.toBeInTheDocument();
  });

  it("does not render YourDataTabContent when activeTab is market", () => {
    renderPage({ cardDetails: { activeTab: "market" } });
    expect(screen.queryByTestId("your-data-tab")).not.toBeInTheDocument();
  });

  it("passes isLoading=true to YourDataTabContent when personalAnalytics is loading", () => {
    renderPage({
      cardDetails: {
        activeTab: "your-data",
        isLoadingPersonalAnalytics: true,
      },
    });
    const tab = screen.getByTestId("your-data-tab");
    expect(tab).toHaveAttribute("data-loading", "true");
  });

  it("passes isLoading=false to YourDataTabContent when analytics are ready", () => {
    renderPage({
      cardDetails: {
        activeTab: "your-data",
        isLoadingPersonalAnalytics: false,
      },
    });
    const tab = screen.getByTestId("your-data-tab");
    expect(tab).toHaveAttribute("data-loading", "false");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Effects
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPage — effects", () => {
  it("calls initializeCardDetails on mount", () => {
    const { mockSlices } = renderPage();
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledTimes(
      1,
    );
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "test-card",
      "all",
      "Settlers",
    );
  });

  it("calls clearCardDetails on unmount", () => {
    const { unmount, mockSlices } = renderPage();
    expect(mockSlices.cardDetails.clearCardDetails).not.toHaveBeenCalled();
    unmount();
    expect(mockSlices.cardDetails.clearCardDetails).toHaveBeenCalledTimes(1);
  });

  it('calls setSelectedLeague("all") on mount (reset for card navigation)', () => {
    const { mockSlices } = renderPage();
    expect(mockSlices.cardDetails.setSelectedLeague).toHaveBeenCalledWith(
      "all",
    );
  });

  it("calls fetchPriceHistory when activeTab is market", () => {
    const { mockSlices } = renderPage({ cardDetails: { activeTab: "market" } });
    expect(mockSlices.cardDetails.fetchPriceHistory).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
      "Test Card",
    );
  });

  it("loads the community drop rate for the global league", () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "all" },
    });

    expect(mockSlices.cardDetails.fetchCommunityDropRate).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
      "Test Card",
    );
  });

  it("loads the community drop rate for a selected league", () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "Standard" },
    });

    expect(mockSlices.cardDetails.fetchCommunityDropRate).toHaveBeenCalledWith(
      "poe1",
      "Standard",
      "Test Card",
    );
  });

  it("does not call fetchPriceHistory when activeTab is your-data", () => {
    const { mockSlices } = renderPage({
      cardDetails: { activeTab: "your-data" },
    });
    expect(mockSlices.cardDetails.fetchPriceHistory).not.toHaveBeenCalled();
  });

  it("reinitializes once when the selected league changes", () => {
    const mockSlices = createMockSlices({
      cardDetails: { selectedLeague: "all" },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);

    // Mutate the returned league so the next render sees a different fetchKey
    cardDetailsMock.selectedLeague = "Settlers";

    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenLastCalledWith(
      "poe1",
      "test-card",
      "Settlers",
      "Settlers",
    );
    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(2);
  });

  it("does not call initializeCardDetails again when re-rendered with same params (dedup guard)", () => {
    const mockSlices = createMockSlices({
      cardDetails: { selectedLeague: "all" },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);

    // Re-render with the exact same params — the ref-based dedup guard
    // should prevent a second call.
    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);
  });

  it("skips initializeCardDetails when the init key is unchanged", () => {
    const mockSlices = createMockSlices({
      cardDetails: { selectedLeague: "all" },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);

    const nextInitializeCardDetails = vi.fn();
    cardDetailsMock.initializeCardDetails = nextInitializeCardDetails;

    rerender(<CardDetailsPage />);

    expect(nextInitializeCardDetails).not.toHaveBeenCalled();
  });

  it("does not call fetchPriceHistory again on re-render with same card/league/tab (dedup guard)", () => {
    const mockSlices = createMockSlices({
      cardDetails: { activeTab: "market" },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);

    expect(cardDetailsMock.fetchPriceHistory).toHaveBeenCalledTimes(1);

    // Re-render with same params — priceFetchedRef dedup guard blocks second call
    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.fetchPriceHistory).toHaveBeenCalledTimes(1);
  });

  it("calls fetchPriceHistory when switching to market tab", () => {
    const mockSlices = createMockSlices({
      cardDetails: { activeTab: "your-data" },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);

    // Not called yet because activeTab is "your-data"
    expect(cardDetailsMock.fetchPriceHistory).not.toHaveBeenCalled();

    // Switch to market tab
    cardDetailsMock.activeTab = "market";
    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.fetchPriceHistory).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
      "Test Card",
    );
  });

  it("does not call fetchPriceHistory when card is null", () => {
    const { mockSlices } = renderPage({
      cardDetails: { activeTab: "market", card: null },
    });
    expect(mockSlices.cardDetails.fetchPriceHistory).not.toHaveBeenCalled();
  });

  it("does not call fetchPriceHistory when globalLeague is null", () => {
    const mockSlices = createMockSlices({
      cardDetails: { activeTab: "market" },
      settings: { getActiveGameViewSelectedLeague: vi.fn(() => null) },
    });

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(mockSlices.cardDetails as any);

    renderWithProviders(<CardDetailsPage />);

    expect(mockSlices.cardDetails.fetchPriceHistory).not.toHaveBeenCalled();
  });

  it("does not call fetchPriceHistory when globalLeague is empty", () => {
    const mockSlices = createMockSlices({
      cardDetails: { activeTab: "market" },
      settings: { getActiveGameViewSelectedLeague: vi.fn(() => "") },
    });

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(mockSlices.cardDetails as any);

    renderWithProviders(<CardDetailsPage />);

    expect(mockSlices.cardDetails.fetchPriceHistory).not.toHaveBeenCalled();
  });

  it("does not reinitialize an explicitly selected league when the global league changes", () => {
    let globalLeague = "Settlers";
    const mockSlices = createMockSlices({
      cardDetails: { selectedLeague: "Standard" },
      settings: {
        getActiveGameViewSelectedLeague: vi.fn(() => globalLeague),
      },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);
    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);

    globalLeague = "Mirage";
    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);
  });

  it("skips fetchPriceHistory when the price fetch key is unchanged", () => {
    const mockSlices = createMockSlices({
      cardDetails: { activeTab: "your-data" },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);

    expect(cardDetailsMock.fetchPriceHistory).not.toHaveBeenCalled();

    cardDetailsMock.activeTab = "market";
    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.fetchPriceHistory).toHaveBeenCalledTimes(1);

    const nextFetchPriceHistory = vi.fn();
    cardDetailsMock.fetchPriceHistory = nextFetchPriceHistory;

    rerender(<CardDetailsPage />);

    expect(nextFetchPriceHistory).not.toHaveBeenCalled();
  });
});
