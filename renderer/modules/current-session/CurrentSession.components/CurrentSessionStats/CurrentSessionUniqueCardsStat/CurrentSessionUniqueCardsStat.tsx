import { AnimatedNumber, Stat } from "~/renderer/components";
import { useCurrentSession } from "~/renderer/store";

const CurrentSessionUniqueCardsStat = () => {
  const { getSession } = useCurrentSession();

  const sessionData = getSession();

  return (
    <Stat className="overflow-hidden">
      <Stat.Title>Unique Cards</Stat.Title>
      <Stat.Value>
        <AnimatedNumber value={sessionData?.cards?.length || 0} />
      </Stat.Value>
      <Stat.Desc>Different cards found</Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionUniqueCardsStat;
