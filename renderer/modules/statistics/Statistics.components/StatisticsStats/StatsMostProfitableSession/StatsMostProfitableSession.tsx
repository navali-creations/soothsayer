import { useNavigate } from "@tanstack/react-router";

import { Stat } from "~/renderer/components";

import type { MostProfitableSessionHighlight } from "../../../Statistics.types";

interface StatsMostProfitableSessionProps {
  data: MostProfitableSessionHighlight | null;
}

function formatProfit(profit: number, chaosPerDivine: number): string {
  if (chaosPerDivine > 0) {
    return `${profit >= 0 ? "+" : ""}${(profit / chaosPerDivine).toFixed(
      1,
    )}div`;
  }
  return `${profit >= 0 ? "+" : ""}${Math.round(profit).toLocaleString()}c`;
}

export const StatsMostProfitableSession = ({
  data,
}: StatsMostProfitableSessionProps) => {
  const navigate = useNavigate();

  const formattedProfit = data
    ? formatProfit(data.profit, data.chaosPerDivine)
    : "N/A";

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
      <Stat.Title>Most Profitable Session</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {formattedProfit}
      </Stat.Value>
      <Stat.Desc>
        {data?.totalDecksOpened != null && (
          <span>{data.totalDecksOpened.toLocaleString()} decks opened</span>
        )}
        {!data && <span>No sessions yet</span>}
      </Stat.Desc>
    </Stat>
  );
};
