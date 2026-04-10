import React from "react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import WhatsNewModal from "./WhatsNewModal";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => {
  const useBoundStore = vi.fn();
  return {
    useBoundStore,
    useCurrentSession: () => useBoundStore().currentSession,
    useSettings: () => useBoundStore().settings,
    usePoeNinja: () => useBoundStore().poeNinja,
    useSessionDetails: () => useBoundStore().sessionDetails,
    useOverlay: () => useBoundStore().overlay,
    useAppMenu: () => useBoundStore().appMenu,
    useSetup: () => useBoundStore().setup,
    useStorage: () => useBoundStore().storage,
    useGameInfo: () => useBoundStore().gameInfo,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useRootActions: () => {
      const s = useBoundStore();
      return {
        hydrate: s.hydrate,
        startListeners: s.startListeners,
        reset: s.reset,
      };
    },
    useSlice: (key: string) => useBoundStore()?.[key],
  };
});

vi.mock("~/renderer/components", () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
  MarkdownRenderer: ({ children }: any) => (
    <div data-testid="markdown">{children}</div>
  ),
  Modal: React.forwardRef(({ children, onClose, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ open: vi.fn(), close: vi.fn() }));
    return (
      <div data-testid="modal" {...props}>
        {children}
      </div>
    );
  }),
}));

vi.mock("~/renderer/modules/changelog/Changelog.utils/Changelog.utils", () => ({
  CORE_MAINTAINERS: new Set(),
  changeTypeColor: (type: string) => type,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    appMenu: {
      isWhatsNewOpen: false,
      whatsNewRelease: null,
      whatsNewIsLoading: false,
      whatsNewError: null,
      closeWhatsNew: vi.fn(),
      ...overrides.appMenu,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("WhatsNewModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "What\'s New" title when no release', () => {
    setupStore();
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByText("What's New")).toBeInTheDocument();
  });

  it("shows release name when whatsNewRelease exists", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          name: "v1.5.0",
          body: "Some changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByText("v1.5.0")).toBeInTheDocument();
    expect(screen.queryByText("What's New")).not.toBeInTheDocument();
  });

  it("shows loading spinner when whatsNewIsLoading is true", () => {
    setupStore({
      appMenu: {
        whatsNewIsLoading: true,
      },
    });
    renderWithProviders(<WhatsNewModal />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("shows error alert when whatsNewError is set", () => {
    setupStore({
      appMenu: {
        whatsNewError: "Could not fetch release information.",
        whatsNewIsLoading: false,
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(
      screen.getByText("Could not fetch release information."),
    ).toBeInTheDocument();
    const alert = document.querySelector(".alert-error");
    expect(alert).toBeInTheDocument();
  });

  it("does not show error alert when loading", () => {
    setupStore({
      appMenu: {
        whatsNewError: "Some error",
        whatsNewIsLoading: true,
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByText("Some error")).not.toBeInTheDocument();
  });

  it("shows release body content via MarkdownRenderer", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          name: "v1.5.0",
          body: "## Changes\n- Feature A",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByTestId("markdown")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      /## Changes.*Feature A/,
    );
  });

  it('shows "No detailed changes available" when release has no body', () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          name: "v1.5.0",
          body: "",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(
      screen.getByText("No detailed changes available for this release."),
    ).toBeInTheDocument();
  });

  it("shows release date when publishedAt exists", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          name: "v1.5.0",
          body: "Changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    // The component formats the date using toLocaleDateString
    const dateEl = screen.getByText(/Released/);
    expect(dateEl).toBeInTheDocument();
    // The date string will contain "June" and "2024" in most locales
    expect(dateEl.textContent).toContain("2024");
  });

  it("does not show release date when publishedAt is missing", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          name: "v1.5.0",
          body: "Changes",
          changeType: "minor",
          publishedAt: null,
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByText(/Released/)).not.toBeInTheDocument();
  });

  it("shows Close button that calls closeWhatsNew()", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<WhatsNewModal />);

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeInTheDocument();

    await user.click(closeButton);

    expect(store.appMenu.closeWhatsNew).toHaveBeenCalledTimes(1);
  });

  it("shows change type badge when release exists", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          name: "v1.5.0",
          body: "Changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    const badge = screen.getByTestId("badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("minor");
  });

  it("does not show change type badge when no release", () => {
    setupStore();
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("renders the modal container", () => {
    setupStore();
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });
});
