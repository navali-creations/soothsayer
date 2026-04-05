import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { useCardDetails } from "~/renderer/store";
import type { GameType } from "~/types/data-stores";

import SessionListEmpty from "./SessionListEmpty";
import SessionListError from "./SessionListError";
import SessionListPagination from "./SessionListPagination";
import SessionListTable from "./SessionListTable";

interface CardDetailsSessionListProps {
  cardName: string;
  game: GameType;
}

const PAGE_SIZE = 5;

/**
 * Compact sessions list for the card details page.
 *
 * Displays a paginated, server-sorted table of sessions where this card
 * was found. Sorting is handled by the main process — the renderer
 * simply reads the pre-sorted results from the Zustand store.
 *
 * Delegates to:
 * - `SessionListTable` — sortable table with headers and rows
 * - `SessionListPagination` — page controls using `Button`
 * - `SessionListError` / `SessionListEmpty` — edge-case states
 */
const CardDetailsSessionList = ({
  cardName,
  game,
}: CardDetailsSessionListProps) => {
  const navigate = useNavigate();

  const {
    sessions,
    isLoadingSessions,
    sessionsError,
    sessionsPage,
    sessionsSortState,
    fetchSessionsForCard,
    setSessionsSort,
    selectedLeague,
  } = useCardDetails();

  const showLeagueColumn = selectedLeague === "all";

  // Derive the league filter from the store: "all" → undefined (no filter),
  // otherwise the specific league name.
  const league = selectedLeague === "all" ? undefined : selectedLeague;

  // Fetch sessions on mount and when page/league changes.
  useEffect(() => {
    if (cardName && game) {
      fetchSessionsForCard(game, cardName, sessionsPage, PAGE_SIZE, league);
    }
  }, [game, cardName, sessionsPage, league, fetchSessionsForCard]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      fetchSessionsForCard(game, cardName, newPage, PAGE_SIZE, league);
    },
    [game, cardName, league, fetchSessionsForCard],
  );

  const handleRowClick = useCallback(
    (sessionId: string) => {
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId },
      });
    },
    [navigate],
  );

  const handleSort = useCallback(
    (column: (typeof sessionsSortState)["column"]) => {
      setSessionsSort(column, game, cardName, league);
    },
    [setSessionsSort, game, cardName, league],
  );

  // Error state
  if (sessionsError) {
    return <SessionListError error={sessionsError} />;
  }

  // No sessions
  if (!sessions || sessions.total === 0) {
    return <SessionListEmpty />;
  }

  const { total, page, totalPages } = sessions;

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Sessions with this Card
        </h3>
        <span className="badge badge-sm badge-ghost tabular-nums">
          {total} session{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <SessionListTable
        sessions={sessions.sessions}
        sortState={sessionsSortState}
        showLeagueColumn={showLeagueColumn}
        onSort={handleSort}
        onRowClick={handleRowClick}
      />

      {/* Pagination */}
      <SessionListPagination
        page={page}
        totalPages={totalPages}
        isLoading={isLoadingSessions}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

export default CardDetailsSessionList;
