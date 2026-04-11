import { makeDetailedSession } from "~/renderer/__test-setup__/fixtures";
import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useSessionDetails } from "~/renderer/store";

import SessionDetailsPage from "./SessionDetails.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSessionDetails: vi.fn(),
}));

const { mockHistoryBack } = vi.hoisted(() => ({
  mockHistoryBack: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const { createRouterMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createRouterMock({
    mockHistoryBack,
    useParamsReturn: { sessionId: "test-session-123" },
  });
});

vi.mock("../SessionDetails.components", () => ({
  SessionDetailsActions: ({ onExportCsv }: any) => (
    <div data-testid="session-details-actions">
      {onExportCsv && (
        <button data-testid="export-csv-trigger" onClick={onExportCsv}>
          Export CSV
        </button>
      )}
    </div>
  ),
  SessionDetailsStats: ({ expanded, onToggleExpanded }: any) => (
    <div
      data-testid="session-details-stats"
      data-expanded={expanded}
      data-has-toggle={!!onToggleExpanded}
    />
  ),
  SessionDetailsTable: () => <div data-testid="session-details-table" />,
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
  BackButton: ({ fallback, label, ...props }: any) => (
    <button
      data-testid="back-button"
      data-fallback={fallback}
      onClick={() => mockHistoryBack()}
      {...props}
    >
      {label}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiArrowLeft: () => <span data-testid="icon-arrow-left" />,
}));

const mockUseSessionDetails = vi.mocked(useSessionDetails);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockSessionDetails(overrides: any = {}) {
  const loadSession = vi.fn();
  const clearSession = vi.fn();

  return {
    loadSession,
    clearSession,
    getSession: vi.fn(() => null),
    getIsLoading: vi.fn(() => false),
    getTimeline: vi.fn(() => null),
    getHasTimeline: vi.fn(() => false),
    getPriceData: vi
      .fn()
      .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    setPriceSource: vi.fn(),
    toggleCardPriceVisibility: vi.fn(),
    ...overrides.sessionDetails,
  } as any;
}

function setupStore(overrides: any = {}) {
  const sessionDetails = createMockSessionDetails(overrides);
  mockUseSessionDetails.mockReturnValue(sessionDetails);
  return sessionDetails;
}

function makeSession(overrides: any = {}) {
  return makeDetailedSession({
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:30:00Z",
    cards: [
      {
        name: "The Doctor",
        count: 2,
        exchangePrice: {
          chaosValue: 1200,
          divineValue: 8,
          totalValue: 2400,
          hidePrice: false,
        },
        stashPrice: {
          chaosValue: 1100,
          divineValue: 7.3,
          totalValue: 2200,
          hidePrice: false,
        },
      },
      {
        name: "Rain of Chaos",
        count: 30,
        exchangePrice: {
          chaosValue: 1,
          divineValue: 0.007,
          totalValue: 30,
          hidePrice: false,
        },
        stashPrice: {
          chaosValue: 0.8,
          divineValue: 0.005,
          totalValue: 24,
          hidePrice: false,
        },
      },
    ],
    priceSnapshot: {
      exchange: {
        chaosToDivineRatio: 150,
        cardPrices: {},
      },
      stash: {
        chaosToDivineRatio: 145,
        cardPrices: {},
      },
      stackedDeckChaosCost: 2,
    },
    ...overrides,
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  describe("loading state", () => {
    it("renders a spinner when loading", () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => true),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const spinner = document.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
    });

    it("does not render page content when loading", () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => true),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.queryByTestId("page-container")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("session-details-stats"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("session-details-table"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Session not found ──────────────────────────────────────────────────

  describe("session not found", () => {
    it('shows "Session not found" when session is null and not loading', () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByText("Session not found")).toBeInTheDocument();
    });

    it("shows a back button with /sessions fallback", async () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      const { user } = renderWithProviders(<SessionDetailsPage />);

      const backButton = screen.getByTestId("back-button");
      expect(backButton).toHaveAttribute("data-fallback", "/sessions");

      await user.click(backButton);
      expect(mockHistoryBack).toHaveBeenCalled();
    });

    it("does not render session details components", () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(
        screen.queryByTestId("session-details-actions"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("session-details-stats"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("session-details-table"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Effect: loadSession / clearSession ─────────────────────────────────

  describe("session loading lifecycle", () => {
    it("calls loadSession with sessionId on mount", () => {
      const store = setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(store.loadSession).toHaveBeenCalledWith("test-session-123");
    });

    it("calls clearSession on unmount", () => {
      const store = setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      const { unmount } = renderWithProviders(<SessionDetailsPage />);

      unmount();

      expect(store.clearSession).toHaveBeenCalled();
    });
  });

  // ── Success state ──────────────────────────────────────────────────────

  describe("success state", () => {
    it('renders page title "Session Details"', () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("page-title")).toHaveTextContent(
        "Session Details",
      );
    });

    it("renders SessionDetailsActions in the header", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const actions = screen.getByTestId("page-actions");
      expect(actions).toContainElement(
        screen.getByTestId("session-details-actions"),
      );
    });

    it("renders SessionDetailsStats", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-stats")).toBeInTheDocument();
    });

    it("renders SessionDetailsTable", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-table")).toBeInTheDocument();
    });

    it("renders subtitle with league and start date", () => {
      const session = makeSession({ league: "Settlers" });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const subtitle = screen.getByTestId("page-subtitle");
      expect(subtitle).toHaveTextContent("Settlers");
    });
  });

  // ── CSV Export ─────────────────────────────────────────────────────────

  describe("CSV export", () => {
    it("calls window.electron.csv.exportSession with sessionId on export", async () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });

      (window.electron as any).csv = {
        exportSession: vi.fn().mockResolvedValue({ success: true }),
      };

      const { user } = renderWithProviders(<SessionDetailsPage />);

      const exportButton = screen.getByTestId("export-csv-trigger");
      await user.click(exportButton);

      await waitFor(() => {
        expect(window.electron.csv.exportSession).toHaveBeenCalledWith(
          "test-session-123",
        );
      });
    });

    it("shows alert when export fails", async () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });

      (window.electron as any).csv = {
        exportSession: vi
          .fn()
          .mockResolvedValue({ success: false, canceled: false }),
      };

      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      const { user } = renderWithProviders(<SessionDetailsPage />);

      const exportButton = screen.getByTestId("export-csv-trigger");
      await user.click(exportButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "Failed to export CSV. Please try again.",
        );
      });
    });

    it("does not show alert when export is canceled", async () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });

      (window.electron as any).csv = {
        exportSession: vi
          .fn()
          .mockResolvedValue({ success: false, canceled: true }),
      };

      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      const { user } = renderWithProviders(<SessionDetailsPage />);

      const exportButton = screen.getByTestId("export-csv-trigger");
      await user.click(exportButton);

      await waitFor(() => {
        expect(window.electron.csv.exportSession).toHaveBeenCalled();
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });

    it("shows alert when export throws an error", async () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      (window.electron as any).csv = {
        exportSession: vi.fn().mockRejectedValue(new Error("Network error")),
      };

      const { user } = renderWithProviders(<SessionDetailsPage />);

      const exportButton = screen.getByTestId("export-csv-trigger");
      await user.click(exportButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "Failed to export CSV. Please try again.",
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it("provides onExportCsv to SessionDetailsActions", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      // The export button is rendered because onExportCsv is provided
      expect(screen.getByTestId("export-csv-trigger")).toBeInTheDocument();
    });
  });

  // ── Components render in success state ─────────────────────────────────

  describe("components render correctly", () => {
    it("renders all three child components when session exists", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-actions")).toBeInTheDocument();
      expect(screen.getByTestId("session-details-stats")).toBeInTheDocument();
      expect(screen.getByTestId("session-details-table")).toBeInTheDocument();
    });

    it("handles session with no cards", () => {
      const session = makeSession({ cards: [], totalCount: 0 });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-table")).toBeInTheDocument();
    });

    it("handles session with no priceSnapshot", () => {
      const session = makeSession({ priceSnapshot: undefined });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getTimeline: vi.fn(() => null),
          getHasTimeline: vi.fn(() => false),
          getPriceData: vi
            .fn()
            .mockReturnValue({ chaosToDivineRatio: 0, cardPrices: {} }),
        },
      });

      // Should not throw
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-stats")).toBeInTheDocument();
    });
  });
});
