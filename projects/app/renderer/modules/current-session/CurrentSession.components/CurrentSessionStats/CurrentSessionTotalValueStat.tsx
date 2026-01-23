import { useMemo } from "react";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Stat } from "../../../../components";
import { useBoundStore } from "~/renderer/store";
import { formatCurrency } from "../../../../utils";

const CurrentSessionTotalValueStat = () => {
  const {
    currentSession: { getSession },
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();

  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();

  const { chaosToDivineRatio, totalProfit } = useMemo(() => {
    if (!sessionData?.totals) {
      return { chaosToDivineRatio: 0, totalProfit: 0 };
    }
    return {
      chaosToDivineRatio: sessionData.totals[priceSource].chaosToDivineRatio,
      totalProfit: sessionData.totals[priceSource].totalValue,
    };
  }, [sessionData?.totals, priceSource]);

  const hasSnapshot = !!sessionData?.priceSnapshot;

  return (
    <Stat className="flex-1 basis-1/4 bg-gradient-to-tl from-primary/20 to-secondary/0 relative">
      <Stat.Figure className="absolute right-1 -bottom-3">
        {priceSource === "exchange" ? (
          <GiCardExchange size={50} opacity={0.1} />
        ) : (
          <GiLockedChest size={50} opacity={0.1} />
        )}
      </Stat.Figure>
      <Stat.Title>Total Value</Stat.Title>
      <Stat.Value>
        {!hasSnapshot ? (
          <span className="text-base-content/50">N/A</span>
        ) : (
          <span className="tabular-nums">
            {formatCurrency(totalProfit, chaosToDivineRatio)}
          </span>
        )}
      </Stat.Value>
      <Stat.Desc>
        {!hasSnapshot ? (
          <span className="text-base-content/50">No pricing data</span>
        ) : totalProfit >= chaosToDivineRatio ? (
          <span className="flex gap-1">
            <span className="-mt-0.5">≈</span> {Math.floor(totalProfit)} chaos
          </span>
        ) : (
          <span className="flex gap-1">
            <span className="-mt-0.5">≈</span>
            {(totalProfit / chaosToDivineRatio).toFixed(2)} divine
          </span>
        )}
      </Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionTotalValueStat;
