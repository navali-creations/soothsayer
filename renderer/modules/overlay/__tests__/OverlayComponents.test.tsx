import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled ?? false} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("~/renderer/utils", () => ({
  getRarityStyles: vi.fn(() => ({
    bgGradient: "",
    border: "",
    text: "",
    beam: "",
    showBeam: false,
    badgeBg: "",
    badgeText: "",
    badgeBorder: "",
  })),
  formatCurrency: vi.fn((value: number, _ratio: number) => `${value}c`),
}));

// Mock react-icons used across multiple components
vi.mock("react-icons/lu", () => ({
  LuTimerOff: (props: any) => <span data-testid="icon-timer-off" {...props} />,
}));

vi.mock("react-icons/fi", () => ({
  FiX: (props: any) => <span data-testid="icon-x" {...props} />,
  FiLock: (props: any) => <span data-testid="icon-lock" {...props} />,
  FiUnlock: (props: any) => <span data-testid="icon-unlock" {...props} />,
  FiAlertTriangle: (props: any) => (
    <span data-testid="icon-alert-triangle" {...props} />
  ),
}));

// Mock Beam CSS import to avoid CSS parse errors in jsdom
vi.mock("../Overlay.components/Beam/beam.css", () => ({}));

// Only mock OverlayDropsList — it is NOT tested in this file (has its own test file).
// All other overlay components (OverlayEmpty, OverlayActionButtons, OverlayTabBar,
// Beam, etc.) are tested directly here, so we let them render for real.
vi.mock("../Overlay.components/OverlayDropsList", () => ({
  OverlayDropsList: () => <div data-testid="drops-list" />,
}));

// ─── Component imports (must come after vi.mock calls) ─────────────────────

