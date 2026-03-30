import { Stat } from "~/renderer/components";

interface StatsUniqueCardsCollectedProps {
  collectedCount: number;
  totalAvailable: number | null;
}

export const StatsUniqueCardsCollected = ({
  collectedCount,
  totalAvailable,
}: StatsUniqueCardsCollectedProps) => {
  const hasTotal = totalAvailable !== null && totalAvailable > 0;
  const percentage = hasTotal
    ? Math.round((collectedCount / totalAvailable) * 100)
    : null;

  return (
    <Stat className="flex-1 basis-1/4 min-w-0">
      <Stat.Title>Unique Cards Collected</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {hasTotal ? (
          <>
            {collectedCount}
            <span className="text-sm opacity-50 ml-0.5">
              / {totalAvailable}
            </span>
          </>
        ) : (
          collectedCount
        )}
      </Stat.Value>
      <Stat.Desc>
        {percentage !== null ? (
          <div className="flex items-center gap-2 mt-1">
            <progress
              className="progress progress-primary w-20 h-2"
              value={percentage}
              max={100}
            />
            <span>{percentage}%</span>
          </div>
        ) : (
          "Different cards found"
        )}
      </Stat.Desc>
    </Stat>
  );
};
