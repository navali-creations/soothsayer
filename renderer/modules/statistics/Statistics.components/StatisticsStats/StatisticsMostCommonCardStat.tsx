import { Stat } from "~/renderer/components";

interface StatisticsMostCommonCardStatProps {
  cardName: string | null;
  count: number;
}

export const StatisticsMostCommonCardStat = ({
  cardName,
  count,
}: StatisticsMostCommonCardStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4 min-w-0">
      <Stat.Title>Most Common</Stat.Title>
      <Stat.Value className="text-lg line-clamp-1">
        {cardName || "N/A"}
      </Stat.Value>
      <Stat.Desc className="tabular-nums">{count} times</Stat.Desc>
    </Stat>
  );
};
