import { GroupedStats, Stat } from "~/renderer/components";

const PersonalStatsPlaceholder = () => (
  <GroupedStats className="w-full">
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Total Drops</Stat.Title>
      <Stat.Value className="text-lg">—</Stat.Value>
      <Stat.Desc>Across all sessions</Stat.Desc>
    </Stat>
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Drop Rate</Stat.Title>
      <Stat.Value className="text-lg">—</Stat.Value>
      <Stat.Desc>Drops per cards opened</Stat.Desc>
    </Stat>
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>First Found</Stat.Title>
      <Stat.Value className="text-lg">—</Stat.Value>
      <Stat.Desc>&nbsp;</Stat.Desc>
    </Stat>
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Last Seen</Stat.Title>
      <Stat.Value className="text-lg">—</Stat.Value>
      <Stat.Desc>&nbsp;</Stat.Desc>
    </Stat>
  </GroupedStats>
);

export default PersonalStatsPlaceholder;
