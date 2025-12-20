import { ReactNode } from "react";
import { Stat } from "../../../../components";
import { useBoundStore } from "../../../../store/store";

const CurrentSessionUniqueCardsStat = () => {
  const {
    currentSession: { getSession },
  } = useBoundStore();

  const sessionData = getSession();

  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Unique Cards</Stat.Title>
      <Stat.Value>{(sessionData?.cards?.length as ReactNode) || 0}</Stat.Value>
      <Stat.Desc>Different cards found</Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionUniqueCardsStat;
