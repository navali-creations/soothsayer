import { GroupedStats } from "~/renderer/components";
import {
  CurrentSessionMostValueableCardStat,
  CurrentSessionOpenedDecksStat,
  CurrentSessionTotalValueStat,
  CurrentSessionUniqueCardsStat,
} from ".";

const CurrentSessionStats = () => {
  return (
    <GroupedStats className="w-full">
      <CurrentSessionOpenedDecksStat />
      <CurrentSessionUniqueCardsStat />
      <CurrentSessionMostValueableCardStat />
      <CurrentSessionTotalValueStat />
    </GroupedStats>
  );
};

export default CurrentSessionStats;
