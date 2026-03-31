import { FiInfo } from "react-icons/fi";

import { Stat } from "~/renderer/components";

import type { ProfitPerHourHighlight } from "../../../Statistics.types";

interface StatsProfitPerHourProps {
  data: ProfitPerHourHighlight | null;
}

function formatProfit(profit: number, chaosPerDivine: number): string {
  if (chaosPerDivine > 0) {
    return `${profit >= 0 ? "+" : ""}${(profit / chaosPerDivine).toFixed(1)}div/hr`;
  }
  return `${profit >= 0 ? "+" : ""}${Math.round(profit).toLocaleString()}c/hr`;
}

export const StatsProfitPerHour = ({ data }: StatsProfitPerHourProps) => {
  const formattedValue = data
    ? formatProfit(data.profitPerHour, data.avgChaosPerDivine)
    : "N/A";

  return (
    <Stat className="flex-1 basis-1/5 min-w-0 relative">
      <div
        className="absolute top-1.5 right-2 tooltip tooltip-left tooltip-primary z-10"
        data-tip="Net profit divided by total time spent opening decks"
      >
        <FiInfo className="w-3 h-3 text-base-content/25 hover:text-base-content/50 transition-colors cursor-help" />
      </div>
      <Stat.Title>Profit Per Hour</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedValue}</Stat.Value>
      <Stat.Desc>{!data && <span>No sessions yet</span>}</Stat.Desc>
    </Stat>
  );
};
