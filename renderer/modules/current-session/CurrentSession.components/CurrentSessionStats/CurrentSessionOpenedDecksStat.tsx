import { AnimatedNumber, Stat } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const CurrentSessionOpenedDecksStat = () => {
  const {
    currentSession: { getSession },
  } = useBoundStore();

  const sessionData = getSession();

  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Stacked Decks Opened</Stat.Title>
      <Stat.Value>
        <AnimatedNumber value={sessionData?.totalCount || 0} />
      </Stat.Value>
      <Stat.Desc>This session</Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionOpenedDecksStat;
