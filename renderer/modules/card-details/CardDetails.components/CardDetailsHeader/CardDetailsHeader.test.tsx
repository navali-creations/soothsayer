import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn((selector?: any) => {
    const state = {
      rarityInsights: { activeFilterTheme: null },
    };
    return selector ? selector(state) : state;
  }),
  useCardDetails: vi.fn(),
}));

// ─── Router mock ───────────────────────────────────────────────────────────

const { mockHistoryBack } = vi.hoisted(() => ({
  mockHistoryBack: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const { createNavigateWithHistoryMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createNavigateWithHistoryMock(vi.fn(), mockHistoryBack);
});

// ─── Component library mocks ──────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(({ children }: any) => <div>{children}</div>, {
    Header: ({ title, subtitle, actions, animationKey }: any) => (
      <div data-testid="header" data-animation-key={animationKey}>
        <span data-testid="header-title">{title}</span>
        <div data-testid="header-subtitle">{subtitle}</div>
        <div data-testid="header-actions">{actions}</div>
      </div>
    ),
  }),
  BackButton: ({ fallback, label, ...props }: any) => (
    <button
      data-testid="back-button"
      data-fallback={fallback}
      onClick={() => mockHistoryBack()}
      {...props}
    >
      <span data-testid="icon-arrow-left" />
      {label && <span>{label}</span>}
    </button>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import CardDetailsHeader from "./CardDetailsHeader";
import HeaderActions from "./HeaderActions";
import HeaderSubtitle from "./HeaderSubtitle";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createHeaderActionsMockState(overrides: Record<string, any> = {}) {
  const base = {
    cardDetails: {
      selectedLeague: "all",
      setSelectedLeague: vi.fn(),
      getAvailableLeagues: vi.fn(() => ["Settlers", "Standard"]),
      personalAnalytics: { cardName: "The Doctor" },
    },
  };

  if (overrides.cardDetails) {
    base.cardDetails = { ...base.cardDetails, ...overrides.cardDetails };
  }
  return base;
}

function renderHeaderActions(overrides: Record<string, any> = {}) {
  const mockState = createHeaderActionsMockState(overrides);
  vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);
  const result = renderWithProviders(<HeaderActions />);
  return { ...result, mockState };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  mockHistoryBack.mockClear();
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// CardDetailsHeader
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsHeader", () => {
  function renderHeader(
    props: { cardName?: string; rarity?: any; fromBoss?: boolean } = {},
  ) {
    const mockState = createHeaderActionsMockState();
    vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);

    return renderWithProviders(
      <CardDetailsHeader
        cardName={props.cardName ?? "The Doctor"}
        rarity={props.rarity ?? 2}
        fromBoss={props.fromBoss ?? false}
      />,
    );
  }

  it("renders card name in header title", () => {
    renderHeader({ cardName: "The Doctor" });
    expect(screen.getByTestId("header-title")).toHaveTextContent("The Doctor");
  });

  it("passes the page animation key to the shared header", () => {
    const mockState = createHeaderActionsMockState();
    vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);

    renderWithProviders(
      <CardDetailsHeader
        cardName="The Doctor"
        rarity={2}
        animationKey="poe1:the-doctor:all"
      />,
    );

    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-animation-key",
      "poe1:the-doctor:all",
    );
  });

  it("keeps the header mounted before the card resolves", () => {
    const mockState = createHeaderActionsMockState();
    vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);

    renderWithProviders(<CardDetailsHeader />);

    expect(screen.getByTestId("header-title")).toHaveTextContent(
      "Card Details",
    );
    expect(screen.getByTestId("header-subtitle")).toBeEmptyDOMElement();
    expect(screen.getByTestId("header-actions")).not.toBeEmptyDOMElement();
  });

  it("passes rarity to subtitle", () => {
    renderHeader({ rarity: 1 });
    const subtitle = screen.getByTestId("header-subtitle");
    expect(subtitle).toHaveTextContent("Extremely Rare");
  });

  it("passes fromBoss to subtitle", () => {
    renderHeader({ fromBoss: true });
    const subtitle = screen.getByTestId("header-subtitle");
    expect(subtitle).toHaveTextContent("Boss-exclusive");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HeaderSubtitle
// ═══════════════════════════════════════════════════════════════════════════

describe("HeaderSubtitle", () => {
  it("renders the rarity label badge", () => {
    renderWithProviders(<HeaderSubtitle rarity={1} fromBoss={false} />);
    expect(screen.getByText("Extremely Rare")).toBeInTheDocument();
  });

  it("renders correct label for each rarity tier", () => {
    const cases: Array<[0 | 1 | 2 | 3 | 4, string]> = [
      [0, "Unknown"],
      [1, "Extremely Rare"],
      [2, "Rare"],
      [3, "Less Common"],
      [4, "Common"],
    ];

    for (const [rarity, label] of cases) {
      const { unmount } = renderWithProviders(
        <HeaderSubtitle rarity={rarity} fromBoss={false} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows "Boss-exclusive" badge when fromBoss is true', () => {
    renderWithProviders(<HeaderSubtitle rarity={2} fromBoss={true} />);
    expect(screen.getByText("Boss-exclusive")).toBeInTheDocument();
  });

  it('does not show "Boss-exclusive" badge when fromBoss is false', () => {
    renderWithProviders(<HeaderSubtitle rarity={2} fromBoss={false} />);
    expect(screen.queryByText("Boss-exclusive")).not.toBeInTheDocument();
  });

  it("applies inline style to the rarity badge", () => {
    renderWithProviders(<HeaderSubtitle rarity={1} fromBoss={false} />);
    const badge = screen.getByText("Extremely Rare");
    expect(badge).toHaveStyle({ borderWidth: "1px", borderStyle: "solid" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HeaderActions
// ═══════════════════════════════════════════════════════════════════════════

describe("HeaderActions", () => {
  // ─── Back button ─────────────────────────────────────────────────────────

  it("renders a back button", () => {
    renderHeaderActions();
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  it("back button has /cards as fallback route", () => {
    renderHeaderActions();
    expect(screen.getByTestId("back-button")).toHaveAttribute(
      "data-fallback",
      "/cards",
    );
  });

  it("back button navigates back when clicked", async () => {
    const { user } = renderHeaderActions();
    const backButton = screen.getByTestId("back-button");
    await user.click(backButton);
    expect(mockHistoryBack).toHaveBeenCalled();
  });

  // ─── League selector ────────────────────────────────────────────────────

  it('renders league selector with "All Leagues" option', () => {
    renderHeaderActions();
    const select = screen.getByRole("combobox", {
      name: "Card details league",
    });
    expect(select).toBeInTheDocument();
    expect(screen.getByText("All Leagues")).toBeInTheDocument();
  });

  it("renders available league options", () => {
    renderHeaderActions({
      cardDetails: {
        getAvailableLeagues: vi.fn(() => ["Settlers", "Standard", "Ancestor"]),
      },
    });
    expect(screen.getByText("Settlers")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Ancestor")).toBeInTheDocument();
  });

  it("changing league calls setSelectedLeague", async () => {
    const { user, mockState } = renderHeaderActions();
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Settlers");
    expect(mockState.cardDetails.setSelectedLeague).toHaveBeenCalledWith(
      "Settlers",
    );
  });

  it("does not render card-detail tabs", () => {
    renderHeaderActions();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Market Data")).not.toBeInTheDocument();
    expect(screen.queryByText("Your Data")).not.toBeInTheDocument();
  });

  it("reflects selectedLeague value in the select element", () => {
    renderHeaderActions({
      cardDetails: { selectedLeague: "Standard" },
    });
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("Standard");
  });

  it("keeps the selected league visible while analytics are loading", () => {
    renderHeaderActions({
      cardDetails: {
        selectedLeague: "Standard",
        personalAnalytics: null,
        getAvailableLeagues: vi.fn(() => []),
      },
    });

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("Standard");
    expect(
      screen.getByRole("option", { name: "Standard" }),
    ).toBeInTheDocument();
  });

  it("matches the statistics league selector width", () => {
    renderHeaderActions();
    expect(screen.getByRole("combobox")).toHaveClass("w-40");
  });
});
