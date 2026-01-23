import { Stat } from "../../../../components";
import { useBoundStore } from "~/renderer/store";

interface StatisticsOpenedDecksStatProps {
  totalCount: number;
}

export const StatisticsOpenedDecksStat = ({
  totalCount,
}: StatisticsOpenedDecksStatProps) => {
  const {
    statistics: { statScope },
  } = useBoundStore();

  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Stacked Decks Opened</Stat.Title>
      <Stat.Value className="tabular-nums">{totalCount}</Stat.Value>
      <Stat.Desc>
        {statScope === "all-time" ? "All time" : "Current league"}
      </Stat.Desc>
    </Stat>
  );
};
