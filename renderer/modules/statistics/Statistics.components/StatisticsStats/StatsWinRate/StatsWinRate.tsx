import { Stat } from "~/renderer/components";

import type { WinRateHighlight } from "../../../Statistics.types";

interface StatsWinRateProps {
  data: WinRateHighlight | null;
}

export const StatsWinRate = ({ data }: StatsWinRateProps) => {
  const formattedValue =
    data !== null ? `${Math.round(data.winRate * 100)}%` : "N/A";

  const description =
    data !== null
      ? `${data.profitableSessions} of ${data.totalSessions} sessions profitable`
      : null;

  return (
    <Stat className="flex-1 basis-1/5 min-w-0">
      <Stat.Title>Win Rate</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedValue}</Stat.Value>
      <Stat.Desc>{description ?? <span>No sessions yet</span>}</Stat.Desc>
    </Stat>
  );
};
