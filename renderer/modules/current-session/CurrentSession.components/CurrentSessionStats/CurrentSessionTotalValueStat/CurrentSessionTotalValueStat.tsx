import { useMemo } from "react";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";

import { AnimatedNumber, Stat } from "~/renderer/components";
import { useCurrentSession, useSettings } from "~/renderer/store";

const CurrentSessionTotalValueStat = () => {
  const { getSession } = useCurrentSession();
  const { getActiveGameViewPriceSource } = useSettings();

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
    <Stat className="bg-gradient-to-tl from-primary/20 to-secondary/0 relative overflow-hidden">
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
        ) : totalProfit >= chaosToDivineRatio ? (
          <AnimatedNumber
            value={totalProfit / chaosToDivineRatio}
            decimals={2}
            suffix="d"
            className="tabular-nums"
          />
        ) : (
          <AnimatedNumber
            value={totalProfit}
            decimals={2}
            suffix="c"
            className="tabular-nums"
          />
        )}
      </Stat.Value>
      <Stat.Desc>
        {!hasSnapshot ? (
          <span className="text-base-content/50">No pricing data</span>
        ) : totalProfit >= chaosToDivineRatio ? (
          <span className="flex gap-1">
            <span className="-mt-0.5">≈</span>{" "}
            <AnimatedNumber value={totalProfit} decimals={0} suffix=" chaos" />
          </span>
        ) : (
          <span className="flex gap-1">
            <span className="-mt-0.5">≈</span>{" "}
            <AnimatedNumber
              value={totalProfit / chaosToDivineRatio}
              decimals={2}
              suffix=" divine"
            />
          </span>
        )}
      </Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionTotalValueStat;
