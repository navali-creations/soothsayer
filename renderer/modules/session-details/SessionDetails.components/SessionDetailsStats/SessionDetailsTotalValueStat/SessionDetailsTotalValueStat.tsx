import { Stat } from "~/renderer/components";
import { useSessionDetails } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";

export const SessionDetailsTotalValueStat = () => {
  const { getTotalProfit, getPriceData } = useSessionDetails();
  const totalProfit = getTotalProfit();
  const { chaosToDivineRatio } = getPriceData();

  return (
    <Stat className="flex-1 basis-1/5">
      <Stat.Title>Total Value</Stat.Title>
      <Stat.Value className="text-success tabular-nums">
        {formatCurrency(totalProfit, chaosToDivineRatio)}
      </Stat.Value>
      <Stat.Desc>Session profit</Stat.Desc>
    </Stat>
  );
};
