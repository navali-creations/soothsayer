import { useEffect, useMemo, useState } from "react";
import { FiClock, FiFilter } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import type { SessionPriceSnapshot } from "../../../types/data-stores";
import { formatCurrency } from "../../api/poe-ninja";
import { Link } from "../../components";

type SessionData = {
  id: string;
  isActive: boolean;
  league: string;
  startedAt: string;
  endedAt: string | null;
  totalCount: number;
  cards: Record<string, { count: number; processedIds: string[] }>;
  priceSnapshot?: SessionPriceSnapshot;
};

const SessionsPage = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<string>("all");

  useEffect(() => {
    loadSessions();

    // Listen for session state changes to reload
    const cleanup = window.electron?.session?.onStateChanged(() => {
      loadSessions();
    });

    return cleanup;
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const allSessions = await window.electron?.session?.getAll("poe1");
    setSessions(allSessions || []);
    setLoading(false);
  };

  // Get unique leagues for filter dropdown
  const leagues = useMemo(() => {
    const uniqueLeagues = new Set(sessions.map((s) => s.league));
    return ["all", ...Array.from(uniqueLeagues)];
  }, [sessions]);

  // Filter sessions by selected league
  const filteredSessions = useMemo(() => {
    if (selectedLeague === "all") {
      return sessions;
    }
    return sessions.filter((s) => s.league === selectedLeague);
  }, [sessions, selectedLeague]);

  const calculateDuration = (startedAt: string, endedAt: string | null) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diff = end.getTime() - start.getTime();

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const calculateTotalValues = (
    cards: Record<string, { count: number }>,
    priceSnapshot?: SessionPriceSnapshot,
  ) => {
    // If no price snapshot, return null to indicate N/A
    if (!priceSnapshot) {
      return { exchange: null, stash: null };
    }

    let exchangeTotal = 0;
    let stashTotal = 0;

    for (const [name, entry] of Object.entries(cards)) {
      const exchangePrice = priceSnapshot.exchange.cardPrices[name];
      const stashPrice = priceSnapshot.stash.cardPrices[name];

      exchangeTotal += (exchangePrice?.chaosValue || 0) * entry.count;
      stashTotal += (stashPrice?.chaosValue || 0) * entry.count;
    }

    return {
      exchange: exchangeTotal,
      stash: stashTotal,
    };
  };

  const formatSessionDate = (dateString: string) => {
    const date = new Date(dateString);
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
              const totalValues = calculateTotalValues(
                session.cards,
                session.priceSnapshot,
              );

              return (
                <Link
                  key={session.id}
                  to="/sessions/$sessionId"
                  params={{ sessionId: session.id }}
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
                          {calculateDuration(
                            session.startedAt,
                            session.endedAt,
                          )}
                        </span>
                      </div>

                      {/* Decks Opened */}
                      <div className="flex items-center gap-2 text-sm">
                        <GiCardExchange className="text-base-content/50" />
                        <span className="text-base-content/70">Decks:</span>
                        <span className="font-semibold tabular-nums">
                          {session.totalCount}
                        </span>
                      </div>

                      {/* Total Value - Exchange */}
                      <div className="flex items-center gap-2 text-sm">
                        <GiCardExchange className="text-base-content/50" />
                        <span className="text-base-content/70">Exchange:</span>
                        {totalValues.exchange === null ||
                        !session.priceSnapshot ? (
                          <span className="text-base-content/50">N/A</span>
                        ) : (
                          <span className="font-semibold tabular-nums text-success">
                            {formatCurrency(
                              totalValues.exchange,
                              session.priceSnapshot.exchange.chaosToDivineRatio,
                            )}
                          </span>
                        )}
                      </div>

                      {/* Total Value - Stash */}
                      <div className="flex items-center gap-2 text-sm">
                        <GiLockedChest className="text-base-content/50" />
                        <span className="text-base-content/70">Stash:</span>
                        {totalValues.stash === null ||
                        !session.priceSnapshot ? (
                          <span className="text-base-content/50">N/A</span>
                        ) : (
                          <span className="font-semibold tabular-nums text-success">
                            {formatCurrency(
                              totalValues.stash,
                              session.priceSnapshot.stash.chaosToDivineRatio,
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
      </div>
    </div>
  );
};

export default SessionsPage;
