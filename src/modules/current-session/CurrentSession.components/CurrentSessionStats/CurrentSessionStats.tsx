import { GroupedStats } from "../../../../components";
import {
  CurrentSessionOpenedDecksStat,
  CurrentSessionUniqueCardsStat,
  CurrentSessionMostValueableCardStat,
  CurrentSessionTotalValueStat,
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
