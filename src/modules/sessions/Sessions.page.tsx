import { useEffect, useMemo, useState } from "react";
import { FiClock, FiFilter } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { formatCurrency } from "../../api/poe-ninja";
import { Link } from "../../components";
import { useBoundStore } from "../../store/store";

const SessionsPage = () => {
  const {
    sessions: {
      loadAllSessions,
      getAllSessions,
      getIsLoading,
      getCurrentPage,
      getPageSize,
      getTotalPages,
      getTotalSessions,
      setPage,
      setPageSize,
    },
    settings: { getActiveGame },
  } = useBoundStore();

  const activeGame = getActiveGame();
  const allSessions = getAllSessions();

  const loading = getIsLoading();

  const [selectedLeague, setSelectedLeague] = useState<string>("all");

  useEffect(() => {
    if (activeGame) {
      loadAllSessions(activeGame);
    }
  }, [activeGame, loadAllSessions]);

  // Get unique leagues for filter dropdown
  const leagues = useMemo(() => {
    const uniqueLeagues = new Set(allSessions.map((s) => s.league));
    return ["all", ...Array.from(uniqueLeagues)];
  }, [allSessions]);

  // Filter sessions by selected league
  const filteredSessions = useMemo(() => {
    if (selectedLeague === "all") {
      return allSessions;
    }
    return allSessions.filter((s) => s.league === selectedLeague);
  }, [allSessions, selectedLeague]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatSessionDate = (dateString: string) => {
    if (!dateString) return "Unknown date";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.error("Invalid date string:", dateString);
      return "Invalid date";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatSessionTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto space-y-6">
        {/* Header with Filter */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sessions</h1>
            <p className="text-base-content/70">
              View all your farming sessions
            </p>
          </div>

          {/* League Filter */}
          {leagues.length > 1 && (
            <div className="flex items-center gap-2">
              <FiFilter className="text-base-content/50" />
              <select
                className="select select-bordered"
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
              >
                {leagues.map((league) => (
                  <option key={league} value={league}>
                    {league === "all" ? "All Leagues" : league}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sessions Grid */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-base-content/50">
            <p className="text-lg">No sessions found</p>
            <p className="text-sm">
              {selectedLeague === "all"
                ? "Start a session from the Current Session page to begin tracking"
                : `No sessions found for ${selectedLeague} league`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => {
              return (
                <Link
                  key={session.sessionId}
                  to="/sessions/$sessionId"
                  params={{ sessionId: session.sessionId }}
                  className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-primary no-underline"
                >
                  <div className="card-body">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="card-title text-lg">
                          {formatSessionDate(session.startedAt)}
                          {session.isActive && (
                            <div className="badge badge-success badge-sm">
                              Active
                            </div>
                          )}
                          {!session.isActive && !session.endedAt && (
                            <div
                              className="badge badge-error badge-sm gap-1 tooltip tooltip-right"
                              data-tip="Session ended abruptly due to app crash or force close"
                            >
                              Corrupted
                            </div>
                          )}
                        </h2>
                        <p className="text-xs text-base-content/60">
                          {formatSessionTime(session.startedAt)}
                        </p>
                      </div>
                      <GiCardExchange
                        size={32}
                        className="text-base-content/20"
                      />
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 mt-4">
                      {/* League Badge */}
                      <div className="flex items-center gap-2">
                        <div className="badge badge-outline badge-primary">
                          {session.league}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center gap-2 text-sm">
                        <FiClock className="text-base-content/50" />
                        <span className="text-base-content/70">Duration:</span>
                        <span className="font-semibold tabular-nums">
                          {session.durationMinutes == null
                            ? "Unknown"
                            : session.durationMinutes >= 60
                              ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
                              : `${session.durationMinutes}m`}
                        </span>
                      </div>

                      {/* Decks Opened */}
                      <div className="flex items-center gap-2 text-sm">
                        <GiCardExchange className="text-base-content/50" />
                        <span className="text-base-content/70">Decks:</span>
                        <span className="font-semibold tabular-nums">
                          {session.totalDecksOpened}
                        </span>
                      </div>

                      {/* Total Value - Exchange */}
                      <div className="flex items-center gap-2 text-sm">
                        <GiCardExchange className="text-base-content/50" />
                        <span className="text-base-content/70">Exchange:</span>
                        {session.totalExchangeValue == null ||
                        session.exchangeChaosToDivine == null ? (
                          <span className="text-base-content/50">N/A</span>
                        ) : (
                          <span className="font-semibold tabular-nums text-success">
                            {formatCurrency(
                              session.totalExchangeValue,
                              session.exchangeChaosToDivine,
                            )}
                          </span>
                        )}
                      </div>

                      {/* Total Value - Stash */}
                      <div className="flex items-center gap-2 text-sm">
                        <GiLockedChest className="text-base-content/50" />
                        <span className="text-base-content/70">Stash:</span>
                        {session.totalStashValue == null ||
                        session.stashChaosToDivine == null ? (
                          <span className="text-base-content/50">N/A</span>
                        ) : (
                          <span className="font-semibold tabular-nums text-success">
                            {formatCurrency(
                              session.totalStashValue,
                              session.stashChaosToDivine,
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {filteredSessions.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            {/* Page info */}
            <div className="text-sm text-base-content/70">
              Showing {(getCurrentPage() - 1) * getPageSize() + 1} to{" "}
              {Math.min(getCurrentPage() * getPageSize(), getTotalSessions())}{" "}
              of {getTotalSessions()} sessions
            </div>

            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/70">Per page:</span>
              <select
                className="select select-bordered select-sm"
                value={getPageSize()}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page buttons */}
            <div className="join">
              <button
                className="join-item btn btn-sm"
                onClick={() => setPage(getCurrentPage() - 1)}
                disabled={getCurrentPage() === 1}
              >
                «
              </button>

              {/* Always show first page */}
              {getCurrentPage() > 3 && (
                <>
                  <button
                    className="join-item btn btn-sm"
                    onClick={() => setPage(1)}
                  >
                    1
                  </button>
                  <button className="join-item btn btn-sm btn-disabled">
                    ...
                  </button>
                </>
              )}

              {/* Show current page and neighbors */}
              {[...Array(getTotalPages())]
                .map((_, i) => i + 1)
                .filter(
                  (page) =>
                    page === getCurrentPage() ||
                    page === getCurrentPage() - 1 ||
                    page === getCurrentPage() + 1,
                )
                .map((page) => (
                  <button
                    key={page}
                    className={`join-item btn btn-sm ${
                      page === getCurrentPage() ? "btn-active" : ""
                    }`}
                    onClick={() => setPage(page)}
                  >
                    {page}
                  </button>
                ))}

              {/* Always show last page */}
              {getCurrentPage() < getTotalPages() - 2 && (
                <>
                  <button className="join-item btn btn-sm btn-disabled">
                    ...
                  </button>
                  <button
                    className="join-item btn btn-sm"
                    onClick={() => setPage(getTotalPages())}
                  >
                    {getTotalPages()}
                  </button>
                </>
              )}

              <button
                className="join-item btn btn-sm"
                onClick={() => setPage(getCurrentPage() + 1)}
                disabled={getCurrentPage() === getTotalPages()}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionsPage;
