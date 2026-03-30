import { Stat } from "~/renderer/components";

import type { SessionAverages } from "../../../Statistics.types";

interface StatsAvgDecksPerSessionProps {
  averages: SessionAverages | null;
}

export const StatsAvgDecksPerSession = ({
  averages,
}: StatsAvgDecksPerSessionProps) => {
  const formattedAvg =
    averages && averages.avgDecksOpened > 0
      ? Math.round(averages.avgDecksOpened).toLocaleString()
      : "N/A";

  return (
    <Stat className="flex-1 basis-1/5 min-w-0">
      <Stat.Title>Avg. Decks Per Session</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedAvg}</Stat.Value>
    </Stat>
  );
};
