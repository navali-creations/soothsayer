import { Stat } from "~/renderer/components";
import { useSessionDetails } from "~/renderer/store";

export const SessionDetailsDurationStat = () => {
  const { getDuration } = useSessionDetails();
  const duration = getDuration();

  return (
    <Stat className="flex-1 basis-1/5">
      <Stat.Title>Duration</Stat.Title>
      <Stat.Value className="tabular-nums">{duration}</Stat.Value>
      <Stat.Desc>Session length</Stat.Desc>
    </Stat>
  );
};
