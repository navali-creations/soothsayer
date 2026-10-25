import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useSettings } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn((selector: any) => selector(mockBoundStoreState)),
  useCardDetails: vi.fn(),
  useSettings: vi.fn(),
}));

// ─── Router mock ───────────────────────────────────────────────────────────

const { mockUseParams, mockBoundStoreState } = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ cardSlug: "test-card" })),
  mockBoundStoreState: {
    cards: { allCards: [] as any[] },
    sessionDetails: { session: null as any },
    currentSession: {
      poe1Session: null as any,
      poe2Session: null as any,
    },
  },
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
  default: (props: any) => (
    <div data-testid="header" data-animation-key={props.animationKey}>
      {props.cardName}
    </div>
  ),
}));

vi.mock("../CardDetails.components/CardDetailsRelatedCards", () => ({
  default: () => <div data-testid="related-cards" />,
}));

vi.mock("../CardDetails.components/CardDetailsVisual", () => ({
  default: () => <div data-testid="visual" />,
}));

vi.mock(
  "../CardDetails.components/YourDataTabContent/YourDataTabContent",
  () => ({
    default: (props: any) => (
      <div
        data-testid="your-data-tab"
        data-loading={String(props.isLoading)}
        data-card-name={props.cardName}
        data-game={props.game}
      />
    ),
  }),
);

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
      Content: ({ children, animationKey }: any) => (
        <div data-testid="page-content" data-animation-key={animationKey}>
          {children}
        </div>
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
    activeCardKey: "poe1:test-card",
    initializeCardDetails: vi.fn(),
    fetchCommunityDropRate: vi.fn(),
    clearCardDetails: vi.fn(),
    isLoadingPersonalAnalytics: false,
    selectedLeague: "all",
    setSelectedLeague: vi.fn(),
    getDisplayRarity: vi.fn(() => 3),
    relatedCards: null,
    ...overrides.cardDetails,
  };

  if (!overrides.cardDetails?.initializeCardDetails) {
    cardDetails.initializeCardDetails.mockImplementation(
      (_game: string, _cardSlug: string, selectedLeague: string) => {
        cardDetails.selectedLeague = selectedLeague;
      },
    );
  }

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
  mockBoundStoreState.cards.allCards = [];
  mockBoundStoreState.sessionDetails.session = null;
  mockBoundStoreState.currentSession.poe1Session = null;
  mockBoundStoreState.currentSession.poe2Session = null;
});

