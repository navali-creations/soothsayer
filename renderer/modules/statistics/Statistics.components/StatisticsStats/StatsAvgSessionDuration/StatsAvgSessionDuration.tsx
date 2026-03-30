import { Stat } from "~/renderer/components";

import type { SessionAverages } from "../../../Statistics.types";

interface StatsAvgSessionDurationProps {
  averages: SessionAverages | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export const StatsAvgSessionDuration = ({
  averages,
}: StatsAvgSessionDurationProps) => {
  const formattedAvg =
    averages && averages.avgDurationMinutes > 0
      ? formatDuration(Math.round(averages.avgDurationMinutes))
      : "N/A";

  return (
    <Stat className="flex-1 basis-1/5 min-w-0">
      <Stat.Title>Avg. Session Duration</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedAvg}</Stat.Value>
    </Stat>
  );
};
