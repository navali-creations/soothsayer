import { AnimatedNumber, Stat } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const CurrentSessionUniqueCardsStat = () => {
  const {
    currentSession: { getSession },
  } = useBoundStore();

  const sessionData = getSession();

  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Unique Cards</Stat.Title>
      <Stat.Value>
        <AnimatedNumber value={sessionData?.cards?.length || 0} />
      </Stat.Value>
      <Stat.Desc>Different cards found</Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionUniqueCardsStat;
