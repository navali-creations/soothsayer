import { Stat } from "~/renderer/components";

import type { SessionAverages } from "../../../Statistics.types";

interface StatsAvgProfitPerSessionProps {
  averages: SessionAverages | null;
}

function formatProfit(profit: number, chaosPerDivine: number): string {
  if (chaosPerDivine > 0) {
    return `${profit >= 0 ? "+" : ""}${(profit / chaosPerDivine).toFixed(
      1,
    )}div`;
  }
  return `${profit >= 0 ? "+" : ""}${Math.round(profit).toLocaleString()}c`;
}

export const StatsAvgProfitPerSession = ({
  averages,
}: StatsAvgProfitPerSessionProps) => {
  const formattedAvg =
    averages && averages.avgProfit !== 0
      ? formatProfit(averages.avgProfit, averages.avgChaosPerDivine)
      : "N/A";

  return (
    <Stat className="flex-1 basis-1/5 min-w-0">
      <Stat.Title>Avg. Profit Per Session</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedAvg}</Stat.Value>
    </Stat>
  );
};
