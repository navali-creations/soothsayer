import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PFHeaderActions from "./PFHeaderActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("../PFHelpModal/PFHelpModal", () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="help-modal">
        <button data-testid="help-modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock("~/renderer/hooks", () => ({
  useTickingTimer: vi.fn(() => ({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
    isComplete: true,
  })),
  formatTickingTimer: vi.fn(() => "0m 00s"),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: any;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Countdown: () => <span data-testid="countdown">00:00</span>,
  Search: ({
    onChange,
    debounceMs,
    disabled,
    placeholder,
    ...props
  }: {
    onChange?: (value: string) => void;
    debounceMs?: number;
    disabled?: boolean;
    placeholder?: string;
    [key: string]: any;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    settings: {
      getSelectedGame: vi.fn(() => "poe2"),
      getActiveGameViewSelectedLeague: vi.fn(() => "Standard"),
      ...overrides.settings,
    },
    poeNinja: {
      isRefreshing: false,
      refreshPrices: vi.fn(async () => {}),
      getRefreshableAt: vi.fn(() => null),
      ...overrides.poeNinja,
    },
    profitForecast: {
      isLoading: false,
      isComputing: false,
      fetchData: vi.fn(async () => {}),
      ...overrides.profitForecast,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFHeaderActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Help Modal ─────────────────────────────────────────────────────────

  describe("Help Modal", () => {
    it("does not show help modal by default", () => {
      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(screen.queryByTestId("help-modal")).not.toBeInTheDocument();
    });

    it("opens help modal when help button is clicked", async () => {
      setupStore();
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      // The help button has FiHelpCircle icon — find button by its role
      const buttons = screen.getAllByRole("button");
      // Help button is the first button in the action bar
      const helpButton = buttons[0];

      await user.click(helpButton);

      expect(screen.getByTestId("help-modal")).toBeInTheDocument();
    });

    it("closes help modal when modal close callback fires", async () => {
      setupStore();
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      // Open the modal
      const buttons = screen.getAllByRole("button");
      await user.click(buttons[0]);
      expect(screen.getByTestId("help-modal")).toBeInTheDocument();

      // Close via the modal's close button
      await user.click(screen.getByTestId("help-modal-close"));
      expect(screen.queryByTestId("help-modal")).not.toBeInTheDocument();
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────

  describe("Search", () => {
    it("renders a search input with placeholder", () => {
      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(screen.getByTestId("search-input")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search cards..."),
      ).toBeInTheDocument();
    });

    it("calls onGlobalFilterChange when user types", async () => {
      setupStore();
      const onGlobalFilterChange = vi.fn();
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={onGlobalFilterChange} />,
      );

      const searchInput = screen.getByTestId("search-input");
      await user.type(searchInput, "Doctor");

      // Our mock Search directly calls onChange, so the callback fires per character
      expect(onGlobalFilterChange).toHaveBeenCalled();
    });

    it("search is disabled when isRefreshing is true", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });

    it("search is disabled when isLoading is true", () => {
      setupStore({ profitForecast: { isLoading: true } });
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });

    it("search is disabled when isComputing is true", () => {
      setupStore({ profitForecast: { isComputing: true } });
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(screen.getByTestId("search-input")).toBeDisabled();
    });

    it("search is enabled when nothing is loading", () => {
      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(screen.getByTestId("search-input")).not.toBeDisabled();
    });
  });

  // ── Refresh Button ─────────────────────────────────────────────────────

  describe("Refresh Button", () => {
    it("renders a refresh button with 'Refresh poe.ninja' text when idle", () => {
      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: /Refresh poe\.ninja/i }),
      ).toBeInTheDocument();
    });

    it("refresh button is enabled when not on cooldown, not refreshing, not loading", () => {
      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      const refreshBtn = screen.getByRole("button", {
        name: /Refresh poe\.ninja/i,
      });
      expect(refreshBtn).not.toBeDisabled();
    });

    it("refresh button is disabled when isRefreshing is true", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      const refreshBtn = screen.getByRole("button", {
        name: /Refreshing/i,
      });
      expect(refreshBtn).toBeDisabled();
    });

    it("refresh button is disabled when isLoading is true", () => {
      setupStore({ profitForecast: { isLoading: true } });
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      const refreshBtn = screen.getByRole("button", {
        name: /Refresh poe\.ninja/i,
      });
      expect(refreshBtn).toBeDisabled();
    });

    it("shows 'Refreshing...' text when isRefreshing", () => {
      setupStore({ poeNinja: { isRefreshing: true } });
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: /Refreshing/i }),
      ).toBeInTheDocument();
    });

    it("calls refreshPrices and fetchData on click", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const refreshBtn = screen.getByRole("button", {
        name: /Refresh poe\.ninja/i,
      });
      await user.click(refreshBtn);

      await waitFor(() => {
        expect(store.poeNinja.refreshPrices).toHaveBeenCalledWith(
          "poe2",
          "Standard",
        );
      });

      await waitFor(() => {
        expect(store.profitForecast.fetchData).toHaveBeenCalledWith(
          "poe2",
          "Standard",
        );
      });
    });

    it("does not call refreshPrices when league is falsy", async () => {
      const store = setupStore({
        settings: {
          getActiveGameViewSelectedLeague: vi.fn(() => null),
        },
      });
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const refreshBtn = screen.getByRole("button", {
        name: /Refresh poe\.ninja/i,
      });
      await user.click(refreshBtn);

      expect(store.poeNinja.refreshPrices).not.toHaveBeenCalled();
    });
  });

  // ── Cooldown ───────────────────────────────────────────────────────────

  describe("Cooldown", () => {
    it("disables refresh button when on cooldown", async () => {
      // To simulate cooldown, we need to override useTickingTimer
      const { useTickingTimer: mockTimer } = await import("~/renderer/hooks");
      vi.mocked(mockTimer).mockReturnValue({
        hours: 0,
        minutes: 2,
        seconds: 30,
        totalMs: 150_000,
        isComplete: false,
      } as any);

      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      // When on cooldown, the button should be disabled
      const buttons = screen.getAllByRole("button");
      // The last button is the refresh button
      const refreshBtn = buttons[buttons.length - 1];
      expect(refreshBtn).toBeDisabled();
    });

    it("does not call refreshPrices when on cooldown", async () => {
      const { useTickingTimer: mockTimer } = await import("~/renderer/hooks");
      vi.mocked(mockTimer).mockReturnValue({
        hours: 0,
        minutes: 1,
        seconds: 0,
        totalMs: 60_000,
        isComplete: false,
      } as any);

      const store = setupStore();
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const buttons = screen.getAllByRole("button");
      const refreshBtn = buttons[buttons.length - 1];
      await user.click(refreshBtn);

      expect(store.poeNinja.refreshPrices).not.toHaveBeenCalled();
    });
  });

  // ── Integration ────────────────────────────────────────────────────────

  describe("Integration", () => {
    beforeEach(async () => {
      // Reset useTickingTimer mock in case Cooldown tests changed it
      const hooks = await import("~/renderer/hooks");
      vi.mocked(hooks.useTickingTimer).mockReturnValue({
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalMs: 0,
        isComplete: true,
      } as any);
    });

    it("renders all three controls: help button, search, refresh button", () => {
      setupStore();
      renderWithProviders(<PFHeaderActions onGlobalFilterChange={vi.fn()} />);

      // At least 2 buttons (help + refresh)
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);

      // Search input
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("passes the correct game and league to store methods", async () => {
      const store = setupStore({
        settings: {
          getSelectedGame: vi.fn(() => "poe1"),
          getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
        },
      });
      const { user } = renderWithProviders(
        <PFHeaderActions onGlobalFilterChange={vi.fn()} />,
      );

      const refreshBtn = screen.getByRole("button", {
        name: /Refresh poe\.ninja/i,
      });
      await user.click(refreshBtn);

      await waitFor(() => {
        expect(store.poeNinja.refreshPrices).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
        );
      });

      await waitFor(() => {
        expect(store.profitForecast.fetchData).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
        );
      });
    });
  });
});
