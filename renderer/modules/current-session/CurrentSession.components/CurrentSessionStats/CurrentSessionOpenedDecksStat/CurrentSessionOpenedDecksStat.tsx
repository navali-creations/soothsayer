import { AnimatedNumber, Stat } from "~/renderer/components";
import { useBoundStore, useCurrentSession } from "~/renderer/store";

const CurrentSessionOpenedDecksStat = () => {
  const { getSession } = useCurrentSession();
  const isActive = useBoundStore((state) =>
    state.currentSession.getIsCurrentSessionActive(),
  );

  const sessionData = getSession();

  return (
    <Stat className="overflow-hidden">
      <Stat.Title>
        {isActive ? "Decks Opened" : "Stacked Decks Opened"}
      </Stat.Title>
      <Stat.Value>
        <AnimatedNumber value={sessionData?.totalCount || 0} />
      </Stat.Value>
      <Stat.Desc>This session</Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionOpenedDecksStat;
