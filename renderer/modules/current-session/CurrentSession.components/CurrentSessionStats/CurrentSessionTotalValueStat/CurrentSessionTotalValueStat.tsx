import { useMemo } from "react";
import { GiCardExchange } from "react-icons/gi";

import { AnimatedNumber, Stat } from "~/renderer/components";
import { useCurrentSession } from "~/renderer/store";

const CurrentSessionTotalValueStat = () => {
  const { getSession } = useCurrentSession();

  const sessionData = getSession();

  const { chaosToDivineRatio, totalProfit } = useMemo(() => {
    if (!sessionData?.totals) {
      return { chaosToDivineRatio: 0, totalProfit: 0 };
    }
    return {
      chaosToDivineRatio: sessionData.totals.chaosToDivineRatio,
      totalProfit: sessionData.totals.totalValue,
    };
  }, [sessionData?.totals]);

  const hasSnapshot = !!sessionData?.priceSnapshot;
  const hasDivineRatio = chaosToDivineRatio > 0;
  const showAsDivine = hasDivineRatio && totalProfit >= chaosToDivineRatio;

  return (
    <Stat className="bg-gradient-to-tl from-primary/20 to-secondary/0 relative overflow-hidden">
      <Stat.Figure className="absolute right-1 -bottom-3">
        <GiCardExchange size={50} opacity={0.1} />
      </Stat.Figure>
      <Stat.Title>Total Value</Stat.Title>
      <Stat.Value>
        {!hasSnapshot ? (
          <span className="text-base-content/50">N/A</span>
        ) : showAsDivine ? (
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
        ) : !hasDivineRatio ? (
          <span className="text-base-content/50">Divine rate unavailable</span>
        ) : showAsDivine ? (
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
