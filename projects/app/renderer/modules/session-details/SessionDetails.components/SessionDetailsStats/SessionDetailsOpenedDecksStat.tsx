import { Stat } from "../../../../components";

interface SessionDetailsOpenedDecksStatProps {
  totalCount: number;
}

export const SessionDetailsOpenedDecksStat = ({
  totalCount,
}: SessionDetailsOpenedDecksStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Stacked Decks Opened</Stat.Title>
      <Stat.Value className="tabular-nums">{totalCount}</Stat.Value>
      <Stat.Desc>Total decks</Stat.Desc>
    </Stat>
  );
};
