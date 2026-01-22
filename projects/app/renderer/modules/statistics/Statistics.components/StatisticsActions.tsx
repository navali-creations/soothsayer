import { FiDownload } from "react-icons/fi";

import { Button, Flex } from "../../../components";
import { useBoundStore } from "../../../store/store";

interface StatisticsActionsProps {
  availableLeagues: string[];
  onExport: () => void;
}

export const StatisticsActions = ({
  availableLeagues,
  onExport,
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

  // Get the current value for the select
  const selectValue = selectedLeague || "all-time";

  return (
    <Flex className="gap-2 items-center">
      {/* Combined Stat Scope + League Selector */}

      <select
        className="select select-sm"
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

      <Button variant="primary" outline onClick={onExport} size="sm">
        <FiDownload /> Export CSV
      </Button>
    </Flex>
  );
};
