import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionsGrid } from "../Sessions.components/SessionsGrid";
import type { SessionsSummary } from "../Sessions.types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("../Sessions.components/SessionsCard", () => ({
  SessionCard: ({ session }: { session: SessionsSummary }) => (
    <div data-testid={`session-${session.sessionId}`}>{session.league}</div>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<SessionsSummary> = {},
): SessionsSummary {
  return {
    sessionId: "sess-1",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:00:00Z",
    league: "Settlers",
    isActive: false,
    durationMinutes: 60,
    totalDecksOpened: 100,
    totalExchangeValue: 500,
    totalStashValue: 600,
    totalExchangeNetProfit: 200,
    totalStashNetProfit: 250,
    exchangeChaosToDivine: 150,
    stashChaosToDivine: 150,
    stackedDeckChaosCost: 3,
    ...overrides,
  };
}

function setupStore(overrides: {
  filteredSessions?: SessionsSummary[];
  selectedLeague?: string;
}) {
  mockUseBoundStore.mockReturnValue({
    sessions: {
      getFilteredSessions: () => overrides.filteredSessions ?? [],
      getSelectedLeague: () => overrides.selectedLeague ?? "all",
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionsGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("empty state", () => {
    it('shows "No sessions found" when no sessions exist', () => {
      setupStore({ filteredSessions: [], selectedLeague: "all" });
      renderWithProviders(<SessionsGrid />);

      expect(screen.getByText("No sessions found")).toBeInTheDocument();
    });

    it("shows generic empty message when selected league is 'all'", () => {
      setupStore({ filteredSessions: [], selectedLeague: "all" });
      renderWithProviders(<SessionsGrid />);

      expect(
        screen.getByText(
          "Start a session from the Current Session page to begin tracking",
        ),
      ).toBeInTheDocument();
    });

    it("shows league-specific empty message when a specific league is selected", () => {
      setupStore({ filteredSessions: [], selectedLeague: "Settlers" });
      renderWithProviders(<SessionsGrid />);

      expect(
        screen.getByText("No sessions found for Settlers league"),
      ).toBeInTheDocument();
    });
  });

  describe("with sessions", () => {
    it("renders a SessionCard for each session", () => {
      const sessions = [
        makeSession({ sessionId: "sess-1", league: "Settlers" }),
        makeSession({ sessionId: "sess-2", league: "Standard" }),
        makeSession({ sessionId: "sess-3", league: "Settlers" }),
      ];
      setupStore({ filteredSessions: sessions });
      renderWithProviders(<SessionsGrid />);

      expect(screen.getByTestId("session-sess-1")).toBeInTheDocument();
      expect(screen.getByTestId("session-sess-2")).toBeInTheDocument();
      expect(screen.getByTestId("session-sess-3")).toBeInTheDocument();
    });

    it("does not show empty state message when sessions exist", () => {
      const sessions = [makeSession({ sessionId: "sess-1" })];
      setupStore({ filteredSessions: sessions });
      renderWithProviders(<SessionsGrid />);

      expect(screen.queryByText("No sessions found")).not.toBeInTheDocument();
    });

    it("renders sessions inside a list", () => {
      const sessions = [
        makeSession({ sessionId: "sess-1" }),
        makeSession({ sessionId: "sess-2" }),
      ];
      setupStore({ filteredSessions: sessions });
      renderWithProviders(<SessionsGrid />);

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(2);
    });

    it("passes session data to SessionCard", () => {
      const sessions = [
        makeSession({ sessionId: "sess-1", league: "Settlers" }),
        makeSession({ sessionId: "sess-2", league: "Standard" }),
      ];
      setupStore({ filteredSessions: sessions });
      renderWithProviders(<SessionsGrid />);

      expect(screen.getByTestId("session-sess-1")).toHaveTextContent(
        "Settlers",
      );
      expect(screen.getByTestId("session-sess-2")).toHaveTextContent(
        "Standard",
      );
    });
  });
});
