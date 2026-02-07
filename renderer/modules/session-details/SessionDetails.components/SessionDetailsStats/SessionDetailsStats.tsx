import { GroupedStats } from "~/renderer/components";

import {
  SessionDetailsDurationStat,
  SessionDetailsMostCommonCardStat,
  SessionDetailsNetProfitStat,
  SessionDetailsOpenedDecksStat,
  SessionDetailsTotalValueStat,
} from "./";

interface SessionDetailsStatsProps {
  duration: string;
  totalCount: number;
  mostCommonCard: { name: string; count: number; ratio: number } | null;
  totalProfit: number;
  netProfit: number;
  totalDeckCost: number;
  chaosToDivineRatio: number;
}

const SessionDetailsStats = ({
  duration,
  totalCount,
  mostCommonCard,
  totalProfit,
  netProfit,
  totalDeckCost,
  chaosToDivineRatio,
}: SessionDetailsStatsProps) => {
  return (
    <GroupedStats className="w-full">
      <SessionDetailsDurationStat duration={duration} />
      <SessionDetailsOpenedDecksStat totalCount={totalCount} />
      <SessionDetailsMostCommonCardStat mostCommonCard={mostCommonCard} />
      <SessionDetailsTotalValueStat
        totalProfit={totalProfit}
        chaosToDivineRatio={chaosToDivineRatio}
      />
      <SessionDetailsNetProfitStat
        netProfit={netProfit}
        totalDeckCost={totalDeckCost}
        chaosToDivineRatio={chaosToDivineRatio}
      />
    </GroupedStats>
  );
};

export default SessionDetailsStats;
