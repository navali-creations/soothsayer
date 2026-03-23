import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SessionDetailsPage from "./SessionDetails.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ sessionId: "test-session-123" }),
}));

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
  SessionDetailsStats: (props: any) => (
    <div
      data-testid="session-details-stats"
      data-duration={props.duration}
      data-total-count={props.totalCount}
      data-net-profit={props.netProfit}
    />
  ),
  SessionDetailsTable: (props: any) => (
    <div
      data-testid="session-details-table"
      data-card-count={props.cardData?.length ?? 0}
      data-price-source={props.priceSource}
    />
  ),
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
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiArrowLeft: () => <span data-testid="icon-arrow-left" />,
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  const loadSession = vi.fn();
  const clearSession = vi.fn();

  return {
    sessionDetails: {
      loadSession,
      clearSession,
      getSession: vi.fn(() => null),
      getIsLoading: vi.fn(() => false),
      getPriceSource: vi.fn(() => "exchange" as const),
      setPriceSource: vi.fn(),
      toggleCardPriceVisibility: vi.fn(),
      ...overrides.sessionDetails,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

function makeSession(overrides: any = {}) {
  return {
    totalCount: 50,
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:30:00Z",
    league: "Settlers",
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
  };
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByText("Session not found")).toBeInTheDocument();
    });

    it("shows a back button that navigates to /sessions", async () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      const { user } = renderWithProviders(<SessionDetailsPage />);

      const backButton = screen
        .getByText("Back to Sessions")
        .closest("button")!;
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/sessions" });
    });

    it("does not render session details components", () => {
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(store.sessionDetails.loadSession).toHaveBeenCalledWith(
        "test-session-123",
      );
    });

    it("calls clearSession on unmount", () => {
      const store = setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => null),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      const { unmount } = renderWithProviders(<SessionDetailsPage />);

      unmount();

      expect(store.sessionDetails.clearSession).toHaveBeenCalled();
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-table")).toBeInTheDocument();
    });

    it("passes the current priceSource to the table", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "stash"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const table = screen.getByTestId("session-details-table");
      expect(table).toHaveAttribute("data-price-source", "stash");
    });

    it("passes correct card count to the table", () => {
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const table = screen.getByTestId("session-details-table");
      expect(table).toHaveAttribute("data-card-count", "2");
    });

    it("renders subtitle with league and start date", () => {
      const session = makeSession({ league: "Settlers" });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
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
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      // The export button is rendered because onExportCsv is provided
      expect(screen.getByTestId("export-csv-trigger")).toBeInTheDocument();
    });
  });

  // ── Duration calculation ───────────────────────────────────────────────

  describe("duration calculation", () => {
    it("passes calculated duration to stats (hours and minutes)", () => {
      const session = makeSession({
        startedAt: "2024-01-15T10:00:00Z",
        endedAt: "2024-01-15T11:30:00Z",
      });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const stats = screen.getByTestId("session-details-stats");
      expect(stats).toHaveAttribute("data-duration", "1h 30m");
    });

    it('passes "—" when startedAt is missing', () => {
      const session = makeSession({ startedAt: null, endedAt: null });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const stats = screen.getByTestId("session-details-stats");
      expect(stats).toHaveAttribute("data-duration", "—");
    });

    it('passes "Unknown (Corrupted)" when endedAt is missing', () => {
      const session = makeSession({
        startedAt: "2024-01-15T10:00:00Z",
        endedAt: null,
      });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const stats = screen.getByTestId("session-details-stats");
      expect(stats).toHaveAttribute("data-duration", "Unknown (Corrupted)");
    });

    it("passes minutes-only duration when less than an hour", () => {
      const session = makeSession({
        startedAt: "2024-01-15T10:00:00Z",
        endedAt: "2024-01-15T10:45:00Z",
      });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const stats = screen.getByTestId("session-details-stats");
      expect(stats).toHaveAttribute("data-duration", "45m");
    });
  });

  // ── Card data and price calculations ───────────────────────────────────

  describe("card data calculations", () => {
    it("passes totalCount to stats", () => {
      const session = makeSession({ totalCount: 100 });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const stats = screen.getByTestId("session-details-stats");
      expect(stats).toHaveAttribute("data-total-count", "100");
    });

    it("calculates net profit correctly (totalProfit - deckCost)", () => {
      // totalProfit = 2400 + 30 = 2430 (no hidden prices in exchange)
      // deckCost = stackedDeckChaosCost(2) * totalCount(50) = 100
      // netProfit = 2430 - 100 = 2330
      const session = makeSession();
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const stats = screen.getByTestId("session-details-stats");
      expect(stats).toHaveAttribute("data-net-profit", "2330");
    });

    it("handles session with no cards", () => {
      const session = makeSession({ cards: [], totalCount: 0 });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsPage />);

      const table = screen.getByTestId("session-details-table");
      expect(table).toHaveAttribute("data-card-count", "0");
    });

    it("handles session with no priceSnapshot", () => {
      const session = makeSession({ priceSnapshot: undefined });
      setupStore({
        sessionDetails: {
          loadSession: vi.fn(),
          clearSession: vi.fn(),
          getSession: vi.fn(() => session),
          getIsLoading: vi.fn(() => false),
          getPriceSource: vi.fn(() => "exchange"),
        },
      });

      // Should not throw
      renderWithProviders(<SessionDetailsPage />);

      expect(screen.getByTestId("session-details-stats")).toBeInTheDocument();
    });
  });
});
