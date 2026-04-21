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
  SessionCard: ({
    session,
    isExportMode,
    isSelected,
    onToggleSelect,
  }: {
    session: SessionsSummary;
    isExportMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
  }) => (
    <button
      data-export-mode={String(Boolean(isExportMode))}
      data-selected={String(Boolean(isSelected))}
      data-testid={`session-${session.sessionId}`}
      onClick={onToggleSelect}
    >
      {session.league}
    </button>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: {
  filteredSessions?: SessionsSummary[];
  selectedLeague?: string;
  sparklines?: Record<string, { x: number; profit: number }[]>;
  isExportMode?: boolean;
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
      getIsExportMode: () => overrides.isExportMode ?? false,
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

    it("does not render selection checkboxes outside export mode", () => {
      const sessions = [makeSessionsSummary({ sessionId: "sess-1" })];
      setupStore({ filteredSessions: sessions, isExportMode: false });
      renderWithProviders(<SessionsGrid />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.getByTestId("session-sess-1")).toHaveAttribute(
        "data-export-mode",
        "false",
      );
    });

    it("renders selected export state and toggles from checkbox", async () => {
      const toggleSessionSelection = vi.fn();
      const sessions = [
        makeSessionsSummary({ sessionId: "sess-1" }),
        makeSessionsSummary({ sessionId: "sess-2" }),
      ];
      setupStore({
        filteredSessions: sessions,
        isExportMode: true,
        selectedSessionIds: ["sess-2"],
        toggleSessionSelection,
      });

      const { user } = renderWithProviders(<SessionsGrid />);
      const checkboxes = screen.getAllByRole("checkbox");

      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(screen.getByTestId("session-sess-2")).toHaveAttribute(
        "data-selected",
        "true",
      );

      await user.click(checkboxes[0]);
      expect(toggleSessionSelection).toHaveBeenCalledWith("sess-1");
    });

    it("toggles selection when a card is clicked in export mode", async () => {
      const toggleSessionSelection = vi.fn();
      const sessions = [makeSessionsSummary({ sessionId: "sess-1" })];
      setupStore({
        filteredSessions: sessions,
        isExportMode: true,
        toggleSessionSelection,
      });

      const { user } = renderWithProviders(<SessionsGrid />);
      await user.click(screen.getByTestId("session-sess-1"));

      expect(toggleSessionSelection).toHaveBeenCalledWith("sess-1");
    });
  });
});
