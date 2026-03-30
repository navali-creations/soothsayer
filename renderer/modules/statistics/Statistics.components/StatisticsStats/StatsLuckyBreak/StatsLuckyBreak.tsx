import { useNavigate } from "@tanstack/react-router";
import { FiInfo } from "react-icons/fi";

import { Stat } from "~/renderer/components";

import type { LuckyBreakHighlight } from "../../../Statistics.types";

interface StatsLuckyBreakProps {
  data: LuckyBreakHighlight | null;
}

function formatProfit(profit: number, chaosPerDivine: number): string {
  if (chaosPerDivine > 0) {
    return `${profit >= 0 ? "+" : ""}${(profit / chaosPerDivine).toFixed(
      1,
    )}div`;
  }
  return `${profit >= 0 ? "+" : ""}${Math.round(profit).toLocaleString()}c`;
}

export const StatsLuckyBreak = ({ data }: StatsLuckyBreakProps) => {
  const navigate = useNavigate();

  const formattedProfit = data
    ? formatProfit(data.profit, data.chaosPerDivine)
    : "N/A";

  const formattedDecks = data
    ? `${data.totalDecksOpened.toLocaleString()} decks opened`
    : null;

  const handleClick = () => {
    if (data) {
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId: data.sessionId },
      });
    }
  };

  return (
    <Stat
      className={`flex-1 basis-1/4 min-w-0 relative ${
        data ? "cursor-pointer hover:bg-base-200 transition-colors" : ""
      }`}
      onClick={handleClick}
      role={data ? "link" : undefined}
    >
      {data && (
        <span className="absolute bottom-1.5 right-2 text-[10px] text-base-content/25 pointer-events-none select-none">
          Click to view details
        </span>
      )}
      <div
        className="absolute top-1.5 right-2 tooltip tooltip-left tooltip-primary z-10"
        data-tip="The session where you opened the fewest decks but made the most profit"
      >
        <FiInfo className="w-3 h-3 text-base-content/25 hover:text-base-content/50 transition-colors cursor-help" />
      </div>
      <Stat.Title>Lucky Break</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {formattedProfit}
      </Stat.Value>
      <Stat.Desc>
        {formattedDecks && <span>{formattedDecks}</span>}
        {!data && <span>No sessions yet</span>}
      </Stat.Desc>
    </Stat>
  );
};
