import { useNavigate } from "@tanstack/react-router";

import { Stat } from "~/renderer/components";

import type { LongestSessionHighlight } from "../../../Statistics.types";

interface StatsLongestSessionProps {
  data: LongestSessionHighlight | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export const StatsLongestSession = ({ data }: StatsLongestSessionProps) => {
  const navigate = useNavigate();

  const formattedDuration = data ? formatDuration(data.durationMinutes) : "N/A";

  const handleClick = () => {
    if (data) {
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId: data.sessionId },
      });
    }
  };

  return (
    <Stat
      className={`flex-1 basis-1/4 min-w-0 relative ${
        data ? "cursor-pointer hover:bg-base-200 transition-colors" : ""
      }`}
      onClick={handleClick}
      role={data ? "link" : undefined}
    >
      {data && (
        <span className="absolute bottom-1.5 right-2 text-[10px] text-base-content/25 pointer-events-none select-none">
          Click to view details
        </span>
      )}
      <Stat.Title>Longest Session</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {formattedDuration}
      </Stat.Value>
      <Stat.Desc>
        {data?.totalDecksOpened != null && (
          <span>{data.totalDecksOpened.toLocaleString()} decks opened</span>
        )}
        {!data && <span>No sessions yet</span>}
      </Stat.Desc>
    </Stat>
  );
};
