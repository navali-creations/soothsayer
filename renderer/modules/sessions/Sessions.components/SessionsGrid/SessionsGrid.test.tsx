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
  sparklines?: Record<string, { x: number; profit: number }[]>;
  isBulkMode?: boolean;
  isDeleteMode?: boolean;
  selectedSessionIds?: string[];
  toggleSessionSelection?: ReturnType<typeof vi.fn>;
}) {
  const selectedIds = new Set(overrides.selectedSessionIds ?? []);
  const toggleSessionSelection = overrides.toggleSessionSelection ?? vi.fn();

  mockUseBoundStore.mockReturnValue({
    sessions: {
      getFilteredSessions: () => overrides.filteredSessions ?? [],
      getSelectedLeague: () => overrides.selectedLeague ?? "all",
      getSparklines: () => overrides.sparklines ?? {},
      getIsBulkMode: () => overrides.isBulkMode ?? false,
      getIsDeleteMode: () => overrides.isDeleteMode ?? false,
      getIsSessionSelected: (id: string) => selectedIds.has(id),
      toggleSessionSelection,
    },
  } as any);

  return { toggleSessionSelection };
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

    it("does not render selection checkboxes outside bulk mode", () => {
      const sessions = [makeSessionsSummary({ sessionId: "sess-1" })];
      setupStore({ filteredSessions: sessions, isBulkMode: false });
      renderWithProviders(<SessionsGrid />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.getByTestId("session-sess-1")).toBeInTheDocument();
    });

    it("renders selected bulk state and toggles from checkbox", async () => {
      const toggleSessionSelection = vi.fn();
      const sessions = [
        makeSessionsSummary({ sessionId: "sess-1" }),
        makeSessionsSummary({ sessionId: "sess-2" }),
      ];
      setupStore({
        filteredSessions: sessions,
        isBulkMode: true,
        selectedSessionIds: ["sess-2"],
        toggleSessionSelection,
      });

      const { user } = renderWithProviders(<SessionsGrid />);
      const checkboxes = screen.getAllByRole("checkbox");

      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[0]).toHaveClass("checkbox-primary");
      expect(checkboxes[0]).toHaveClass("border-dashed");
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[1]).toHaveClass("checkbox-primary");
      expect(screen.getByTestId("session-sess-2")).toBeInTheDocument();

      await user.click(checkboxes[0]);
      expect(toggleSessionSelection).toHaveBeenCalledWith("sess-1");
    });

    it("renders delete mode selection with error checkbox and card state", () => {
      const sessions = [makeSessionsSummary({ sessionId: "sess-1" })];
      setupStore({
        filteredSessions: sessions,
        isBulkMode: true,
        isDeleteMode: true,
        selectedSessionIds: ["sess-1"],
      });

      renderWithProviders(<SessionsGrid />);

      expect(screen.getByRole("checkbox")).toHaveClass("checkbox-error");
      expect(screen.getByRole("checkbox")).toHaveClass("checked:text-white");
      expect(screen.getByTestId("session-sess-1")).toBeInTheDocument();
    });
  });
});
