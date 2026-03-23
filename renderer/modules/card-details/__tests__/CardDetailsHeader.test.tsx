import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Router mock ───────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(() => mockNavigate),
}));

// ─── Umami mock ────────────────────────────────────────────────────────────

const mockTrackEvent = vi.fn();

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

// ─── Component library mocks ──────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(({ children }: any) => <div>{children}</div>, {
    Header: ({ title, subtitle, actions }: any) => (
      <div data-testid="header">
        <span data-testid="header-title">{title}</span>
        <div data-testid="header-subtitle">{subtitle}</div>
        <div data-testid="header-actions">{actions}</div>
      </div>
    ),
  }),
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import CardDetailsHeader from "../CardDetails.components/CardDetailsHeader/CardDetailsHeader";
import HeaderActions from "../CardDetails.components/CardDetailsHeader/HeaderActions";
import HeaderSubtitle from "../CardDetails.components/CardDetailsHeader/HeaderSubtitle";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createHeaderActionsMockState(overrides: Record<string, any> = {}) {
  const base = {
    cardDetails: {
      selectedLeague: "all",
      setSelectedLeague: vi.fn(),
      activeTab: "market" as "market" | "your-data",
      setActiveTab: vi.fn(),
      getAvailableLeagues: vi.fn(() => ["Settlers", "Standard"]),
      personalAnalytics: { cardName: "The Doctor" },
    },
    settings: {
      getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
    },
  };

  if (overrides.cardDetails) {
    base.cardDetails = { ...base.cardDetails, ...overrides.cardDetails };
  }
  if (overrides.settings) {
    base.settings = { ...base.settings, ...overrides.settings };
  }

  return base;
}

function renderHeaderActions(overrides: Record<string, any> = {}) {
  const mockState = createHeaderActionsMockState(overrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  const result = renderWithProviders(<HeaderActions />);
  return { ...result, mockState };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  mockTrackEvent.mockClear();
  mockNavigate.mockClear();
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
    vi.mocked(useBoundStore).mockReturnValue(mockState as any);

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
    const buttons = screen.getAllByRole("button");
    // The first button in the flex layout is the back button
    expect(buttons[0]).toBeInTheDocument();
  });

  it("back button navigates to /cards", async () => {
    const { user } = renderHeaderActions();
    const buttons = screen.getAllByRole("button");
    // The back button is the first button (with variant="ghost")
    const backButton = buttons[0];
    await user.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/cards" });
  });

  // ─── League selector ────────────────────────────────────────────────────

  it('renders league selector with "All Leagues" option', () => {
    renderHeaderActions();
    const select = screen.getByRole("combobox");
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

  it("tracks event on league change", async () => {
    const { user } = renderHeaderActions({
      cardDetails: { personalAnalytics: { cardName: "The Doctor" } },
    });
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Settlers");
    expect(mockTrackEvent).toHaveBeenCalledWith("card-details:league-change", {
      cardName: "The Doctor",
      league: "Settlers",
    });
  });

  // ─── Tab buttons ─────────────────────────────────────────────────────────

  it("renders Market Data tab button", () => {
    renderHeaderActions();
    expect(
      screen.getByRole("tab", { name: /market data/i }),
    ).toBeInTheDocument();
  });

  it("renders Your Data tab button", () => {
    renderHeaderActions();
    expect(screen.getByRole("tab", { name: /your data/i })).toBeInTheDocument();
  });

  it('Market Data tab is active when activeTab is "market"', () => {
    renderHeaderActions({ cardDetails: { activeTab: "market" } });
    const tab = screen.getByRole("tab", { name: /market data/i });
    expect(tab.className).toContain("tab-active");
  });

  it('Your Data tab is active when activeTab is "your-data"', () => {
    renderHeaderActions({ cardDetails: { activeTab: "your-data" } });
    const tab = screen.getByRole("tab", { name: /your data/i });
    expect(tab.className).toContain("tab-active");
  });

  it('Market Data tab is not active when activeTab is "your-data"', () => {
    renderHeaderActions({ cardDetails: { activeTab: "your-data" } });
    const tab = screen.getByRole("tab", { name: /market data/i });
    expect(tab.className).not.toContain("tab-active");
  });

  it('Your Data tab is not active when activeTab is "market"', () => {
    renderHeaderActions({ cardDetails: { activeTab: "market" } });
    const tab = screen.getByRole("tab", { name: /your data/i });
    expect(tab.className).not.toContain("tab-active");
  });

  it("clicking Market Data tab calls setActiveTab with 'market'", async () => {
    const { user, mockState } = renderHeaderActions({
      cardDetails: { activeTab: "your-data" },
    });
    const tab = screen.getByRole("tab", { name: /market data/i });
    await user.click(tab);
    expect(mockState.cardDetails.setActiveTab).toHaveBeenCalledWith("market");
  });

  it("clicking Your Data tab calls setActiveTab with 'your-data'", async () => {
    const { user, mockState } = renderHeaderActions({
      cardDetails: { activeTab: "market" },
    });
    const tab = screen.getByRole("tab", { name: /your data/i });
    await user.click(tab);
    expect(mockState.cardDetails.setActiveTab).toHaveBeenCalledWith(
      "your-data",
    );
  });

  it("tracks event on market tab click", async () => {
    const { user } = renderHeaderActions({
      cardDetails: {
        activeTab: "your-data",
        personalAnalytics: { cardName: "The Doctor" },
      },
      settings: {
        getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      },
    });
    const tab = screen.getByRole("tab", { name: /market data/i });
    await user.click(tab);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "card-details:market-data-click",
      { cardName: "The Doctor", league: "Settlers" },
    );
  });

  it("does not track event on your-data tab click", async () => {
    const { user } = renderHeaderActions({
      cardDetails: { activeTab: "market" },
    });
    const tab = screen.getByRole("tab", { name: /your data/i });
    await user.click(tab);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("does not track league change event when personalAnalytics is null", async () => {
    const { user } = renderHeaderActions({
      cardDetails: { personalAnalytics: null },
    });
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Settlers");
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("reflects selectedLeague value in the select element", () => {
    renderHeaderActions({
      cardDetails: { selectedLeague: "Standard" },
    });
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("Standard");
  });
});
