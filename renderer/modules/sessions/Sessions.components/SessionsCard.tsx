import { FiClock } from "react-icons/fi";
import { GiCardExchange, GiLockedChest, GiReceiveMoney } from "react-icons/gi";

import { Link } from "~/renderer/components";
import { formatCurrency } from "~/renderer/utils";

import type { SessionsSummary } from "../Sessions.types";
import { formatSessionDate, formatSessionTime } from "../Sessions.utils";

interface SessionCardProps {
  session: SessionsSummary;
}

export const SessionCard = ({ session }: SessionCardProps) => {
  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.sessionId }}
      className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-primary no-underline h-full flex flex-col"
    >
      <div className="card-body p-3 flex-1 justify-between">
        {/* Header */}
        <div className="flex justify-between items-baseline">
          <div className="flex-1">
            <h2 className="card-title text-lg">
              {formatSessionDate(session.startedAt)}
            </h2>
            <p className="text-xs text-base-content/60">
              {formatSessionTime(session.startedAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="badge badge-sm badge-outline badge-primary">
              {session.league}
            </div>
            {session.isActive && (
              <div className="badge badge-success badge-sm">Active</div>
            )}
            {!session.isActive && !session.endedAt && (
              <div
                className="badge badge-error badge-sm gap-1 tooltip tooltip-right"
                data-tip="Session ended abruptly due to app crash or force close"
              >
                Corrupted{" "}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 mt-1">
          {/* Duration */}
          <div className="flex items-center gap-2 text-sm">
            <FiClock className="text-base-content/50" />
            <span className="text-base-content/70">Duration:</span>
            <span className="font-semibold tabular-nums">
              {session.durationMinutes == null
                ? "Unknown"
                : session.durationMinutes >= 60
                  ? `${Math.floor(session.durationMinutes / 60)}h ${
                      session.durationMinutes % 60
                    }m`
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

          {/* Net Profit */}
          {session.totalExchangeNetProfit != null &&
            session.exchangeChaosToDivine != null && (
              <div className="flex items-center gap-2 text-sm">
                <GiReceiveMoney className="text-base-content/50" />
                <span
                  className="text-base-content/70 underline decoration-dotted cursor-help"
                  title="Total Value minus the cost of Stacked Decks opened"
                >
                  Net Profit:
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    session.totalExchangeNetProfit < 0
                      ? "text-error"
                      : "text-success"
                  }`}
                >
                  {formatCurrency(
                    session.totalExchangeNetProfit,
                    session.exchangeChaosToDivine,
                  )}
                </span>
              </div>
            )}
        </div>
      </div>
    </Link>
  );
};
