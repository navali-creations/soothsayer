import { Stat } from "~/renderer/components";

interface SessionDetailsDurationStatProps {
  duration: string;
}

export const SessionDetailsDurationStat = ({
  duration,
}: SessionDetailsDurationStatProps) => {
  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Duration</Stat.Title>
      <Stat.Value className="tabular-nums">{duration}</Stat.Value>
      <Stat.Desc>Session length</Stat.Desc>
    </Stat>
  );
};
