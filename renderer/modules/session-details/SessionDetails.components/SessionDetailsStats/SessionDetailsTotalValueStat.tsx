import { Stat } from "~/renderer/components";
import { formatCurrency } from "~/renderer/utils";

interface SessionDetailsTotalValueStatProps {
  totalProfit: number;
  chaosToDivineRatio: number;
}

export const SessionDetailsTotalValueStat = ({
  totalProfit,
  chaosToDivineRatio,
}: SessionDetailsTotalValueStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Total Value</Stat.Title>
      <Stat.Value className="text-success tabular-nums">
        {formatCurrency(totalProfit, chaosToDivineRatio)}
      </Stat.Value>
      <Stat.Desc>Session profit</Stat.Desc>
    </Stat>
  );
};
