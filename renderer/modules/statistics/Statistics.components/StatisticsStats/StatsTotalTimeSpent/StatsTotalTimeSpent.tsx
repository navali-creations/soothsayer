import { Stat } from "~/renderer/components";

import type { TotalTimeSpentHighlight } from "../../../Statistics.types";

interface StatsTotalTimeSpentProps {
  data: TotalTimeSpentHighlight | null;
}

function formatTime(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${days}d`;
}

export const StatsTotalTimeSpent = ({ data }: StatsTotalTimeSpentProps) => {
  const formattedValue =
    data && data.totalMinutes > 0
      ? formatTime(Math.round(data.totalMinutes))
      : "N/A";

  return (
    <Stat className="flex-1 basis-1/5 min-w-0">
      <Stat.Title>Total Time Spent</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedValue}</Stat.Value>
      <Stat.Desc>{!data && <span>No sessions yet</span>}</Stat.Desc>
    </Stat>
  );
};
