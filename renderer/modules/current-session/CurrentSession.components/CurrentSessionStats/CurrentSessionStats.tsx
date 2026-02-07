import { GroupedStats } from "~/renderer/components";

import {
  CurrentSessionMostValueableCardStat,
  CurrentSessionNetProfitStat,
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
      <CurrentSessionNetProfitStat />
    </GroupedStats>
  );
};

export default CurrentSessionStats;
