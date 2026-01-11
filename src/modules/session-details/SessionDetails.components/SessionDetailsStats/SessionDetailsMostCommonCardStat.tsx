import { Stat } from "../../../../components";

interface SessionDetailsMostCommonCardStatProps {
  mostCommonCard: { name: string; count: number; ratio: number } | null;
}

export const SessionDetailsMostCommonCardStat = ({
  mostCommonCard,
}: SessionDetailsMostCommonCardStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Most Common Card</Stat.Title>
      <Stat.Value className="truncate text-lg">
        {mostCommonCard?.name || "—"}
      </Stat.Value>
      <Stat.Desc>
        {mostCommonCard
          ? `${mostCommonCard.count}x (${mostCommonCard.ratio.toFixed(1)}%)`
          : "No cards yet"}
      </Stat.Desc>
    </Stat>
  );
};
