import { GroupedStats } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import PFBaseRateStat from "./PFBaseRateStat/PFBaseRateStat";
import PFBreakEvenStat from "./PFBreakEvenStat/PFBreakEvenStat";
import PFEstimatedNetStat from "./PFEstimatedNetStat/PFEstimatedNetStat";
import PFEstimatedReturnStat from "./PFEstimatedReturnStat/PFEstimatedReturnStat";
import PFYouSpendStat from "./PFYouSpendStat/PFYouSpendStat";

const PFSummaryCards = () => {
  const {
    profitForecast: { isComputing },
    poeNinja: { isRefreshing },
  } = useBoundStore();

  const isStale = isComputing || isRefreshing;

  return (
    <GroupedStats
      direction="horizontal"
      className="shadow-sm shrink-0 w-full relative"
    >
      {/* Computing / refreshing overlay */}
      {isStale && (
        <div className="absolute inset-0 bg-base-200/60 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-lg pointer-events-none">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      )}

      <PFBaseRateStat />
      <PFYouSpendStat />
      <PFEstimatedReturnStat />
      <PFEstimatedNetStat />
      <PFBreakEvenStat />
    </GroupedStats>
  );
};

export default PFSummaryCards;
