import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionPage from "./CurrentSession.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("../CurrentSession.components", () => ({
  CurrentSessionActions: () => <div data-testid="current-session-actions" />,
  CurrentSessionStats: () => <div data-testid="current-session-stats" />,
  CurrentSessionTable: () => <div data-testid="current-session-table" />,
  InactiveSessionAlert: () => <div data-testid="inactive-session-alert" />,
  LoadingAlert: () => <div data-testid="loading-alert" />,
  SessionProfitTimeline: () => <div data-testid="session-profit-timeline" />,
  TrackingInfoAlert: () => <div data-testid="tracking-info-alert" />,
}));

vi.mock(
  "../CurrentSession.components/PriceSnapshotAlert/PriceSnapshotAlert",
  () => ({
    default: () => <div data-testid="price-snapshot-alert" />,
  }),
);

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle, actions }: any) => (
        <div data-testid="page-header">
          <span data-testid="page-title">{title}</span>
          {subtitle && <span data-testid="page-subtitle">{subtitle}</span>}
          <div data-testid="page-actions">{actions}</div>
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

vi.mock("motion/react", async () => {
  const { createMotionMock } = await import(
    "~/renderer/__test-setup__/motion-mock"
  );
  return createMotionMock();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: { isLoading: boolean; isActive: boolean }) {
  mockUseBoundStore.mockReturnValue({
    currentSession: {
      isLoading: overrides.isLoading,
      getIsCurrentSessionActive: () => overrides.isActive,
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CurrentSessionPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page title "Current Session"', () => {
    setupStore({ isLoading: false, isActive: false });
    renderWithProviders(<CurrentSessionPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent(
      "Current Session",
    );
  });

  it("renders CurrentSessionActions in the header", () => {
    setupStore({ isLoading: false, isActive: false });
    renderWithProviders(<CurrentSessionPage />);

    const actions = screen.getByTestId("page-actions");
    expect(actions).toContainElement(
      screen.getByTestId("current-session-actions"),
    );
  });

  it("shows LoadingAlert when loading and not active", () => {
    setupStore({ isLoading: true, isActive: false });
    renderWithProviders(<CurrentSessionPage />);

    expect(screen.getByTestId("loading-alert")).toBeInTheDocument();
    expect(screen.queryByTestId("tracking-info-alert")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("inactive-session-alert"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("price-snapshot-alert"),
    ).not.toBeInTheDocument();
  });

  it("shows TrackingInfoAlert and InactiveSessionAlert when not loading and not active", () => {
    setupStore({ isLoading: false, isActive: false });
    renderWithProviders(<CurrentSessionPage />);

    expect(screen.getByTestId("tracking-info-alert")).toBeInTheDocument();
    expect(screen.getByTestId("inactive-session-alert")).toBeInTheDocument();
    expect(screen.queryByTestId("loading-alert")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("price-snapshot-alert"),
    ).not.toBeInTheDocument();
  });

  it("shows PriceSnapshotAlert when active", () => {
    setupStore({ isLoading: false, isActive: true });
    renderWithProviders(<CurrentSessionPage />);

    expect(screen.getByTestId("price-snapshot-alert")).toBeInTheDocument();
    expect(screen.queryByTestId("loading-alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tracking-info-alert")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("inactive-session-alert"),
    ).not.toBeInTheDocument();
  });

  it("always renders CurrentSessionStats", () => {
    setupStore({ isLoading: false, isActive: false });
    renderWithProviders(<CurrentSessionPage />);
    expect(screen.getByTestId("current-session-stats")).toBeInTheDocument();
  });

  it("always renders CurrentSessionTable", () => {
    setupStore({ isLoading: false, isActive: false });
    renderWithProviders(<CurrentSessionPage />);
    expect(screen.getByTestId("current-session-table")).toBeInTheDocument();
  });

  it("renders CurrentSessionStats when session is active", () => {
    setupStore({ isLoading: false, isActive: true });
    renderWithProviders(<CurrentSessionPage />);
    expect(screen.getByTestId("current-session-stats")).toBeInTheDocument();
  });

  it("renders CurrentSessionTable when session is active", () => {
    setupStore({ isLoading: false, isActive: true });
    renderWithProviders(<CurrentSessionPage />);
    expect(screen.getByTestId("current-session-table")).toBeInTheDocument();
  });

  it("does not show inactive alerts when session is active", () => {
    setupStore({ isLoading: false, isActive: true });
    renderWithProviders(<CurrentSessionPage />);

    expect(
      screen.queryByTestId("inactive-session-alert"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("tracking-info-alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading-alert")).not.toBeInTheDocument();
  });
});
