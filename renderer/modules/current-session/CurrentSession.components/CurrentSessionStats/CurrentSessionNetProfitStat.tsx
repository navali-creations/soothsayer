import { useMemo } from "react";
import { GiReceiveMoney } from "react-icons/gi";

import { AnimatedNumber, Stat } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const CurrentSessionNetProfitStat = () => {
  const {
    currentSession: { getSession },
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();

  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();

  const { chaosToDivineRatio, netProfit, totalDeckCost } = useMemo(() => {
    if (!sessionData?.totals) {
      return { chaosToDivineRatio: 0, netProfit: 0, totalDeckCost: 0 };
    }
    return {
      chaosToDivineRatio: sessionData.totals[priceSource].chaosToDivineRatio,
      netProfit: sessionData.totals[priceSource].netProfit,
      totalDeckCost: sessionData.totals.totalDeckCost,
    };
  }, [sessionData?.totals, priceSource]);

  const hasSnapshot = !!sessionData?.priceSnapshot;
  const hasDeckCost = totalDeckCost > 0;
  const showAsDivine = Math.abs(netProfit) >= chaosToDivineRatio;

  return (
    <Stat className="flex-1 basis-1/4 bg-gradient-to-tl from-success/20 to-secondary/0 relative">
      <Stat.Figure className="absolute right-1 -bottom-3">
        <GiReceiveMoney size={50} opacity={0.1} />
      </Stat.Figure>
      <Stat.Title>
        <span
          className="underline decoration-dotted cursor-help"
          title="Total Value minus the cost of Stacked Decks opened. Represents actual profit if you purchased the decks."
        >
          Net Profit
        </span>
      </Stat.Title>
      <Stat.Value>
        {!hasSnapshot ? (
          <span className="text-base-content/50">N/A</span>
        ) : showAsDivine ? (
          <AnimatedNumber
            value={netProfit / chaosToDivineRatio}
            decimals={2}
            suffix="d"
            className={`tabular-nums ${netProfit < 0 ? "text-error" : ""}`}
          />
        ) : (
          <AnimatedNumber
            value={netProfit}
            decimals={2}
            suffix="c"
            className={`tabular-nums ${netProfit < 0 ? "text-error" : ""}`}
          />
        )}
      </Stat.Value>
      <Stat.Desc>
        {!hasSnapshot ? (
          <span className="text-base-content/50">No pricing data</span>
        ) : !hasDeckCost ? (
          <span className="text-base-content/50">No deck cost data</span>
        ) : showAsDivine ? (
          <span className="flex gap-1">
            <span className="-mt-0.5">≈</span>{" "}
            <AnimatedNumber value={netProfit} decimals={0} suffix=" chaos" />
            <span className="text-base-content/40">
              (-
              <AnimatedNumber value={totalDeckCost} decimals={0} suffix="c" />
              {" decks)"}
            </span>
          </span>
        ) : (
          <span className="flex gap-1">
            <span className="-mt-0.5">≈</span>{" "}
            <AnimatedNumber
              value={netProfit / chaosToDivineRatio}
              decimals={2}
              suffix=" divine"
            />
            <span className="text-base-content/40">
              (-
              <AnimatedNumber value={totalDeckCost} decimals={0} suffix="c" />
              {" decks)"}
            </span>
          </span>
        )}
      </Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionNetProfitStat;
