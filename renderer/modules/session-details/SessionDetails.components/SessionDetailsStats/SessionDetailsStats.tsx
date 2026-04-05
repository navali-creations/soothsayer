import { GroupedStats } from "~/renderer/components";

import {
  SessionDetailsDurationStat,
  SessionDetailsNetProfitStat,
  SessionDetailsOpenedDecksStat,
  SessionDetailsTotalValueStat,
} from "./";

interface SessionDetailsStatsProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

const SessionDetailsStats = ({
  expanded,
  onToggleExpanded,
}: SessionDetailsStatsProps) => {
  return (
    <GroupedStats className="w-full">
      <SessionDetailsDurationStat />
      <SessionDetailsOpenedDecksStat />
      <SessionDetailsTotalValueStat />
      <SessionDetailsNetProfitStat
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />
    </GroupedStats>
  );
};

export default SessionDetailsStats;