// ═══════════════════════════════════════════════════════════════════════════
// Loading state
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsPage — loading state", () => {
  it("keeps the page shell mounted when card details are loading", () => {
    renderPage({ cardDetails: { isLoadingCard: true } });
    expect(screen.getByTestId("page-container")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("your-data-tab")).toHaveAttribute(
      "data-loading",
      "true",
    );
  });

  it("keeps already resolved card content visible while refreshing", () => {
    renderPage({ cardDetails: { isLoadingCard: true } });
    expect(screen.getByTestId("visual")).toBeInTheDocument();
    expect(screen.getByTestId("external-links")).toBeInTheDocument();
    expect(screen.getByTestId("related-cards")).toBeInTheDocument();
  });

  it("uses cached cards-page metadata while analytics load", () => {
    mockBoundStoreState.cards.allCards = [
      {
        id: "poe1_test-card",
        name: "Test Card",
        game: "poe1",
        stackSize: 5,
        description: "test",
        rewardHtml: "<p>Reward</p>",
        artSrc: "test.png",
        flavourHtml: "",
        rarity: 3,
        filterRarity: null,
        prohibitedLibraryRarity: null,
        fromBoss: false,
        isDisabled: false,
        inPool: true,
      },
    ];

    renderPage({ cardDetails: { card: null, isLoadingCard: true } });

    expect(screen.getByTestId("header")).toHaveTextContent("Test Card");
    expect(screen.getByTestId("visual")).toBeInTheDocument();
    expect(screen.getByTestId("external-links")).toBeInTheDocument();
  });

  it("uses cached session-details metadata while analytics load", () => {
    mockBoundStoreState.sessionDetails.session = {
      game: "poe1",
      cards: [
        {
          name: "Test Card",
          count: 1,
          divinationCard: {
            id: "poe1_test-card",
            stackSize: 5,
            description: "test",
            rewardHtml: "<p>Reward</p>",
            artSrc: "test.png",
            flavourHtml: "",
            rarity: 3,
            fromBoss: false,
          },
        },
      ],
    };

    const { rerender } = renderPage({
      cardDetails: { card: null, isLoadingCard: true },
    });

    expect(screen.getByTestId("header")).toHaveTextContent("Test Card");
    expect(screen.getByTestId("visual")).toBeInTheDocument();
    expect(screen.getByTestId("your-data-tab")).toHaveAttribute(
      "data-card-name",
      "Test Card",
    );

    mockBoundStoreState.sessionDetails.session = null;
    rerender(<CardDetailsPage />);

    expect(screen.getByTestId("header")).toHaveTextContent("Test Card");
    expect(screen.getByTestId("visual")).toBeInTheDocument();
  });

  it("does not preview session-details metadata from another game", () => {
    mockBoundStoreState.sessionDetails.session = {
      game: "poe2",
      cards: [
        {
          name: "Test Card",
          count: 1,
          divinationCard: { id: "poe2_test-card", rarity: 3 },
        },
      ],
    };

    renderPage({ cardDetails: { card: null, isLoadingCard: true } });

    expect(screen.getByTestId("header")).toHaveTextContent("");
    expect(screen.queryByTestId("visual")).not.toBeInTheDocument();
  });

  it("uses related-card metadata immediately when navigating to a similar card", () => {
    const { mockSlices, rerender } = renderPage({
      cardDetails: {
        relatedCards: {
          chainCards: [],
          similarCards: [
            {
              name: "Another Card",
              artSrc: "another.png",
              stackSize: 7,
              description: "another",
              rewardHtml: "<p>Another reward</p>",
              flavourHtml: "",
              rarity: 2,
              filterRarity: null,
              prohibitedLibraryRarity: null,
              fromBoss: false,
              relationship: "similar",
            },
          ],
        },
      },
    });

    mockUseParams.mockReturnValue({ cardSlug: "another-card" });
    mockSlices.cardDetails.card = null;
    mockSlices.cardDetails.isLoadingCard = true;
    rerender(<CardDetailsPage />);

    expect(screen.getByTestId("header")).toHaveTextContent("Another Card");
    expect(screen.getByTestId("visual")).toBeInTheDocument();
    expect(screen.getByTestId("your-data-tab")).toHaveAttribute(
      "data-card-name",
      "Another Card",
    );
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

  it("renders the page shell while a card has not initialized", () => {
    renderPage({ cardDetails: { card: null } });
    expect(screen.getByTestId("page-container")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("your-data-tab")).toHaveAttribute(
      "data-card-name",
      "",
    );
    expect(screen.queryByTestId("visual")).not.toBeInTheDocument();
    expect(screen.queryByTestId("error")).not.toBeInTheDocument();
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
  it("keys header and content animation to the active card and league", () => {
    const { mockSlices, rerender } = renderPage();

    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-animation-key",
      "poe1:test-card:all",
    );
    expect(screen.getByTestId("page-content")).toHaveAttribute(
      "data-animation-key",
      "poe1:test-card:all",
    );

    mockSlices.cardDetails.selectedLeague = "Standard";
    rerender(<CardDetailsPage />);

    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-animation-key",
      "poe1:test-card:Standard",
    );
    expect(screen.getByTestId("page-content")).toHaveAttribute(
      "data-animation-key",
      "poe1:test-card:Standard",
    );
  });

  it("changes the animation key when navigating to another card", () => {
    const { rerender } = renderPage();

    mockUseParams.mockReturnValue({ cardSlug: "another-card" });
    rerender(<CardDetailsPage />);

    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-animation-key",
      "poe1:another-card:all",
    );
    expect(screen.getByTestId("page-content")).toHaveAttribute(
      "data-animation-key",
      "poe1:another-card:all",
    );
  });

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

  it("renders personal analytics content", () => {
    renderPage();
    expect(screen.getByTestId("your-data-tab")).toBeInTheDocument();
  });

  it("passes isLoading=true to YourDataTabContent when personalAnalytics is loading", () => {
    renderPage({
      cardDetails: {
        isLoadingPersonalAnalytics: true,
      },
    });
    const tab = screen.getByTestId("your-data-tab");
    expect(tab).toHaveAttribute("data-loading", "true");
  });

  it("passes isLoading=false to YourDataTabContent when analytics are ready", () => {
    renderPage({
      cardDetails: {
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

  it("initializes a newly opened card with the current card-details league", () => {
    const { mockSlices } = renderPage({
      cardDetails: { selectedLeague: "Standard" },
    });

    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledTimes(
      1,
    );
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "test-card",
      "Standard",
      "Standard",
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
    const { mockSlices, rerender } = renderPage();
    mockSlices.cardDetails.selectedLeague = "Standard";
    rerender(<CardDetailsPage />);

    expect(
      mockSlices.cardDetails.fetchCommunityDropRate,
    ).toHaveBeenLastCalledWith("poe1", "Standard", "Test Card");
  });

  it("preserves the selected league when initializing a different card", () => {
    const { mockSlices, rerender } = renderPage();
    mockSlices.cardDetails.selectedLeague = "Standard";
    rerender(<CardDetailsPage />);
    mockSlices.cardDetails.initializeCardDetails.mockClear();

    mockUseParams.mockReturnValue({ cardSlug: "another-card" });
    rerender(<CardDetailsPage />);

    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledOnce();
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledWith(
      "poe1",
      "another-card",
      "Standard",
      "Standard",
    );
  });

  it("falls back to all leagues when the card is absent from the selected league", () => {
    const { mockSlices, rerender } = renderPage({
      cardDetails: {
        selectedLeague: "Standard",
      },
    });

    mockSlices.cardDetails.card.inPool = false;
    rerender(<CardDetailsPage />);

    expect(
      mockSlices.cardDetails.initializeCardDetails,
    ).toHaveBeenNthCalledWith(1, "poe1", "test-card", "Standard", "Standard");
    expect(
      mockSlices.cardDetails.initializeCardDetails,
    ).toHaveBeenNthCalledWith(2, "poe1", "test-card", "all", "Settlers");
    expect(mockSlices.cardDetails.initializeCardDetails).toHaveBeenCalledTimes(
      2,
    );
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

  it("does not reinitialize an explicitly selected league when the global league changes", () => {
    let globalLeague = "Settlers";
    const mockSlices = createMockSlices({
      settings: {
        getActiveGameViewSelectedLeague: vi.fn(() => globalLeague),
      },
    });
    const cardDetailsMock = { ...mockSlices.cardDetails };

    vi.mocked(useSettings).mockReturnValue(mockSlices.settings as any);
    vi.mocked(useCardDetails).mockReturnValue(cardDetailsMock as any);

    const { rerender } = renderWithProviders(<CardDetailsPage />);
    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(1);

    cardDetailsMock.selectedLeague = "Standard";
    rerender(<CardDetailsPage />);
    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(2);

    globalLeague = "Mirage";
    rerender(<CardDetailsPage />);

    expect(cardDetailsMock.initializeCardDetails).toHaveBeenCalledTimes(2);
  });
});
