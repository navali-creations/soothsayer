import { FiClock } from "react-icons/fi";
import { GiCardExchange, GiReceiveMoney } from "react-icons/gi";

import { Link, StaticProfitSparkline } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useSessions } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";

import type { SessionsSummary } from "../../Sessions.types";
import {
  formatSessionDate,
  formatSessionTime,
} from "../../Sessions.utils/Sessions.utils";

interface SessionCardProps {
  session: SessionsSummary;
  /** Pre-computed sparkline line points for the background. */
  linePoints?: { x: number; profit: number }[];
}

export const SessionCard = ({ session, linePoints }: SessionCardProps) => {
  const {
    getIsBulkMode,
    getIsDeleteMode,
    getIsSessionSelected,
    toggleSessionSelection,
  } = useSessions();

  const isBulkMode = getIsBulkMode();
  const isDeleteMode = getIsDeleteMode();
  const isSelected = isBulkMode
    ? getIsSessionSelected(session.sessionId)
    : false;
  const hasSparkline = linePoints != null && linePoints.length >= 2;

  const borderClass = isBulkMode
    ? isSelected
      ? `border-solid border-2 ${isDeleteMode ? "border-error" : "border-primary"}`
      : "border-dashed border-2 border-base-content/30"
    : "border-2 border-transparent hover:border-primary";

  const cardContent = (
    <>
      {/* Sparkline background */}
      {hasSparkline && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <StaticProfitSparkline
            linePoints={linePoints}
            lineColor="rgba(236, 72, 153, 0.25)"
            className="absolute inset-0"
          />
        </div>
      )}

      <div className="card-body p-3 flex-1 justify-between relative z-10">
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
              <Tooltip
                as="div"
                className="badge badge-error badge-sm gap-1"
                content="Session ended abruptly due to app crash or force close"
              >
                Corrupted{" "}
              </Tooltip>
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

          {/* Total Value */}
          <div className="flex items-center gap-2 text-sm">
            <GiCardExchange className="text-base-content/50" />
            <span className="text-base-content/70">Value:</span>
            {session.totalValue == null ||
            session.chaosToDivineRatio == null ? (
              <span className="text-base-content/50">N/A</span>
            ) : (
              <span className="font-semibold tabular-nums text-success">
                {formatCurrency(session.totalValue, session.chaosToDivineRatio)}
              </span>
            )}
          </div>

          {/* Net Profit */}
          {session.netProfit != null && session.chaosToDivineRatio != null && (
            <div className="flex items-center gap-2 text-sm">
              <GiReceiveMoney className="text-base-content/50" />
              <Tooltip
                className="text-base-content/70 underline decoration-dotted cursor-help"
                content="Total Value minus the cost of Stacked Decks opened"
              >
                Net Profit:
              </Tooltip>
              <span
                className={`font-semibold tabular-nums ${
                  session.netProfit < 0 ? "text-error" : "text-success"
                }`}
              >
                {formatCurrency(session.netProfit, session.chaosToDivineRatio)}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isBulkMode) {
    return (
      <div
        onClick={() => toggleSessionSelection(session.sessionId)}
        className={`card bg-base-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer ${borderClass} no-underline h-full flex flex-col relative overflow-hidden`}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.sessionId }}
      className={`card bg-base-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer ${borderClass} no-underline h-full flex flex-col relative overflow-hidden`}
    >
      {cardContent}
    </Link>
  );
};
