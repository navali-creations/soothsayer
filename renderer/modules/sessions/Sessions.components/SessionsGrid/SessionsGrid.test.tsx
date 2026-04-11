import { makeSessionsSummary } from "~/renderer/__test-setup__/fixtures";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { SessionsSummary } from "../../Sessions.types";
import { SessionsGrid } from "./SessionsGrid";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("../SessionsCard/SessionsCard", () => ({
  SessionCard: ({ session }: { session: SessionsSummary }) => (
    <div data-testid={`session-${session.sessionId}`}>{session.league}</div>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: {
  filteredSessions?: SessionsSummary[];
  selectedLeague?: string;
}) {
  mockUseBoundStore.mockReturnValue({
    sessions: {
      getFilteredSessions: () => overrides.filteredSessions ?? [],
      getSelectedLeague: () => overrides.selectedLeague ?? "all",
      getSparklines: () => ({}),
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
        makeSessionsSummary({ sessionId: "sess-1", league: "Settlers" }),
        makeSessionsSummary({ sessionId: "sess-2", league: "Standard" }),
        makeSessionsSummary({ sessionId: "sess-3", league: "Settlers" }),
      ];
      setupStore({ filteredSessions: sessions });
      renderWithProviders(<SessionsGrid />);

      expect(screen.getByTestId("session-sess-1")).toBeInTheDocument();
      expect(screen.getByTestId("session-sess-2")).toBeInTheDocument();
      expect(screen.getByTestId("session-sess-3")).toBeInTheDocument();
    });

    it("does not show empty state message when sessions exist", () => {
      const sessions = [makeSessionsSummary({ sessionId: "sess-1" })];
      setupStore({ filteredSessions: sessions });
      renderWithProviders(<SessionsGrid />);

      expect(screen.queryByText("No sessions found")).not.toBeInTheDocument();
    });

    it("renders sessions inside a list", () => {
      const sessions = [
        makeSessionsSummary({ sessionId: "sess-1" }),
        makeSessionsSummary({ sessionId: "sess-2" }),
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
        makeSessionsSummary({ sessionId: "sess-1", league: "Settlers" }),
        makeSessionsSummary({ sessionId: "sess-2", league: "Standard" }),
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
