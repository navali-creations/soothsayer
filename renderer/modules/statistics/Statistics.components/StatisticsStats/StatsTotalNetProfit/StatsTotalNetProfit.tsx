import { FiInfo } from "react-icons/fi";

import { Stat } from "~/renderer/components";

import type { TotalNetProfitHighlight } from "../../../Statistics.types";

interface StatsTotalNetProfitProps {
  data: TotalNetProfitHighlight | null;
}

function formatProfit(profit: number, chaosPerDivine: number): string {
  if (chaosPerDivine > 0) {
    return `${profit >= 0 ? "+" : ""}${(profit / chaosPerDivine).toFixed(
      1,
    )}div`;
  }
  return `${profit >= 0 ? "+" : ""}${Math.round(profit).toLocaleString()}c`;
}

export const StatsTotalNetProfit = ({ data }: StatsTotalNetProfitProps) => {
  const formattedProfit = data
    ? formatProfit(data.totalProfit, data.avgChaosPerDivine)
    : "N/A";

  return (
    <Stat className="flex-1 basis-1/4 min-w-0 relative">
      <div
        className="absolute top-1.5 right-2 tooltip tooltip-left tooltip-primary z-10"
        data-tip="Uses the chaos:divine ratio from each session's time, not today's market value"
      >
        <FiInfo className="w-3 h-3 text-base-content/25 hover:text-base-content/50 transition-colors cursor-help" />
      </div>
      <Stat.Title>Total Net Profit</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {formattedProfit}
      </Stat.Value>
      <Stat.Desc>{!data && <span>No sessions yet</span>}</Stat.Desc>
    </Stat>
  );
};
