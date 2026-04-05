import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useSessions } from "~/renderer/store";

import SessionsPage from "./Sessions.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSessions: vi.fn(),
}));

const mockUseSessions = vi.mocked(useSessions);

vi.mock("../Sessions.components", () => ({
  SessionsActions: () => <div data-testid="sessions-actions" />,
  SessionsGrid: () => <div data-testid="sessions-grid" />,
  SessionsPagination: () => <div data-testid="sessions-pagination" />,
}));

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

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockLoadAllSessions = vi.fn();

function setupStore(overrides: { isLoading: boolean }) {
  mockUseSessions.mockReturnValue({
    loadAllSessions: mockLoadAllSessions,
    getIsLoading: () => overrides.isLoading,
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls loadAllSessions on mount", () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SessionsPage />);

    expect(mockLoadAllSessions).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner while loading", () => {
    setupStore({ isLoading: true });
    renderWithProviders(<SessionsPage />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByTestId("sessions-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sessions-pagination")).not.toBeInTheDocument();
  });

  it("shows SessionsGrid and SessionsPagination when loaded", () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SessionsPage />);

    expect(screen.getByTestId("sessions-grid")).toBeInTheDocument();
    expect(screen.getByTestId("sessions-pagination")).toBeInTheDocument();
    expect(document.querySelector(".loading-spinner")).not.toBeInTheDocument();
  });

  it('renders page title "Sessions"', () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SessionsPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent("Sessions");
  });

  it("renders subtitle", () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SessionsPage />);

    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "View all your opening sessions",
    );
  });

  it("renders SessionsActions in header", () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SessionsPage />);

    const actions = screen.getByTestId("page-actions");
    expect(actions).toContainElement(screen.getByTestId("sessions-actions"));
  });

  it("renders within a PageContainer", () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SessionsPage />);

    expect(screen.getByTestId("page-container")).toBeInTheDocument();
  });
});
