import { Flex } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

interface StatisticsActionsProps {
  availableLeagues: string[];
  currentScope: string;
}

export const StatisticsActions = ({
  availableLeagues,
  currentScope: _currentScope,
}: StatisticsActionsProps) => {
  const {
    statistics: { selectedLeague, setStatScope, setSelectedLeague },
  } = useBoundStore();

  const handleScopeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value === "all-time") {
      setStatScope("all-time");
      setSelectedLeague("");
    } else {
      setStatScope("league");
      setSelectedLeague(value);
    }
  };

  const selectValue = selectedLeague || "all-time";

  return (
    <Flex className="gap-2 items-center">
      <select
        className="select select-sm w-40"
        value={selectValue}
        onChange={handleScopeChange}
      >
        <option value="all-time">All-Time</option>
        {availableLeagues.map((league) => (
          <option key={league} value={league}>
            {league}
          </option>
        ))}
      </select>
    </Flex>
  );
};
