import { GroupedStats } from "~/renderer/components";
import {
  SessionDetailsDurationStat,
  SessionDetailsMostCommonCardStat,
  SessionDetailsOpenedDecksStat,
  SessionDetailsTotalValueStat,
} from "./";

interface SessionDetailsStatsProps {
  duration: string;
  totalCount: number;
  mostCommonCard: { name: string; count: number; ratio: number } | null;
  totalProfit: number;
  chaosToDivineRatio: number;
}

const SessionDetailsStats = ({
  duration,
  totalCount,
  mostCommonCard,
  totalProfit,
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
    </GroupedStats>
  );
};

export default SessionDetailsStats;
