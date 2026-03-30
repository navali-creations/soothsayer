import { Stat } from "~/renderer/components";

interface StatisticsOpenedDecksStatProps {
  totalCount: number;
  sessionCount: number | null;
}

export const StatisticsOpenedDecksStat = ({
  totalCount,
  sessionCount,
}: StatisticsOpenedDecksStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Stacked Decks Opened</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {totalCount.toLocaleString()}
      </Stat.Value>
      <Stat.Desc>
        {sessionCount && sessionCount > 0 ? (
          <span>Across {sessionCount.toLocaleString()} sessions</span>
        ) : null}
      </Stat.Desc>
    </Stat>
  );
};
