import { GroupedStats } from "~/renderer/components";

import {
  CurrentSessionMostValueableCardStat,
  CurrentSessionNetProfitStat,
  CurrentSessionOpenedDecksStat,
  CurrentSessionTotalValueStat,
  CurrentSessionUniqueCardsStat,
} from ".";

interface CurrentSessionStatsProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
  hasTimeline?: boolean;
}

const CurrentSessionStats = ({
  expanded,
  onToggleExpanded,
  hasTimeline,
}: CurrentSessionStatsProps) => {
  return (
    <GroupedStats className="w-full grid-cols-5">
      <CurrentSessionOpenedDecksStat />
      <CurrentSessionUniqueCardsStat />
      <CurrentSessionMostValueableCardStat />
      <CurrentSessionTotalValueStat />
      <CurrentSessionNetProfitStat
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        hasTimeline={hasTimeline}
      />
    </GroupedStats>
  );
};

export default CurrentSessionStats;
