import { FiInfo } from "react-icons/fi";

import { Stat } from "~/renderer/components";

import type { AvgProfitPerDeckHighlight } from "../../../Statistics.types";

interface StatsAvgProfitPerDeckProps {
  data: AvgProfitPerDeckHighlight | null;
}

function formatProfit(profit: number): string {
  return `${profit >= 0 ? "+" : ""}${profit.toFixed(1)}c`;
}

function formatCost(cost: number): string {
  return `${cost.toFixed(1)}c`;
}

export const StatsAvgProfitPerDeck = ({ data }: StatsAvgProfitPerDeckProps) => {
  const formattedValue = data ? formatProfit(data.avgProfitPerDeck) : "N/A";
  const hasCost = data !== null && data.avgDeckCost > 0;

  return (
    <Stat className="flex-1 basis-1/5 min-w-0 relative">
      <div
        className="absolute top-1.5 right-2 tooltip tooltip-left tooltip-primary z-10"
        data-tip="Net profit divided by total decks opened"
      >
        <FiInfo className="w-3 h-3 text-base-content/25 hover:text-base-content/50 transition-colors cursor-help" />
      </div>
      <Stat.Title>Avg. Profit Per Deck</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {formattedValue}
        {hasCost && (
          <span className="text-sm opacity-50 ml-0.5">
            / {formatCost(data.avgDeckCost)}
          </span>
        )}
      </Stat.Value>
      <Stat.Desc>{!data && <span>No sessions yet</span>}</Stat.Desc>
    </Stat>
  );
};
