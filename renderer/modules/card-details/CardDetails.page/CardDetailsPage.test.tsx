import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import {
  useCardDetails,
  useProhibitedLibrary,
  useSettings,
} from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useProhibitedLibrary: vi.fn(),
  useSettings: vi.fn(),
}));

// ─── Router mock ───────────────────────────────────────────────────────────

const mockUseParams = vi.fn(() => ({ cardSlug: "test-card" }));

vi.mock("@tanstack/react-router", () => ({
  useParams: (...args: any[]) => mockUseParams(...args),
}));

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

vi.mock("~/renderer/modules/umami", () => ({ trackEvent: vi.fn() }));

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
    },
    isLoadingCard: false,
    cardError: null,
    initializeCardDetails: vi.fn(),
    refreshPersonalAnalytics: vi.fn(),
    fetchPriceHistory: vi.fn(),
    clearCardDetails: vi.fn(),
    isLoadingPersonalAnalytics: false,
    isLeagueSwitching: false,
    selectedLeague: "all",
    setSelectedLeague: vi.fn(),
    activeTab: "market",
    getDisplayRarity: vi.fn(() => 3),
    ...overrides.cardDetails,
  };

  const prohibitedLibrary = {
    poe1Status: { league: "Settlers" },
    poe2Status: null,
    fetchStatus: vi.fn(),
    ...overrides.prohibitedLibrary,
  };

  return { settings, cardDetails, prohibitedLibrary };
}

function renderPage(overrides: Record<string, any> = {}) {
  const mockSlices = createMockSlices(overrides);
  vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
  vi.mocked(useCardDetails).mockReturnValue(mockSlices.cardDetails as any);
  vi.mocked(useProhibitedLibrary).mockReturnValue(
    mockSlices.prohibitedLibrary as any,
  );
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
        isLeagueSwitching: false,
      },
    });
    const tab = screen.getByTestId("your-data-tab");
    expect(tab).toHaveAttribute("data-loading", "true");
  });

  it("passes isLoading=true to YourDataTabContent when league is switching", () => {
    renderPage({
      cardDetails: {
        activeTab: "your-data",
        isLoadingPersonalAnalytics: false,
        isLeagueSwitching: true,
      },
    });
    const tab = screen.getByTestId("your-data-tab");
    expect(tab).toHaveAttribute("data-loading", "true");
  });

  it("passes isLoading=false to YourDataTabContent when neither loading nor switching", () => {
    renderPage({
      cardDetails: {
        activeTab: "your-data",
        isLoadingPersonalAnalytics: false,
        isLeagueSwitching: false,
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
      expect.anything(),
      "all",
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

  it("calls fetchStatus when plStatusForGame is null", () => {
    const { mockSlices } = renderPage({
      prohibitedLibrary: { poe1Status: null },
    });
    expect(mockSlices.prohibitedLibrary.fetchStatus).toHaveBeenCalled();
  });

  it("does NOT call fetchStatus when plStatusForGame exists", () => {
    const { mockSlices } = renderPage({
      prohibitedLibrary: { poe1Status: { league: "Settlers" } },
    });
    expect(mockSlices.prohibitedLibrary.fetchStatus).not.toHaveBeenCalled();
  });

  it("calls fetchPriceHistory when activeTab is market", () => {
    const { mockSlices } = renderPage({ cardDetails: { activeTab: "market" } });
    expect(mockSlices.cardDetails.fetchPriceHistory).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
      "Test Card",
    );
  });

  it("does not call fetchPriceHistory when activeTab is your-data", () => {
    const { mockSlices } = renderPage({
      cardDetails: { activeTab: "your-data" },
    });
    expect(mockSlices.cardDetails.fetchPriceHistory).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PL league resolution
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPage — PL league resolution", () => {
  it('uses selectedLeague when it is a challenge league (not "all" or "Standard")', () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "Settlers" },
      prohibitedLibrary: { poe1Status: { league: "OtherLeague" } },
    });

    // initializeCardDetails is called with plLeague derived from selectedLeague
    // When selectedLeague is "Settlers" (a challenge league), plLeague = "Settlers"
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "test-card",
      "Settlers",
      "Settlers",
    );
  });

  it('uses plStatus.league when selectedLeague is "all"', () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "all" },
      prohibitedLibrary: { poe1Status: { league: "Settlers" } },
    });

    // plLeague should resolve to plStatus.league = "Settlers"
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "test-card",
      "Settlers",
      "all",
    );
  });

  it('uses plStatus.league when selectedLeague is "Standard"', () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "Standard" },
      prohibitedLibrary: { poe1Status: { league: "Settlers" } },
    });

    // "Standard" falls through to plStatus.league
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "test-card",
      "Settlers",
      "Standard",
    );
  });

  it("uses null as plLeague when selectedLeague is all and plStatus is null", () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "all" },
      prohibitedLibrary: { poe1Status: null },
    });

    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "test-card",
      null,
      "all",
    );
  });

  it("resolves plLeague from poe2Status when game is poe2", () => {
    const { mockSlices } = renderPage({
      settings: { getSelectedGame: vi.fn(() => "poe2") },
      cardDetails: { selectedLeague: "all" },
      prohibitedLibrary: {
        poe1Status: { league: "Settlers" },
        poe2Status: { league: "Dawn" },
      },
    });

    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe2",
      "test-card",
      "Dawn",
      "all",
    );
  });
});
