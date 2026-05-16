import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import { Nav } from "../Sidebar.components/Nav/Nav";
import { SessionStatus } from "../Sidebar.components/SessionStatus/SessionStatus";
import Sidebar from "./Sidebar";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("motion/react", async () => {
  const { createMotionMock } = await import(
    "~/renderer/__test-setup__/motion-mock"
  );
  return createMotionMock();
});

vi.mock("~/renderer/components", () => ({
  Link: ({ children, to, params, ...props }: any) => {
    const href =
      to === "/app-performance/$captureId" && params?.captureId
        ? `/app-performance/${params.captureId}`
        : to;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Countdown: ({ timer, ...props }: any) => (
    <div data-testid="countdown" {...props} />
  ),
}));

vi.mock("~/renderer/hooks", () => ({
  formatTickingTimer: (timer: {
    hours: number;
    minutes: number;
    seconds: number;
  }) =>
    timer.hours > 0
      ? `${timer.hours}h ${String(timer.minutes).padStart(2, "0")}m ${String(
          timer.seconds,
        ).padStart(2, "0")}s`
      : `${timer.minutes}m ${String(timer.seconds).padStart(2, "0")}s`,
  useChartColors: () => ({
    success: "#22c55e",
    warning: "#f59e0b",
    info: "#38bdf8",
    secondary: "#a855f7",
    primary: "#c026d3",
    bc40: "rgba(255,255,255,0.4)",
    bc30: "rgba(255,255,255,0.3)",
  }),
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
    settings: {
      appPerformanceMonitorEnabled: false,
      ...overrides.settings,
    },
    appPerformance: {
      captureHistory: [],
      captureId: null,
      captureStartedAt: null,
      isSampling: false,
      samples: [],
      ...overrides.appPerformance,
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
    setupStore();
    renderWithProviders(<Nav />);

    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
  });

  it("renders all 6 navigation links", () => {
    setupStore();
    renderWithProviders(<Nav />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
  });

  it.each(expectedLinks)('renders a link to "$to" with text "$text"', ({
    to,
    text,
  }) => {
    setupStore();
    renderWithProviders(<Nav />);

    const link = screen.getByText(text).closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", to);
  });

  it("renders links inside list items", () => {
    setupStore();
    renderWithProviders(<Nav />);

    const listItems = document.querySelectorAll("nav ul li");
    expect(listItems).toHaveLength(6);
  });

  it("does not render App Performance when diagnostics are disabled", () => {
    setupStore({
      settings: { appPerformanceMonitorEnabled: false },
    });
    renderWithProviders(<Nav />);

    expect(screen.queryByText("App Performance")).not.toBeInTheDocument();
    expect(screen.queryByText("App Perf...")).not.toBeInTheDocument();
  });

  it("renders App Performance when the feature is enabled but idle", () => {
    setupStore({
      settings: { appPerformanceMonitorEnabled: true },
      appPerformance: {
        captureId: null,
        captureStartedAt: null,
        isSampling: false,
      },
    });
    renderWithProviders(<Nav />);

    const link = screen.getByText("App Performance").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/app-performance");
    expect(screen.queryByText("App Perf...")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-performance-charts"),
    ).not.toBeInTheDocument();
  });

  it("renders active App Performance capture with compact timer", () => {
    setupStore({
      settings: { appPerformanceMonitorEnabled: true },
      appPerformance: {
        captureId: "capture-1",
        captureStartedAt: "2024-01-01T00:00:00Z",
        isSampling: true,
      },
    });
    renderWithProviders(<Nav />);

    const link = screen.getByText("App Perf...").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/app-performance/live");
    expect(screen.getByText("1:30:45")).toBeInTheDocument();
    expect(
      screen.getByTestId("sidebar-performance-charts"),
    ).toBeInTheDocument();
    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: "2024-01-01T00:00:00Z",
      direction: "up",
      enabled: true,
    });
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
