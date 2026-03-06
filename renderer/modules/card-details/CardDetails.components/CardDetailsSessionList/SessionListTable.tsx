import { FiExternalLink } from "react-icons/fi";

import type { SessionSummary } from "~/main/modules/sessions/Sessions.api";

import { formatDate, formatDuration } from "./helpers";
import SortIndicator from "./SortIndicator";
import type { SessionSortColumn, SessionSortState } from "./types";

interface SessionListTableProps {
  sessions: SessionSummary[];
  sortState: SessionSortState;
  showLeagueColumn: boolean;
  onSort: (column: SessionSortColumn) => void;
  onRowClick: (sessionId: string) => void;
}

const TH_CLASS =
  "font-semibold cursor-pointer select-none hover:text-base-content/70 transition-colors group/th";

/**
 * Sortable table displaying sessions where this card was found.
 *
 * Columns:
 * - Date (startedAt)
 * - League (conditionally shown when selectedLeague is "all")
 * - Found (card count in that session)
 * - Duration
 * - Decks Opened
 *
 * Clicking a header triggers server-side re-sort via `onSort`.
 * Clicking a row navigates to the session detail page via `onRowClick`.
 */
const SessionListTable = ({
  sessions,
  sortState,
  showLeagueColumn,
  onSort,
  onRowClick,
}: SessionListTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs w-full">
        <thead>
          <tr className="text-xs text-base-content/40 border-b border-base-300">
            <th className={TH_CLASS} onClick={() => onSort("date")}>
              <span className="inline-flex items-center">
                Date
                <SortIndicator column="date" sortState={sortState} />
              </span>
            </th>
            {showLeagueColumn && (
              <th className={TH_CLASS} onClick={() => onSort("league")}>
                <span className="inline-flex items-center">
                  League
                  <SortIndicator column="league" sortState={sortState} />
                </span>
              </th>
            )}
            <th
              className={`${TH_CLASS} text-right`}
              onClick={() => onSort("found")}
            >
              <span className="inline-flex items-center justify-end w-full">
                Found
                <SortIndicator column="found" sortState={sortState} />
              </span>
            </th>
            <th
              className={`${TH_CLASS} text-right`}
              onClick={() => onSort("duration")}
            >
              <span className="inline-flex items-center justify-end w-full">
                Duration
                <SortIndicator column="duration" sortState={sortState} />
              </span>
            </th>
            <th
              className={`${TH_CLASS} text-right`}
              onClick={() => onSort("decks")}
            >
              <span className="inline-flex items-center justify-end w-full">
                Decks
                <SortIndicator column="decks" sortState={sortState} />
              </span>
            </th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.sessionId}
              className="cursor-pointer hover:bg-base-300/50 transition-colors"
              onClick={() => onRowClick(session.sessionId)}
              title="View session details"
            >
              <td className="text-sm tabular-nums">
                {formatDate(session.startedAt)}
              </td>
              {showLeagueColumn && (
                <td className="text-sm">{session.league}</td>
              )}
              <td className="text-sm text-right tabular-nums font-semibold">
                {session.cardCount != null ? session.cardCount : "—"}
              </td>
              <td className="text-sm text-right tabular-nums">
                {formatDuration(session.durationMinutes)}
              </td>
              <td className="text-sm text-right tabular-nums">
                {session.totalDecksOpened.toLocaleString()}
              </td>
              <td className="text-right">
                <FiExternalLink className="w-3 h-3 text-base-content/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SessionListTable;
