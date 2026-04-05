import { Stat } from "~/renderer/components";
import { useSessionDetails } from "~/renderer/store";

export const SessionDetailsOpenedDecksStat = () => {
  const { getSession } = useSessionDetails();
  const session = getSession();
  const totalCount = session?.totalCount ?? 0;

  return (
    <Stat className="flex-1 basis-1/5">
      <Stat.Title>Stacked Decks Opened</Stat.Title>
      <Stat.Value className="tabular-nums">{totalCount}</Stat.Value>
      <Stat.Desc>Total decks</Stat.Desc>
    </Stat>
  );
};
