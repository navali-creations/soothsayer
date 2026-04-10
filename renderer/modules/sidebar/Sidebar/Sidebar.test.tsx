import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import Navigation from "../Sidebar.components/Nav";
import SessionStatus from "../Sidebar.components/SessionStatus";
import Sidebar from "./Sidebar";

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
    useCardDetails: () => useBoundStore().cardDetails,
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

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, style, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("~/renderer/components", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Countdown: ({ timer, ...props }: any) => (
    <div data-testid="countdown" {...props} />
  ),
}));

vi.mock("~/renderer/hooks", () => ({
  useTickingTimer: vi.fn(() => ({
    hours: 1,
    minutes: 30,
    seconds: 45,
    totalMs: 5445000,
    isComplete: false,
  })),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);
const mockUseTickingTimer = vi.mocked(useTickingTimer);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    currentSession: {
      getIsCurrentSessionActive: vi.fn(() => true),
      getSessionInfo: vi.fn(() => ({
        startedAt: "2024-01-01T00:00:00Z",
        league: "Standard",
      })),
      ...overrides.currentSession,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the sidebar <aside> element", () => {
    setupStore();
    renderWithProviders(<Sidebar />);

    const aside = document.querySelector("aside");
    expect(aside).toBeInTheDocument();
  });

  it("renders the Navigation component", () => {
    setupStore();
    renderWithProviders(<Sidebar />);

    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
  });

  it("renders the SessionStatus component", () => {
    setupStore();
    renderWithProviders(<Sidebar />);

    expect(screen.getByText("Session")).toBeInTheDocument();
  });

  it("renders both Navigation and SessionStatus when session is active", () => {
    setupStore();
    renderWithProviders(<Sidebar />);

    expect(document.querySelector("aside")).toBeInTheDocument();
    expect(document.querySelector("nav")).toBeInTheDocument();
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders sidebar when session is inactive", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => false),
        getSessionInfo: vi.fn(() => null),
      },
    });
    renderWithProviders(<Sidebar />);

    expect(document.querySelector("aside")).toBeInTheDocument();
    expect(document.querySelector("nav")).toBeInTheDocument();
  });
});

// ─── Navigation Tests ──────────────────────────────────────────────────────

describe("Navigation", () => {
  const expectedLinks = [
    { to: "/", text: "Current Session" },
    { to: "/sessions", text: "Sessions" },
    { to: "/statistics", text: "Statistics" },
    { to: "/cards", text: "Cards" },
    { to: "/profit-forecast", text: "Profit Forecast" },
    { to: "/rarity-insights", text: "Rarity Insights" },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a <nav> element", () => {
    renderWithProviders(<Navigation />);

    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
  });

  it("renders all 6 navigation links", () => {
    renderWithProviders(<Navigation />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
  });

  it.each(expectedLinks)('renders a link to "$to" with text "$text"', ({
    to,
    text,
  }) => {
    renderWithProviders(<Navigation />);

    const link = screen.getByText(text).closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", to);
  });

  it("renders links inside list items", () => {
    renderWithProviders(<Navigation />);

    const listItems = document.querySelectorAll("nav ul li");
    expect(listItems).toHaveLength(6);
  });
});

// ─── SessionStatus Tests ───────────────────────────────────────────────────

describe("SessionStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the "Session" label', () => {
    setupStore();
    renderWithProviders(<SessionStatus />);

    expect(screen.getByText("Session")).toBeInTheDocument();
  });

  it('renders "Active" text', () => {
    setupStore();
    renderWithProviders(<SessionStatus />);

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it('renders the "Duration" label', () => {
    setupStore();
    renderWithProviders(<SessionStatus />);

    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("renders the Countdown component", () => {
    setupStore();
    renderWithProviders(<SessionStatus />);

    expect(screen.getByTestId("countdown")).toBeInTheDocument();
  });

  it("calls useTickingTimer with correct params when session is active", () => {
    setupStore();
    renderWithProviders(<SessionStatus />);

    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: "2024-01-01T00:00:00Z",
      direction: "up",
      enabled: true,
    });
  });

  it("calls useTickingTimer with enabled: false when session is inactive", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => false),
        getSessionInfo: vi.fn(() => null),
      },
    });
    renderWithProviders(<SessionStatus />);

    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: null,
      direction: "up",
      enabled: false,
    });
  });

  it("calls useTickingTimer with enabled: false when session info is null but active flag is true", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
        getSessionInfo: vi.fn(() => null),
      },
    });
    renderWithProviders(<SessionStatus />);

    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: null,
      direction: "up",
      enabled: false,
    });
  });

  it("uses startedAt from session info as the reference time", () => {
    const customStartedAt = "2024-06-15T12:30:00Z";
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
        getSessionInfo: vi.fn(() => ({
          startedAt: customStartedAt,
          league: "Settlers",
        })),
      },
    });
    renderWithProviders(<SessionStatus />);

    expect(mockUseTickingTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceTime: customStartedAt,
      }),
    );
  });

  it("renders all expected elements together", () => {
    setupStore();
    renderWithProviders(<SessionStatus />);

    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByTestId("countdown")).toBeInTheDocument();
  });
});
