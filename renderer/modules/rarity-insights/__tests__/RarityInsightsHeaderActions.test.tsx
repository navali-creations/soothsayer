import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import RarityInsightsHeaderActions from "../RarityInsights.components/RarityInsightsHeaderActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// Mock the hooks module to control the ticking timer
vi.mock("~/renderer/hooks", () => ({
  useTickingTimer: vi.fn(() => ({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
    isComplete: true,
  })),
  formatTickingTimer: vi.fn(() => "0s"),
}));

// Mock the RarityInsightsSidebar so we don't pull in its store dependencies
vi.mock("../RarityInsights.components/RarityInsightsSidebar", () => ({
  default: () => <div data-testid="sidebar-dropdown">Sidebar</div>,
}));

// Mock the components barrel to provide simple Search, Button, and Countdown
vi.mock("~/renderer/components", () => ({
  Search: ({ onChange, placeholder, disabled, ...rest }: any) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e: any) => onChange?.(e.target.value)}
      {...rest}
    />
  ),
  Button: ({ children, disabled, onClick, ...rest }: any) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Countdown: ({ timer }: any) => (
    <span data-testid="countdown">{timer?.totalMs ?? 0}ms</span>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

import { useTickingTimer } from "~/renderer/hooks";

const mockUseTickingTimer = vi.mocked(useTickingTimer);
const mockRefreshPrices = vi.fn().mockResolvedValue(undefined);
const mockRescan = vi.fn().mockResolvedValue(undefined);

function setupStore(
  overrides: {
    isRefreshing?: boolean;
    isScanning?: boolean;
    refreshableAt?: string | null;
    game?: string;
    league?: string | null;
  } = {},
) {
  mockUseBoundStore.mockReturnValue({
    settings: {
      getSelectedGame: () => overrides.game ?? "poe2",
      getActiveGameViewSelectedLeague: () =>
        "league" in overrides ? overrides.league : "Standard",
    },
    poeNinja: {
      isRefreshing: overrides.isRefreshing ?? false,
      refreshPrices: mockRefreshPrices,
      getRefreshableAt: () => overrides.refreshableAt ?? null,
    },
    rarityInsights: {
      isScanning: overrides.isScanning ?? false,
    },
    rarityInsightsComparison: {
      rescan: mockRescan,
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityInsightsHeaderActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockRefreshPrices.mockClear();
    mockRescan.mockClear();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the search input", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("renders the search input with correct placeholder", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByTestId("search-input")).toHaveAttribute(
        "placeholder",
        "Search cards...",
      );
    });

    it("renders the Refresh poe.ninja button", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByText("Refresh poe.ninja")).toBeInTheDocument();
    });

    it("renders the Scan button", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByText("Scan")).toBeInTheDocument();
    });

    it("renders the sidebar dropdown", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByTestId("sidebar-dropdown")).toBeInTheDocument();
    });
  });

  // ── Search input ───────────────────────────────────────────────────────

  describe("search input", () => {
    it("calls onGlobalFilterChange when text is typed", async () => {
      setupStore();
      const onGlobalFilterChange = vi.fn();
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={onGlobalFilterChange}
          isParsing={false}
        />,
      );

      await user.type(screen.getByTestId("search-input"), "doctor");

      expect(onGlobalFilterChange).toHaveBeenCalled();
    });

    it("disables search when isParsing is true", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={true}
        />,
      );

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });

    it("disables search when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });

    it("enables search when neither parsing nor refreshing", () => {
      setupStore({ isRefreshing: false });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByTestId("search-input")).not.toBeDisabled();
    });
  });

  // ── Refresh button ─────────────────────────────────────────────────────

  describe("refresh button", () => {
    it("is enabled when not on cooldown and not refreshing", () => {
      setupStore({ isRefreshing: false });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const refreshButton = screen
        .getByText("Refresh poe.ninja")
        .closest("button");
      expect(refreshButton).not.toBeDisabled();
    });

    it("is disabled when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const refreshingButton = screen
        .getByText("Refreshing...")
        .closest("button");
      expect(refreshingButton).toBeDisabled();
    });

    it("shows Refreshing... text when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    it("calls refreshPrices when clicked", async () => {
      setupStore({ isRefreshing: false });
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      await user.click(
        screen.getByText("Refresh poe.ninja").closest("button")!,
      );

      expect(mockRefreshPrices).toHaveBeenCalledWith("poe2", "Standard");
    });

    it("does not allow refresh when isRefreshing is true (button disabled)", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const refreshingButton = screen
        .getByText("Refreshing...")
        .closest("button");
      expect(refreshingButton).toBeDisabled();
    });

    it("guards refreshPrices when league is null", async () => {
      setupStore({ league: null });
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      // The button is enabled (no cooldown, not refreshing), but the
      // handler's `if (!league) return` guard prevents the call.
      await user.click(
        screen.getByText("Refresh poe.ninja").closest("button")!,
      );

      expect(mockRefreshPrices).not.toHaveBeenCalled();
    });
  });

  // ── Refresh button cooldown ────────────────────────────────────────────

  describe("refresh button cooldown", () => {
    it("is disabled when on cooldown", () => {
      // Override useTickingTimer to simulate an active cooldown
      mockUseTickingTimer.mockReturnValue({
        hours: 0,
        minutes: 2,
        seconds: 30,
        totalMs: 150000,
        isComplete: false,
      });

      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      // When on cooldown, the countdown component is rendered instead of "Refresh poe.ninja"
      expect(screen.getByTestId("countdown")).toBeInTheDocument();

      // The button containing the countdown should be disabled
      const cooldownButton = screen.getByTestId("countdown").closest("button");
      expect(cooldownButton).toBeDisabled();
    });

    it("does not allow refresh when on cooldown (button disabled)", () => {
      mockUseTickingTimer.mockReturnValue({
        hours: 0,
        minutes: 1,
        seconds: 0,
        totalMs: 60000,
        isComplete: false,
      });

      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const cooldownButton = screen.getByTestId("countdown").closest("button");
      expect(cooldownButton).toBeDisabled();
    });
  });

  // ── Scan button ────────────────────────────────────────────────────────

  describe("scan button", () => {
    it("shows Scan text when not scanning", () => {
      setupStore({ isScanning: false });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByText("Scan")).toBeInTheDocument();
    });

    it("shows Scanning... text when isScanning is true", () => {
      setupStore({ isScanning: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByText("Scanning...")).toBeInTheDocument();
    });

    it("is disabled when isScanning is true", () => {
      setupStore({ isScanning: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const scanButton = screen.getByText("Scanning...").closest("button");
      expect(scanButton).toBeDisabled();
    });

    it("is disabled when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const scanButton = screen.getByText("Scan").closest("button");
      expect(scanButton).toBeDisabled();
    });

    it("is enabled when neither scanning nor refreshing", () => {
      setupStore({ isScanning: false, isRefreshing: false });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const scanButton = screen.getByText("Scan").closest("button");
      expect(scanButton).not.toBeDisabled();
    });

    it("calls rescan when clicked", async () => {
      setupStore({ isScanning: false, isRefreshing: false });
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      await user.click(screen.getByText("Scan").closest("button")!);

      expect(mockRescan).toHaveBeenCalled();
    });

    it("does not allow rescan when isScanning is true (button disabled)", () => {
      setupStore({ isScanning: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const scanButton = screen.getByText("Scanning...").closest("button");
      expect(scanButton).toBeDisabled();
    });

    it("does not allow rescan when isRefreshing is true (button disabled)", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      const scanButton = screen.getByText("Scan").closest("button");
      expect(scanButton).toBeDisabled();
    });

    it("guards rescan when isParsing is true (onClick guard)", async () => {
      setupStore({ isScanning: false, isRefreshing: false });
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={true}
        />,
      );

      // The button is NOT disabled by isParsing (only isScanning/isRefreshing disable it),
      // but the onClick guard checks !isScanning && !isParsing before calling rescan.
      const scanButton = screen.getByText("Scan").closest("button");
      expect(scanButton).not.toBeDisabled();

      await user.click(scanButton!);

      expect(mockRescan).not.toHaveBeenCalled();
    });
  });

  // ── Integration: combined states ──────────────────────────────────────

  describe("combined states", () => {
    it("disables both search and scan when refreshing", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={false}
        />,
      );

      expect(screen.getByTestId("search-input")).toBeDisabled();
      const scanButton = screen.getByText("Scan").closest("button");
      expect(scanButton).toBeDisabled();
    });

    it("disables search but not scan when parsing", () => {
      setupStore({ isRefreshing: false, isScanning: false });
      renderWithProviders(
        <RarityInsightsHeaderActions
          onGlobalFilterChange={vi.fn()}
          isParsing={true}
        />,
      );

      expect(screen.getByTestId("search-input")).toBeDisabled();
      const scanButton = screen.getByText("Scan").closest("button");
      expect(scanButton).not.toBeDisabled();
    });
  });
});
