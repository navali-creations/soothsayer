import { Stat } from "~/renderer/components";
import { formatCurrency } from "~/renderer/utils";

interface SessionDetailsNetProfitStatProps {
  netProfit: number;
  totalDeckCost: number;
  chaosToDivineRatio: number;
}

export const SessionDetailsNetProfitStat = ({
  netProfit,
  totalDeckCost,
  chaosToDivineRatio,
}: SessionDetailsNetProfitStatProps) => {
  const hasDeckCost = totalDeckCost > 0;

  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>
        <span
          className="underline decoration-dotted cursor-help"
          title="Total Value minus the cost of Stacked Decks opened. Represents actual profit if you purchased the decks."
        >
          Net Profit
        </span>
      </Stat.Title>
      <Stat.Value
        className={`tabular-nums ${netProfit < 0 ? "text-error" : "text-success"}`}
      >
        {formatCurrency(netProfit, chaosToDivineRatio)}
      </Stat.Value>
      <Stat.Desc>
        {hasDeckCost
          ? `After ${Math.floor(totalDeckCost)}c deck cost`
          : "No deck cost data"}
      </Stat.Desc>
    </Stat>
  );
};