import Beam from "../Overlay.components/Beam/Beam";
import { DropBeamColumn } from "../Overlay.components/DropBeamColumn";
import { DropContentColumn } from "../Overlay.components/DropContentColumn";
import { OverlayActionButtons } from "../Overlay.components/OverlayActionButtons";
import { OverlayContent } from "../Overlay.components/OverlayContent";
import { OverlayEmpty } from "../Overlay.components/OverlayEmpty";
import { OverlaySidebar } from "../Overlay.components/OverlaySidebar";
import { OverlayTabBar } from "../Overlay.components/OverlayTabBar";
import { OverlayTabs } from "../Overlay.components/OverlayTabs";

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: any = {}) {
  return {
    overlay: {
      sessionData: {
        isActive: true,
        totalCount: 10,
        totalProfit: 500,
        chaosToDivineRatio: 200,
        priceSource: "exchange" as const,
        cards: [{ cardName: "The Doctor", count: 1 }],
        recentDrops: [
          {
            cardName: "The Doctor",
            rarity: 1,
            exchangePrice: { chaosValue: 1000, divineValue: 5 },
            stashPrice: { chaosValue: 950, divineValue: 4.75 },
          },
        ],
        ...overrides.sessionData,
      },
      isLocked: true,
      isLeftHalf: false,
      setLocked: vi.fn(),
      hide: vi.fn(),
      activeTab: "all" as const,
      setActiveTab: vi.fn(),
      getFilteredDrops: vi.fn(() => []),
      detectZone: vi.fn(),
      ...overrides,
      // Re-apply sessionData if it was in overrides to avoid double-spread issues
      ...(overrides.sessionData
        ? {
            sessionData: {
              isActive: true,
              totalCount: 10,
              totalProfit: 500,
              chaosToDivineRatio: 200,
              priceSource: "exchange" as const,
              cards: [{ cardName: "The Doctor", count: 1 }],
              recentDrops: [],
              ...overrides.sessionData,
            },
          }
        : {}),
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlayContent
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayContent", () => {
  it("renders drops list when session is active", () => {
    setupStore({ sessionData: { isActive: true } });
    renderWithProviders(<OverlayContent />);

    expect(screen.getByTestId("drops-list")).toBeInTheDocument();
  });

  it("renders empty state when session is not active", () => {
    setupStore({ sessionData: { isActive: false } });
    renderWithProviders(<OverlayContent />);

    // OverlayEmpty is real — look for its actual rendered text
    expect(screen.getByText("No Active Session")).toBeInTheDocument();
    expect(screen.queryByTestId("drops-list")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlayEmpty
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayEmpty", () => {
  it('renders "No Active Session" heading', () => {
    renderWithProviders(<OverlayEmpty />);

    expect(screen.getByText("No Active Session")).toBeInTheDocument();
  });

  it('renders "Start a session to see live stats" text', () => {
    renderWithProviders(<OverlayEmpty />);

    expect(
      screen.getByText("Start a session to see live stats"),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlaySidebar
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlaySidebar", () => {
  it('renders "soothsayer" text', () => {
    setupStore();
    renderWithProviders(<OverlaySidebar />);

    expect(screen.getByText("soothsayer")).toBeInTheDocument();
  });

  it("uses sideways-lr writing mode when isLeftHalf", () => {
    setupStore({ isLeftHalf: true });
    renderWithProviders(<OverlaySidebar />);

    const text = screen.getByText("soothsayer");
    expect(text).toHaveStyle({ writingMode: "sideways-lr" });
  });

  it("uses vertical-rl writing mode when not isLeftHalf", () => {
    setupStore({ isLeftHalf: false });
    renderWithProviders(<OverlaySidebar />);

    const text = screen.getByText("soothsayer");
    expect(text).toHaveStyle({ writingMode: "vertical-rl" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlayActionButtons
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayActionButtons", () => {
  it("renders close button", () => {
    setupStore();
    renderWithProviders(<OverlayActionButtons />);

    const closeTooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Close Overlay")!
      .closest("[data-tip]");
    expect(closeTooltip).toBeInTheDocument();
  });

  it("renders lock/unlock button", () => {
    setupStore();
    renderWithProviders(<OverlayActionButtons />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
  });

  it("close button calls hide()", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<OverlayActionButtons />);

    const closeTooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Close Overlay")!
      .closest("[data-tip]")!;
    const closeButton = closeTooltip.querySelector("button")!;

    await user.click(closeButton);

    expect(store.overlay.hide).toHaveBeenCalledTimes(1);
  });

  it("lock button calls setLocked(false) when locked", async () => {
    const store = setupStore({ isLocked: true });
    const { user } = renderWithProviders(<OverlayActionButtons />);

    const unlockTooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Unlock Overlay")!
      .closest("[data-tip]")!;
    const lockButton = unlockTooltip.querySelector("button")!;

    await user.click(lockButton);

    expect(store.overlay.setLocked).toHaveBeenCalledWith(false);
  });

  it("unlock button calls setLocked(true) when unlocked", async () => {
    const store = setupStore({ isLocked: false });
    const { user } = renderWithProviders(<OverlayActionButtons />);

    const lockTooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Lock Overlay")!
      .closest("[data-tip]")!;
    const lockButton = lockTooltip.querySelector("button")!;

    await user.click(lockButton);

    expect(store.overlay.setLocked).toHaveBeenCalledWith(true);
  });

  it("shows Unlock tooltip when locked", () => {
    setupStore({ isLocked: true });
    renderWithProviders(<OverlayActionButtons />);

    const tooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Unlock Overlay")!
      .closest("[data-tip]");
    expect(tooltip).toBeInTheDocument();
  });

  it("shows Lock tooltip when unlocked", () => {
    setupStore({ isLocked: false });
    renderWithProviders(<OverlayActionButtons />);

    const tooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Lock Overlay")!
      .closest("[data-tip]");
    expect(tooltip).toBeInTheDocument();
  });

  it("buttons are in reversed order when isLeftHalf is false", () => {
    setupStore({ isLeftHalf: false });
    const { container } = renderWithProviders(<OverlayActionButtons />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("flex-row-reverse");
  });

  it("buttons are in normal order when isLeftHalf is true", () => {
    setupStore({ isLeftHalf: true });
    const { container } = renderWithProviders(<OverlayActionButtons />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("flex-row");
    expect(wrapper.className).not.toContain("flex-row-reverse");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlayTabBar
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayTabBar", () => {
  it("renders All and Valuable tabs", () => {
    setupStore();
    renderWithProviders(<OverlayTabBar />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Valuable")).toBeInTheDocument();
  });

  it('All tab has tab-active class when activeTab is "all"', () => {
    setupStore({ activeTab: "all" as const });
    renderWithProviders(<OverlayTabBar />);

    const allButton = screen.getByText("All");
    expect(allButton.className).toContain("tab-active");
  });

  it('Valuable tab has tab-active class when activeTab is "valuable"', () => {
    setupStore({ activeTab: "valuable" as const });
    renderWithProviders(<OverlayTabBar />);

    const valuableButton = screen.getByText("Valuable");
    expect(valuableButton.className).toContain("tab-active");
  });

  it('All tab does not have tab-active class when activeTab is "valuable"', () => {
    setupStore({ activeTab: "valuable" as const });
    renderWithProviders(<OverlayTabBar />);

    const allButton = screen.getByText("All");
    expect(allButton.className).not.toContain("tab-active");
  });

  it('clicking All calls setActiveTab("all")', async () => {
    const store = setupStore({ activeTab: "valuable" as const });
    const { user } = renderWithProviders(<OverlayTabBar />);

    await user.click(screen.getByText("All"));

    expect(store.overlay.setActiveTab).toHaveBeenCalledWith("all");
  });

  it('clicking Valuable calls setActiveTab("valuable")', async () => {
    const store = setupStore({ activeTab: "all" as const });
    const { user } = renderWithProviders(<OverlayTabBar />);

    await user.click(screen.getByText("Valuable"));

    expect(store.overlay.setActiveTab).toHaveBeenCalledWith("valuable");
  });

  it("tabs are disabled when session is not active", () => {
    setupStore({ sessionData: { isActive: false } });
    renderWithProviders(<OverlayTabBar />);

    const allButton = screen.getByText("All");
    const valuableButton = screen.getByText("Valuable");

    expect(allButton).toBeDisabled();
    expect(valuableButton).toBeDisabled();
  });

  it("tabs are enabled when session is active", () => {
    setupStore({ sessionData: { isActive: true } });
    renderWithProviders(<OverlayTabBar />);

    const allButton = screen.getByText("All");
    const valuableButton = screen.getByText("Valuable");

    expect(allButton).not.toBeDisabled();
    expect(valuableButton).not.toBeDisabled();
  });

  it('shows "Disabled until active session" tooltip when not active', () => {
    setupStore({ sessionData: { isActive: false } });
    renderWithProviders(<OverlayTabBar />);

    const tooltips = screen.getAllByText(
      (_, el) =>
        el?.getAttribute("data-tip") === "Disabled until active session",
    );
    expect(tooltips.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlayTabs
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayTabs", () => {
  it("renders action buttons and tab bar", () => {
    setupStore();
    renderWithProviders(<OverlayTabs />);

    // Real OverlayActionButtons renders a "Close Overlay" tooltip
    const closeTooltip = screen
      .getByText((_, el) => el?.getAttribute("data-tip") === "Close Overlay")!
      .closest("[data-tip]");
    expect(closeTooltip).toBeInTheDocument();

    // Real OverlayTabBar renders "All" and "Valuable" buttons
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Valuable")).toBeInTheDocument();
  });

  it("action buttons come first when isLeftHalf", () => {
    setupStore({ isLeftHalf: true });
    const { container } = renderWithProviders(<OverlayTabs />);

    const wrapper = container.firstElementChild as HTMLElement;
    const children = Array.from(wrapper.children);

    // When isLeftHalf, OverlayActionButtons renders before OverlayTabBar.
    // OverlayActionButtons has gap-1 + flex-row; OverlayTabBar has role="tablist".
    const actionButtonsIndex = children.findIndex((el) =>
      el.querySelector('[data-tip="Close Overlay"]'),
    );
    const tabBarIndex = children.findIndex(
      (el) => el.getAttribute("role") === "tablist",
    );

    expect(actionButtonsIndex).toBeGreaterThanOrEqual(0);
    expect(tabBarIndex).toBeGreaterThanOrEqual(0);
    expect(actionButtonsIndex).toBeLessThan(tabBarIndex);
  });

  it("tab bar comes first when not isLeftHalf", () => {
    setupStore({ isLeftHalf: false });
    const { container } = renderWithProviders(<OverlayTabs />);

    const wrapper = container.firstElementChild as HTMLElement;
    const children = Array.from(wrapper.children);

    const actionButtonsIndex = children.findIndex((el) =>
      el.querySelector('[data-tip="Close Overlay"]'),
    );
    const tabBarIndex = children.findIndex(
      (el) => el.getAttribute("role") === "tablist",
    );

    expect(actionButtonsIndex).toBeGreaterThanOrEqual(0);
    expect(tabBarIndex).toBeGreaterThanOrEqual(0);
    expect(tabBarIndex).toBeLessThan(actionButtonsIndex);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Beam
// ═══════════════════════════════════════════════════════════════════════════

describe("Beam", () => {
  it("renders with lootBeam class", () => {
    setupStore();
    const { container } = renderWithProviders(<Beam />);

    const beamEl = container.querySelector(".lootBeam");
    expect(beamEl).toBeInTheDocument();
  });

  it("uses leftHalf streak class when isLeftHalf", () => {
    setupStore({ isLeftHalf: true });
    const { container } = renderWithProviders(<Beam />);

    const streak = container.querySelector(".lootBeam__streak--leftHalf");
    expect(streak).toBeInTheDocument();
  });

  it("uses rightHalf streak class when not isLeftHalf", () => {
    setupStore({ isLeftHalf: false });
    const { container } = renderWithProviders(<Beam />);

    const streak = container.querySelector(".lootBeam__streak--rightHalf");
    expect(streak).toBeInTheDocument();
  });

  it("sets --beam CSS variable when color provided", () => {
    setupStore();
    const { container } = renderWithProviders(<Beam color="orangered" />);

    const beamEl = container.querySelector(".lootBeam") as HTMLElement;
    expect(beamEl.style.getPropertyValue("--beam")).toBe("orangered");
  });

  it("does not set style when no color", () => {
    setupStore();
    const { container } = renderWithProviders(<Beam />);

    const beamEl = container.querySelector(".lootBeam") as HTMLElement;
    expect(beamEl.getAttribute("style")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DropBeamColumn
// ═══════════════════════════════════════════════════════════════════════════

describe("DropBeamColumn", () => {
  it("renders beam when showBeam is true", () => {
    setupStore();
    const { container } = renderWithProviders(
      <DropBeamColumn
        showBeam={true}
        beamColor="#gold"
        isUnknownRarity={false}
      />,
    );

    // Real Beam renders an element with .lootBeam class
    const beamEl = container.querySelector(".lootBeam");
    expect(beamEl).toBeInTheDocument();
  });

  it("does not render beam when showBeam is false", () => {
    setupStore();
    const { container } = renderWithProviders(
      <DropBeamColumn showBeam={false} isUnknownRarity={false} />,
    );

    const beamEl = container.querySelector(".lootBeam");
    expect(beamEl).not.toBeInTheDocument();
  });

  it("shows warning icon when isUnknownRarity", () => {
    setupStore();
    const { container } = renderWithProviders(
      <DropBeamColumn showBeam={false} isUnknownRarity={true} />,
    );

    const warningTooltip = container.querySelector(
      '[data-tip="Low confidence price"]',
    );
    expect(warningTooltip).toBeInTheDocument();
  });

  it("does not show warning when known rarity", () => {
    setupStore();
    const { container } = renderWithProviders(
      <DropBeamColumn showBeam={false} isUnknownRarity={false} />,
    );

    const warningTooltip = container.querySelector(
      '[data-tip="Low confidence price"]',
    );
    expect(warningTooltip).not.toBeInTheDocument();
  });

  it("passes beamColor to Beam component", () => {
    setupStore();
    const { container } = renderWithProviders(
      <DropBeamColumn
        showBeam={true}
        beamColor="orangered"
        isUnknownRarity={false}
      />,
    );

    const beamEl = container.querySelector(".lootBeam") as HTMLElement;
    expect(beamEl).toBeInTheDocument();
    expect(beamEl.style.getPropertyValue("--beam")).toBe("orangered");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DropContentColumn
// ═══════════════════════════════════════════════════════════════════════════

describe("DropContentColumn", () => {
  const defaultRarityStyles = {
    bgGradient: "",
    border: "",
    text: "rgb(0, 0, 255)",
    beam: "",
    showBeam: false,
    badgeBg: "",
    badgeText: "",
    badgeBorder: "",
  };

  it("renders card name", () => {
    setupStore();
    renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={defaultRarityStyles}
      />,
    );

    expect(screen.getByText("The Doctor")).toBeInTheDocument();
  });

  it("renders price value when chaosValue > 0", () => {
    setupStore();
    renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={defaultRarityStyles}
      />,
    );

    expect(vi.mocked(formatCurrency)).toHaveBeenCalledWith(1000, 200);
    expect(screen.getByText("1000c")).toBeInTheDocument();
  });

  it('shows "—" when chaosValue is 0', () => {
    setupStore();
    renderWithProviders(
      <DropContentColumn
        cardName="The Void"
        chaosValue={0}
        rarityStyles={defaultRarityStyles}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("clicking card name calls openCardInMainWindow", async () => {
    setupStore();
    const { user } = renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={defaultRarityStyles}
      />,
    );

    await user.click(screen.getByText("The Doctor"));

    expect(
      window.electron?.cardDetails?.openCardInMainWindow,
    ).toHaveBeenCalledWith("The Doctor");
  });

  it("applies rarity text color style", () => {
    setupStore();
    const styles = {
      ...defaultRarityStyles,
      text: "rgb(255, 0, 0)",
    };
    renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={styles}
      />,
    );

    const cardName = screen.getByText("The Doctor");
    expect(cardName).toHaveStyle({ color: "rgb(255, 0, 0)" });
  });

  it("applies rarity border styles when border is provided", () => {
    setupStore();
    const styles = {
      ...defaultRarityStyles,
      border: "rgb(0, 0, 255)",
      bgGradient: "linear-gradient(to right, transparent, blue)",
    };
    const { container } = renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={styles}
      />,
    );

    const wrapper = container.querySelector(".font-fontin") as HTMLElement;
    expect(wrapper).toHaveStyle({
      borderColor: "rgb(0, 0, 255)",
      borderWidth: "1px",
      borderStyle: "solid",
    });
  });

  it("uses flex-row-reverse when isLeftHalf is true", () => {
    setupStore({ isLeftHalf: true });
    const { container } = renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={defaultRarityStyles}
      />,
    );

    const wrapper = container.querySelector(".font-fontin") as HTMLElement;
    expect(wrapper.className).toContain("flex-row-reverse");
  });

  it("uses flex-row when isLeftHalf is false", () => {
    setupStore({ isLeftHalf: false });
    const { container } = renderWithProviders(
      <DropContentColumn
        cardName="The Doctor"
        chaosValue={1000}
        rarityStyles={defaultRarityStyles}
      />,
    );

    const wrapper = container.querySelector(".font-fontin") as HTMLElement;
    expect(wrapper.className).toContain("flex-row");
    expect(wrapper.className).not.toContain("flex-row-reverse");
  });
});
