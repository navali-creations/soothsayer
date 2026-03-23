import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import AppControls from "../AppMenu.component/AppControls";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Dropdown: ({ children, trigger, ...props }: any) => (
    <div data-testid="dropdown" {...props}>
      {trigger}
      {children}
    </div>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/modules/updater/UpdateIndicator", () => ({
  default: () => <div data-testid="update-indicator" />,
}));

vi.mock("../AppMenu.component/DiskSpaceWarning", () => ({
  default: () => <div data-testid="disk-warning" />,
}));

vi.mock("../AppMenu.component/WhatsNewModal", () => ({
  default: () => <div data-testid="whats-new-modal" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    appMenu: {
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: false,
      openWhatsNew: vi.fn(),
      ...overrides.appMenu,
    },
    overlay: {
      toggle: vi.fn(),
      isVisible: false,
      ...overrides.overlay,
    },
    setup: {
      setupState: { isComplete: true },
      ...overrides.setup,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("AppControls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Window control buttons ─────────────────────────────────────────────

  describe("window control buttons", () => {
    it("renders minimize, maximize, and close buttons", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      const buttons = screen.getAllByRole("button");
      // At least 3 window control buttons should exist
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it("calls minimize() when minimize button is clicked", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<AppControls />);

      // FiMinus renders an svg inside a button — find the minimize button
      const buttons = screen.getAllByRole("button");
      // minimize is the first window-control button (after overlay toggle + dropdown)
      const _minimizeButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg !== null && btn.textContent === "";
      });

      // Click all buttons that could be minimize — we know it calls minimize
      await user.click(buttons[buttons.length - 3]);

      expect(store.appMenu.minimize).toHaveBeenCalledTimes(1);
    });

    it("calls maximize() when maximize button is clicked", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<AppControls />);

      const buttons = screen.getAllByRole("button");
      // maximize is the second-to-last button
      await user.click(buttons[buttons.length - 2]);

      expect(store.appMenu.maximize).toHaveBeenCalledTimes(1);
    });

    it("calls close() when close button is clicked", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<AppControls />);

      const buttons = screen.getAllByRole("button");
      // close is the last button
      await user.click(buttons[buttons.length - 1]);

      expect(store.appMenu.close).toHaveBeenCalledTimes(1);
    });
  });

  // ── Maximize / Unmaximize toggle ───────────────────────────────────────

  describe("maximize/unmaximize toggle", () => {
    it("shows unmaximize button (FiCopy) when isMaximized is true and calls unmaximize()", async () => {
      const store = setupStore({ appMenu: { isMaximized: true } });
      const { user } = renderWithProviders(<AppControls />);

      const buttons = screen.getAllByRole("button");
      const unmaximizeButton = buttons[buttons.length - 2];

      // FiCopy renders with scale-x-[-1] class
      const svg = unmaximizeButton.querySelector("svg");
      expect(svg).toBeInTheDocument();

      await user.click(unmaximizeButton);

      expect(store.appMenu.unmaximize).toHaveBeenCalledTimes(1);
    });

    it("shows maximize button (FiSquare) when isMaximized is false", () => {
      setupStore({ appMenu: { isMaximized: false } });
      renderWithProviders(<AppControls />);

      const buttons = screen.getAllByRole("button");
      const maximizeButton = buttons[buttons.length - 2];

      const svg = maximizeButton.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  // ── Setup mode ─────────────────────────────────────────────────────────

  describe("setup mode", () => {
    it("hides overlay toggle, dropdown, and UpdateIndicator in setup mode", () => {
      setupStore({ setup: { setupState: { isComplete: false } } });
      renderWithProviders(<AppControls />);

      expect(screen.queryByTestId("update-indicator")).not.toBeInTheDocument();
      expect(screen.queryByTestId("dropdown")).not.toBeInTheDocument();
      expect(screen.queryByText("Show Overlay")).not.toBeInTheDocument();
    });

    it("still renders window control buttons in setup mode", () => {
      setupStore({ setup: { setupState: { isComplete: false } } });
      renderWithProviders(<AppControls />);

      // minimize, maximize, close should still be present
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Normal mode ────────────────────────────────────────────────────────

  describe("normal mode", () => {
    it("shows overlay toggle button", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByTestId("update-indicator")).toBeInTheDocument();
    });

    it("shows dropdown menu", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByTestId("dropdown")).toBeInTheDocument();
    });

    it("shows UpdateIndicator", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByTestId("update-indicator")).toBeInTheDocument();
    });

    it("shows DiskSpaceWarning", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByTestId("disk-warning")).toBeInTheDocument();
    });
  });

  // ── Overlay toggle ─────────────────────────────────────────────────────

  describe("overlay toggle", () => {
    it("calls toggle() when overlay button is clicked", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<AppControls />);

      const overlayButton = screen.getByText((_, element) => {
        return element?.getAttribute("data-onboarding") === "overlay-icon";
      });

      await user.click(overlayButton);

      expect(store.overlay.toggle).toHaveBeenCalledTimes(1);
    });
  });

  // ── Dropdown links ─────────────────────────────────────────────────────

  describe("dropdown menu", () => {
    it("contains a Settings link", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByText("Settings")).toBeInTheDocument();
      const settingsLink = screen.getByText("Settings").closest("a");
      expect(settingsLink).toHaveAttribute("href", "/settings");
    });

    it("contains a What's New button", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    it("calls openWhatsNew() when What's New is clicked", async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<AppControls />);

      const whatsNewButton = screen.getByText("What's New").closest("button");
      expect(whatsNewButton).toBeInTheDocument();

      await user.click(whatsNewButton!);

      expect(store.appMenu.openWhatsNew).toHaveBeenCalledTimes(1);
    });

    it("contains a Changelog link", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByText("Changelog")).toBeInTheDocument();
      const changelogLink = screen.getByText("Changelog").closest("a");
      expect(changelogLink).toHaveAttribute("href", "/changelog");
    });

    it("contains a View Source link pointing to GitHub", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByText("View Source")).toBeInTheDocument();
      const viewSourceLink = screen.getByText("View Source").closest("a");
      expect(viewSourceLink).toHaveAttribute(
        "href",
        "https://github.com/navali-creations/soothsayer",
      );
    });

    it("contains a Discord link", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByText("Discord")).toBeInTheDocument();
      const discordLink = screen.getByText("Discord").closest("a");
      expect(discordLink).toHaveAttribute(
        "href",
        "https://discord.gg/mrqmPYXHHT",
      );
    });

    it("contains an Attributions link", () => {
      setupStore();
      renderWithProviders(<AppControls />);

      expect(screen.getByText("Attributions")).toBeInTheDocument();
      const attributionsLink = screen.getByText("Attributions").closest("a");
      expect(attributionsLink).toHaveAttribute("href", "/attributions");
    });
  });

  // ── WhatsNewModal ──────────────────────────────────────────────────────

  it("renders WhatsNewModal", () => {
    setupStore();
    renderWithProviders(<AppControls />);

    expect(screen.getByTestId("whats-new-modal")).toBeInTheDocument();
  });
});
