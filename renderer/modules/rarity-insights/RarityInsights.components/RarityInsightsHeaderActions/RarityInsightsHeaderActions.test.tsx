import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { usePoeNinja, useSettings } from "~/renderer/store";

import RarityInsightsHeaderActions from "./RarityInsightsHeaderActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSettings: vi.fn(),
  usePoeNinja: vi.fn(),
}));

const mockUseSettings = vi.mocked(useSettings);
const mockUsePoeNinja = vi.mocked(usePoeNinja);

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
vi.mock("../RarityInsightsSidebar/RarityInsightsSidebar", () => ({
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

function setupStore(
  overrides: {
    isRefreshing?: boolean;
    refreshableAt?: string | null;
    game?: string;
    league?: string | null;
  } = {},
) {
  mockUseSettings.mockReturnValue({
    getSelectedGame: () => overrides.game ?? "poe2",
    getActiveGameViewSelectedLeague: () =>
      "league" in overrides ? overrides.league : "Standard",
  } as any);
  mockUsePoeNinja.mockReturnValue({
    isRefreshing: overrides.isRefreshing ?? false,
    refreshPrices: mockRefreshPrices,
    getRefreshableAt: () => overrides.refreshableAt ?? null,
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityInsightsHeaderActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockRefreshPrices.mockClear();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the search input", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("renders the search input with correct placeholder", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByTestId("search-input")).toHaveAttribute(
        "placeholder",
        "Search cards...",
      );
    });

    it("renders the Refresh poe.ninja button", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByText("Refresh poe.ninja")).toBeInTheDocument();
    });

    it("does not render a standalone Scan button", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.queryByText("Scan")).not.toBeInTheDocument();
    });

    it("renders the sidebar dropdown", () => {
      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
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
        />,
      );

      await user.type(screen.getByTestId("search-input"), "doctor");

      expect(onGlobalFilterChange).toHaveBeenCalled();
    });

    it("disables search when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });

    it("enables search when not refreshing", () => {
      setupStore({ isRefreshing: false });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByTestId("search-input")).not.toBeDisabled();
    });
  });

  // ── Refresh button ─────────────────────────────────────────────────────

  describe("refresh button", () => {
    it("is enabled when not on cooldown and not refreshing", () => {
      setupStore({ isRefreshing: false });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const refreshButton = screen
        .getByText("Refresh poe.ninja")
        .closest("button");
      expect(refreshButton).not.toBeDisabled();
    });

    it("is disabled when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const refreshingButton = screen
        .getByText("Refreshing...")
        .closest("button");
      expect(refreshingButton).toBeDisabled();
    });

    it("shows Refreshing... text when isRefreshing is true", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    it("calls refreshPrices when clicked", async () => {
      setupStore({ isRefreshing: false });
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      await user.click(
        screen.getByText("Refresh poe.ninja").closest("button")!,
      );

      expect(mockRefreshPrices).toHaveBeenCalledWith("poe2", "Standard");
    });

    it("does not allow refresh when isRefreshing is true (button disabled)", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const refreshingButton = screen
        .getByText("Refreshing...")
        .closest("button");
      expect(refreshingButton).toBeDisabled();
    });

    it("guards refreshPrices when league is null", async () => {
      setupStore({ league: null });
      const { user } = renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      await user.click(
        screen.getByText("Refresh poe.ninja").closest("button")!,
      );

      expect(mockRefreshPrices).not.toHaveBeenCalled();
    });
  });

  // ── Refresh button cooldown ────────────────────────────────────────────

  describe("refresh button cooldown", () => {
    it("is disabled when on cooldown", () => {
      mockUseTickingTimer.mockReturnValue({
        hours: 0,
        minutes: 2,
        seconds: 30,
        totalMs: 150000,
        isComplete: false,
      });

      setupStore();
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByTestId("countdown")).toBeInTheDocument();

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
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const cooldownButton = screen.getByTestId("countdown").closest("button");
      expect(cooldownButton).toBeDisabled();
    });
  });

  // ── Integration: combined states ──────────────────────────────────────

  describe("combined states", () => {
    it("disables search when refreshing", () => {
      setupStore({ isRefreshing: true });
      renderWithProviders(
        <RarityInsightsHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });
  });
});
