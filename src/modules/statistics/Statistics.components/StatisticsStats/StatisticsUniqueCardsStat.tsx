import { Stat } from "../../../../components";

interface StatisticsUniqueCardsStatProps {
  uniqueCardCount: number;
}

export const StatisticsUniqueCardsStat = ({
  uniqueCardCount,
}: StatisticsUniqueCardsStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Unique Cards</Stat.Title>
      <Stat.Value className="tabular-nums">{uniqueCardCount}</Stat.Value>
      <Stat.Desc>Different cards found</Stat.Desc>
    </Stat>
  );
};
